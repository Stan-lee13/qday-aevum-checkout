import fs from 'node:fs';
import path from 'node:path';
import { BrowserProvider, Contract, ContractFactory, formatUnits, parseUnits } from 'ethers';
import ganache from 'ganache';
import solc from 'solc';

const ROOT = path.resolve(import.meta.dirname, '..');
const MOCK_TOKEN_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract LocalMockUSD8 {
    string public constant name = "Local Mock USD8";
    string public constant symbol = "mUSD8";
    uint8 public constant decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        require(balanceOf[from] >= amount, "balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}`;

function compile() {
  const checkout = fs.readFileSync(path.join(ROOT, 'contracts/Checkout.sol'), 'utf8');
  const input = {
    language: 'Solidity',
    sources: {
      'Checkout.sol': { content: checkout },
      'LocalMockUSD8.sol': { content: MOCK_TOKEN_SOURCE },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((error) => error.severity === 'error');
  if (errors.length) throw new Error(errors.map((error) => error.formattedMessage).join('\n'));
  return output.contracts;
}

function parseEvent(contract, receipt, name) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === name) return parsed;
    } catch {
      // Ignore logs emitted by the token or other contracts.
    }
  }
  throw new Error(`Missing ${name} event`);
}

async function main() {
  console.log('LOCAL PROTOTYPE DEMO — in-memory Ganache + mock six-decimal token');
  console.log('Not Aevum. No public network, real asset, or external transaction is used.\n');

  const artifacts = compile();
  const tokenArtifact = artifacts['LocalMockUSD8.sol'].LocalMockUSD8;
  const checkoutArtifact = artifacts['Checkout.sol'].Checkout;
  const eip1193 = ganache.provider({
    chain: { chainId: 31337 },
    wallet: { totalAccounts: 2 },
    logging: { quiet: true },
  });

  try {
    const provider = new BrowserProvider(eip1193);
    const network = await provider.getNetwork();
    if (network.chainId !== 31337n) throw new Error(`Unexpected local chain ID ${network.chainId}`);
    const merchant = await provider.getSigner(0);
    const payer = await provider.getSigner(1);
    const merchantAddress = await merchant.getAddress();
    const payerAddress = await payer.getAddress();

    const token = await new ContractFactory(tokenArtifact.abi, tokenArtifact.evm.bytecode.object, merchant).deploy();
    await token.waitForDeployment();
    const checkout = await new ContractFactory(checkoutArtifact.abi, checkoutArtifact.evm.bytecode.object, merchant)
      .deploy(await token.getAddress());
    await checkout.waitForDeployment();

    const amount = parseUnits('12.34', 6);
    await (await token.mint(payerAddress, amount)).wait();
    const invoiceReceipt = await (await checkout.createInvoice(amount)).wait();
    const invoiceEvent = parseEvent(checkout, invoiceReceipt, 'InvoiceCreated');
    const invoiceId = invoiceEvent.args.invoiceId;

    console.log(`Local chain: ${network.chainId}`);
    console.log(`Token: ${await token.getAddress()} (mock mUSD8, 6 decimals)`);
    console.log(`Checkout: ${await checkout.getAddress()}`);
    console.log(`Invoice: #${invoiceId} for ${formatUnits(amount, 6)} mUSD8`);
    console.log(`Merchant: ${merchantAddress}`);
    console.log(`Payer: ${payerAddress}`);

    await (await token.connect(payer).approve(await checkout.getAddress(), amount)).wait();
    const paymentReceipt = await (await checkout.connect(payer).pay(invoiceId)).wait();
    const paidEvent = parseEvent(checkout, paymentReceipt, 'InvoicePaid');
    const invoice = await checkout.invoices(invoiceId);
    const [payerBalance, merchantBalance] = await Promise.all([
      token.balanceOf(payerAddress),
      token.balanceOf(merchantAddress),
    ]);

    if (paidEvent.args.invoiceId !== invoiceId || invoice.payer !== payerAddress ||
        merchantBalance !== amount || payerBalance !== 0n) {
      throw new Error('Demo postconditions failed');
    }

    console.log(`Payment: invoice #${paidEvent.args.invoiceId} marked paid`);
    console.log(`Payer balance after: ${formatUnits(payerBalance, 6)} mUSD8`);
    console.log(`Merchant received: ${formatUnits(merchantBalance, 6)} mUSD8`);
    console.log(`Payment transaction (local only): ${paymentReceipt.hash}`);
    console.log('\nDEMO COMPLETE — local test only; no Aevum deployment or payment occurred.');
  } finally {
    await eip1193.disconnect();
  }
}

main().catch((error) => {
  console.error(error.shortMessage || error.message);
  process.exitCode = 1;
});
