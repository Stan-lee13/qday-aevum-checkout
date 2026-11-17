# Aevum Checkout — a tUSD8 invoice payment flow

A small EVM checkout for the QDay Aevum Builder Challenge. A merchant creates a fixed-amount invoice; a payer approves that exact amount and pays; the ERC-20 moves directly from payer to merchant. The contract holds no tokens and charges no fee. The included CLI can compile, deploy, create invoices, and pay them.

**Status: an end-to-end payment was completed and independently checked on Aevum Testnet (chain ID 44005).** The [public GitHub repository](https://github.com/Stan-lee13/qday-aevum-checkout) contains the project source and documentation. The DoraHacks profile/submission remains pending because required profile details are unknown; see [remaining blockers](#remaining-blockers). The local Ganache demo and its video remain separate mock evidence.

## Live Aevum testnet demonstration

Read-only RPC checks at block `3,431,749` confirmed the following. All transactions below were on QDay Aevum Testnet and used test assets only; no mainnet transaction or real funds were used.

| Item | Address / result |
| --- | --- |
| Checkout contract | [`0xF836126eefb455BAB211B2c010B4b8d018a586Ee`](https://explorer-test.qday.info/address/0xF836126eefb455BAB211B2c010B4b8d018a586Ee) |
| Merchant test wallet | `0x26eC7C4dD67bcf3feEB0CbE4C90E89B53398e513` |
| Payer test wallet | `0x5E18C526e673339DDd5EAF5e352650b7fa54e3Dd` |
| Contract token | tUSD8 at `0x456569838f1d43009A91ebA4263147Afd7233483` (6 decimals) |
| Invoice | Invoice `1`, created by the merchant for `2.50 tUSD8` |
| Payment | Payer approved exactly `2.50 tUSD8`; `InvoicePaid` and ERC-20 `Transfer` events confirm settlement to the merchant |
| Final balances | Merchant: `42.5 tUSD8`, `3.9993133492 tQDAY`; payer: `7.5 tUSD8`, `0.999827704 tQDAY` |

All six transaction receipts returned success:

| Action | Block | Transaction |
| --- | ---: | --- |
| Deploy `Checkout` | 3,431,610 | [0x22ad0ce11315ad4056e6a57c517d531a54a8ddf318dc2928bb9800d8ff460613](https://explorer-test.qday.info/tx/0x22ad0ce11315ad4056e6a57c517d531a54a8ddf318dc2928bb9800d8ff460613) |
| Send payer 1 tQDAY for testnet gas | 3,431,642 | [0x070fa4b32bac45ca04e200dec7813f3e6110087adcdcb43570c4195cbc440783](https://explorer-test.qday.info/tx/0x070fa4b32bac45ca04e200dec7813f3e6110087adcdcb43570c4195cbc440783) |
| Send payer 10 tUSD8 | 3,431,649 | [0xd3c18c346ae284c7ff39344db546c526f9c602814d8f7b3a4fe05248e6c3ad35](https://explorer-test.qday.info/tx/0xd3c18c346ae284c7ff39344db546c526f9c602814d8f7b3a4fe05248e6c3ad35) |
| Create invoice 1 for 2.50 tUSD8 | 3,431,682 | [0xa786fa3e45efd1a9a6f28478864a9ba34d61dc5dcabaa33adc2751eeb80da631](https://explorer-test.qday.info/tx/0xa786fa3e45efd1a9a6f28478864a9ba34d61dc5dcabaa33adc2751eeb80da631) |
| Approve checkout for exactly 2.50 tUSD8 | 3,431,699 | [0x1d6f0af146c4f238616c40e82781951b77303417c0f0a8ccafc6dc0ce8d8a654](https://explorer-test.qday.info/tx/0x1d6f0af146c4f238616c40e82781951b77303417c0f0a8ccafc6dc0ce8d8a654) |
| Pay invoice 1 | 3,431,709 | [0xfc4e7acd5d9f66c751129735c1177460d4a391b8e897c968dc9a4aa740133918](https://explorer-test.qday.info/tx/0xfc4e7acd5d9f66c751129735c1177460d4a391b8e897c968dc9a4aa740133918) |

The contract’s on-chain invoice record names the expected merchant and payer, and the payment event and token transfer agree on invoice `1` and amount `2.50`. The deployed runtime code is 1,349 bytes. The contract is **not source-verified on the explorer** as part of this work.

## Flow and limitations

1. Deploy `Checkout` with the tUSD8 ERC-20 address. The constructor rejects the zero address.
2. The merchant runs `invoice <amount>`. The CLI reads the token's `decimals()` and records a unique invoice.
3. The payer runs `pay <invoiceId>`. The CLI refuses to sign unless the RPC reports chain ID 44005, approves the invoice amount, then pays it.
4. The contract checks that the invoice exists and is unpaid, marks it paid, then calls `transferFrom(payer, merchant, amount)`. A failed token transfer reverts the record update atomically. `InvoicePaid` and the explorer receipt make settlement inspectable.

There is no custody, refund, partial payment, cancellation, fee, or admin key. Nonstandard `transferFrom` behavior is unsupported. This is an educational prototype, not audited production software.

## Verified Aevum references

| Setting | Verified value |
| --- | --- |
| Network | QDay Aevum Testnet |
| Chain ID | `44005` (`0xABE5`) |
| RPC | `https://rpc-test.qday.info` |
| WebSocket | `wss://rpc-test.qday.info` |
| Explorer | [https://explorer-test.qday.info](https://explorer-test.qday.info) |
| Native gas token | tQDAY, 18 decimals |
| Official faucet | [https://faucet.qday.info/en](https://faucet.qday.info/en) |
| Faucet contract (not tUSD8) | `0xE5074CBbd046AFb491EB8692abD6cF7ECCC6dEE5` |
| tUSD8 test token | `0x456569838f1d43009A91ebA4263147Afd7233483`, 6 decimals |
| Explorer API | `https://explorer-test.qday.info/api` |

Primary sources: [QDay Aevum getting started](https://qday.io/news/aevum-testnet-getting-started), [QDay official links and addresses](https://qday.io/official-links), [official faucet](https://faucet.qday.info/en), [Builder Challenge FAQ](https://qday.io/builder-challenge), [QDay stablecoin payments guide](https://qday.io/news/stablecoin-payments), and [challenge announcement](https://qday.io/news/aevum-builder-challenge-1). The challenge FAQ and stablecoin guide give the tUSD8 address and six decimals; the official-links page retrieved for this task listed the faucet but not tUSD8. The challenge calls for a working end-to-end tUSD8 payment flow, open-source code, a demo/prototype, and project documentation.

## Local tests and mock demo

Node.js 20+ and npm are required. Dependencies are pinned by `package-lock.json`.

```sh
npm ci
npm test
npm run compile
npm run demo
```

The tests compile and deploy the actual Solidity contract plus a test-only mock token to ephemeral local Ganache. Assertions cover exact direct settlement, invoice/payer event and state, zero amount, duplicate payment, unknown invoice, merchant self-payment, zero-token-address rejection, and atomic rollback when `transferFrom` fails because approval is missing. The retry assertion confirms a reverted attempt leaves the invoice payable. CLI help and unknown-command handling do not require an RPC.

`npm run demo` runs one complete invoice flow against the actual `Checkout.sol` contract on a fresh in-memory Ganache chain (chain ID 31337) and a mintable local mock token. It makes no external RPC calls and creates no persistent chain state. A separate 36-second silent video summarizes this local mock only; it is **not** live Aevum evidence and is not included in this repository.

Ganache emitted a warning that its optional µWS native binary was unavailable for this Node build and fell back to JavaScript. The local tests passed under that fallback. The earlier npm audit reported two production dependency advisories (one low, one high); inspect with `npm audit` before use in a higher-risk context.

## Reproducing another testnet run

A completed deployment and invoice already exist at the addresses above. To run a separate demo, first check the current official token address and use only fresh test-only wallets funded with test assets. Never use a real-value wallet key. Pass the private key through the process environment, not project files or command history. The CLI checks chain ID `44005` before signing.

```sh
export AEVUM_RPC_URL=https://rpc-test.qday.info
export TUSD8_ADDRESS=0x456569838f1d43009A91ebA4263147Afd7233483
export PRIVATE_KEY='<fresh testnet-only merchant key>'
npm run deploy
export CHECKOUT_ADDRESS='<new deployment address>'
npm run invoice -- 2.50
# Switch PRIVATE_KEY to a separate funded test-only payer wallet.
npm run pay -- <new invoice ID>
```

The payer needs enough tUSD8 and tQDAY. `pay` makes a token-approval transaction and a payment transaction. Review the addresses and network before signing.

## Remaining blockers

- Public source and documentation: [QDay Aevum Checkout repository](https://github.com/Stan-lee13/qday-aevum-checkout).
- The DoraHacks profile/submission is not complete. Required organization, community affiliation, and introduction details are unknown and have not been invented.
- The local mock video is not a live testnet demo. The on-chain transactions above are the live testnet evidence.
- The contract source has not been verified on Blockscout, and the contract has not been audited.

## Files
- `contracts/Checkout.sol` — invoice and payment contract.
- `scripts/checkout.mjs` — compile/deploy/invoice/pay CLI with chain-ID guard.
- `scripts/demo.mjs` — isolated local Ganache demonstration with a mock token.
- `test/checkout.test.mjs` — local EVM end-to-end and negative tests.
- `package.json`, `package-lock.json` — dependency manifest and lockfile.
- `LICENSE` — MIT license for this prototype.

## Security

No credentials, seed phrases, private keys, API keys, or sample secret values are stored in this repository. `.gitignore` excludes `.env` and key material. Review the dependency audit and independently audit the contract before using it beyond disposable testing. This prototype has no production security review.
