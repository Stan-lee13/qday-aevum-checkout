import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory, Contract, parseUnits } from 'ethers';

const root = path.resolve(import.meta.dirname, '..');
const checkoutSource = fs.readFileSync(path.join(root, 'contracts/Checkout.sol'), 'utf8');
const mockSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract MockUSD8 {
 uint8 public constant decimals = 6;
 mapping(address => uint256) public balanceOf;
 mapping(address => mapping(address => uint256)) public allowance;
 function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
 function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
 function transferFrom(address from, address to, uint256 amount) external returns (bool) {
   require(allowance[from][msg.sender] >= amount, "allowance");
   require(balanceOf[from] >= amount, "balance");
   allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
 }
}`;
function compile() {
  const input = { language: 'Solidity', sources: { 'Checkout.sol': { content: checkoutSource }, 'MockUSD8.sol': { content: mockSource } }, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e) => e.severity === 'error');
  assert.deepEqual(errors, [], errors.map((e) => e.formattedMessage).join('\n'));
  return out.contracts;
}
const artifacts = compile();
const checkoutArtifact = artifacts['Checkout.sol'].Checkout;
const tokenArtifact = artifacts['MockUSD8.sol'].MockUSD8;
test('end-to-end exact payment settles to merchant and records payer', async (t) => {
  const eip1193 = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 3 } });
  t.after(() => eip1193.disconnect());
  const provider = new BrowserProvider(eip1193);
  const merchant = await provider.getSigner(0);
  const payer = await provider.getSigner(1);
  const factory = new ContractFactory(tokenArtifact.abi, tokenArtifact.evm.bytecode.object, merchant);
  const token = await factory.deploy(); await token.waitForDeployment();
  const checkoutFactory = new ContractFactory(checkoutArtifact.abi, checkoutArtifact.evm.bytecode.object, merchant);
  const checkout = await checkoutFactory.deploy(await token.getAddress()); await checkout.waitForDeployment();
  const amount = parseUnits('12.34', 6);
  await (await token.mint(await payer.getAddress(), amount)).wait();
  const createReceipt = await (await checkout.createInvoice(amount)).wait();
  const created = createReceipt.logs.map((log) => { try { return checkout.interface.parseLog(log); } catch { return null; } }).find((x) => x?.name === 'InvoiceCreated');
  assert.ok(created);
  assert.equal(created.args.invoiceId, 1n);
  await (await token.connect(payer).approve(await checkout.getAddress(), amount)).wait();
  const receipt = await (await checkout.connect(payer).pay(1)).wait();
  const paid = receipt.logs.map((log) => { try { return checkout.interface.parseLog(log); } catch { return null; } }).find((x) => x?.name === 'InvoicePaid');
  assert.ok(paid);
  assert.equal(await token.balanceOf(await merchant.getAddress()), amount);
  assert.equal(await token.balanceOf(await payer.getAddress()), 0n);
  const invoice = await checkout.invoices(1);
  assert.equal(invoice.payer, await payer.getAddress());
  assert.equal(invoice.amount, amount);
  assert.notEqual(invoice.paidAt, 0n);
});

test('rejects zero-value and repeated payment without second settlement', async (t) => {
  const eip1193 = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 2 } });
  t.after(() => eip1193.disconnect());
  const provider = new BrowserProvider(eip1193);
  const merchant = await provider.getSigner(0); const payer = await provider.getSigner(1);
  const token = await new ContractFactory(tokenArtifact.abi, tokenArtifact.evm.bytecode.object, merchant).deploy(); await token.waitForDeployment();
  const checkout = await new ContractFactory(checkoutArtifact.abi, checkoutArtifact.evm.bytecode.object, merchant).deploy(await token.getAddress()); await checkout.waitForDeployment();
  await assert.rejects(checkout.createInvoice(0));
  const amount = parseUnits('1', 6);
  await (await checkout.createInvoice(amount)).wait();
  await (await token.mint(await payer.getAddress(), amount)).wait();
  await (await token.connect(payer).approve(await checkout.getAddress(), amount)).wait();
  await (await checkout.connect(payer).pay(1)).wait();
  assert.equal((await checkout.invoices(1)).payer, await payer.getAddress());
  await assert.rejects(checkout.connect(payer).pay.staticCall(1));
  assert.equal(await token.balanceOf(await merchant.getAddress()), amount);
});

test('rejects unknown invoice and merchant paying own invoice', async (t) => {
  const eip1193 = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 2 } });
  t.after(() => eip1193.disconnect());
  const provider = new BrowserProvider(eip1193); const merchant = await provider.getSigner(0); const payer = await provider.getSigner(1);
  const token = await new ContractFactory(tokenArtifact.abi, tokenArtifact.evm.bytecode.object, merchant).deploy(); await token.waitForDeployment();
  const checkout = await new ContractFactory(checkoutArtifact.abi, checkoutArtifact.evm.bytecode.object, merchant).deploy(await token.getAddress()); await checkout.waitForDeployment();
  await assert.rejects(checkout.connect(payer).pay(404));
  await (await checkout.createInvoice(100)).wait();
  await assert.rejects(checkout.pay(1));
});

test('rejects zero token address at construction', async (t) => {
  const eip1193 = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 1 } });
  t.after(() => eip1193.disconnect());
  const provider = new BrowserProvider(eip1193);
  const signer = await provider.getSigner(0);
  const factory = new ContractFactory(checkoutArtifact.abi, checkoutArtifact.evm.bytecode.object, signer);
  await assert.rejects(factory.deploy('0x0000000000000000000000000000000000000000'));
});

test('failed transferFrom leaves invoice unpaid and balances unchanged', async (t) => {
  const eip1193 = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 2 } });
  t.after(() => eip1193.disconnect());
  const provider = new BrowserProvider(eip1193);
  const merchant = await provider.getSigner(0);
  const payer = await provider.getSigner(1);
  const token = await new ContractFactory(tokenArtifact.abi, tokenArtifact.evm.bytecode.object, merchant).deploy();
  await token.waitForDeployment();
  const checkout = await new ContractFactory(checkoutArtifact.abi, checkoutArtifact.evm.bytecode.object, merchant).deploy(await token.getAddress());
  await checkout.waitForDeployment();
  const amount = parseUnits('3', 6);
  await (await checkout.createInvoice(amount)).wait();
  await (await token.mint(await payer.getAddress(), amount)).wait();

  // A zero allowance makes transferFrom revert; invoice state must roll back atomically.
  await assert.rejects(async () => (await checkout.connect(payer).pay(1, { gasLimit: 200_000 })).wait());
  assert.equal((await checkout.invoices(1)).payer, '0x0000000000000000000000000000000000000000');
  assert.equal((await checkout.invoices(1)).paidAt, 0n);
  assert.equal(await token.balanceOf(await payer.getAddress()), amount);
  assert.equal(await token.balanceOf(await merchant.getAddress()), 0n);

  // After funding and exact approval, the same invoice can still be paid.
  await (await token.connect(payer).approve(await checkout.getAddress(), amount)).wait();
  await (await checkout.connect(payer).pay(1)).wait();
  assert.equal((await checkout.invoices(1)).payer, await payer.getAddress());
  assert.equal(await token.balanceOf(await merchant.getAddress()), amount);
});
