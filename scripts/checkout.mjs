import { ContractFactory, Contract, JsonRpcProvider, Wallet, parseUnits, isAddress } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const ROOT = path.resolve(import.meta.dirname, '..');
const RPC = process.env.AEVUM_RPC_URL || 'https://rpc-test.qday.info';
const EXPECTED_CHAIN_ID = 44005n;
const ABI = [
  'function createInvoice(uint256 amount) returns (uint256)',
  'function pay(uint256 invoiceId)',
  'function invoices(uint256) view returns (address merchant,uint256 amount,uint64 createdAt,address payer,uint64 paidAt)',
  'function token() view returns (address)',
  'event InvoiceCreated(uint256 indexed invoiceId,address indexed merchant,uint256 amount)',
  'event InvoicePaid(uint256 indexed invoiceId,address indexed payer,address indexed merchant,uint256 amount)',
];
const ERC20_ABI = ['function decimals() view returns (uint8)', 'function approve(address,uint256) returns (bool)'];

function compile() {
  const source = fs.readFileSync(path.join(ROOT, 'contracts/Checkout.sol'), 'utf8');
  const input = { language: 'Solidity', sources: { 'Checkout.sol': { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === 'error');
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join('\n'));
  return output.contracts['Checkout.sol'].Checkout;
}
function signer(provider) {
  if (!process.env.PRIVATE_KEY) throw new Error('Set PRIVATE_KEY in your environment (testnet key only). Never paste it into project files.');
  return new Wallet(process.env.PRIVATE_KEY, provider);
}
async function providerChecked() {
  const provider = new JsonRpcProvider(RPC);
  const network = await provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) throw new Error(`Wrong chain ${network.chainId}; expected Aevum Testnet ${EXPECTED_CHAIN_ID}. Refusing to sign.`);
  return provider;
}
function requiredAddress(name) {
  const v = process.env[name];
  if (!v || !isAddress(v)) throw new Error(`Set ${name} to a verified 0x address.`);
  return v;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const usage = 'Usage: npm run compile | npm run deploy | npm run invoice -- <amount> | npm run pay -- <invoiceId>';
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`${usage}\n\ncompile is local-only. Other commands require a reachable RPC reporting chain ID ${EXPECTED_CHAIN_ID}.`);
    return;
  }
  if (!['compile', 'deploy', 'invoice', 'pay'].includes(command)) {
    throw new Error(`${usage}\nRun npm run compile for an offline build; deploy, invoice, and pay use the configured network.`);
  }
  if (command === 'compile') {
    const artifact = compile();
    console.log(`Compiled Checkout (${artifact.evm.bytecode.object.length / 2} byte creation bytecode).`);
    return;
  }
  const provider = await providerChecked();
  const wallet = signer(provider);
  if (command === 'deploy') {
    const token = requiredAddress('TUSD8_ADDRESS');
    const artifact = compile();
    const factory = new ContractFactory(artifact.abi, artifact.evm.bytecode.object, wallet);
    const contract = await factory.deploy(token);
    await contract.waitForDeployment();
    console.log(`Checkout deployed: ${await contract.getAddress()}`);
    return;
  }
  if (command === 'invoice') {
    const checkout = new Contract(requiredAddress('CHECKOUT_ADDRESS'), ABI, wallet);
    const token = new Contract(await checkout.token(), ERC20_ABI, provider);
    const decimals = Number(await token.decimals());
    const amount = parseUnits(args[0] || '', decimals);
    const tx = await checkout.createInvoice(amount);
    const receipt = await tx.wait();
    const iface = checkout.interface;
    const event = receipt.logs.map((log) => { try { return iface.parseLog(log); } catch { return null; } }).find((e) => e?.name === 'InvoiceCreated');
    if (!event) throw new Error('InvoiceCreated event missing from receipt');
    console.log(`Invoice ${event.args.invoiceId} created for ${args[0]} tokens; tx ${receipt.hash}`);
    return;
  }
  if (command === 'pay') {
    const invoiceId = args[0];
    if (!/^\d+$/.test(invoiceId || '')) throw new Error('Usage: pay <invoiceId>');
    const checkoutAddress = requiredAddress('CHECKOUT_ADDRESS');
    const checkout = new Contract(checkoutAddress, ABI, wallet);
    const invoice = await checkout.invoices(invoiceId);
    if (invoice.payer !== '0x0000000000000000000000000000000000000000') throw new Error('Invoice already paid');
    const token = new Contract(await checkout.token(), ERC20_ABI, wallet);
    const approval = await token.approve(checkoutAddress, invoice.amount);
    await approval.wait();
    const tx = await checkout.pay(invoiceId);
    const receipt = await tx.wait();
    console.log(`Paid invoice ${invoiceId}; tx ${receipt.hash}`);
    return;
  }
}
main().catch((err) => { console.error(err.shortMessage || err.message); process.exitCode = 1; });
