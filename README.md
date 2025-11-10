# Pyro-Labs SDK

A comprehensive TypeScript SDK for interacting with Solana and EVM chains. Send transactions, interact with smart contracts, and build cross-chain applications with ease.

## Features

- 🚀 **Multi-Chain Support**: Ethereum, Polygon, Arbitrum, Optimism, Base, and Solana
- 🔒 **Type-Safe**: Full TypeScript support with excellent IDE experience
- ⚡ **Testnet Ready**: Built-in support for all major testnets
- 🎯 **Simple API**: Clean, intuitive interface for common operations
- 🔧 **Advanced Features**: Atomic transactions, contract calls, Flashbots support
- 📦 **Modular**: Install only what you need

## Installation

```bash
npm install @pyro-labs/evm-sdk @pyro-labs/solana-sdk
# or
pnpm add @pyro-labs/evm-sdk @pyro-labs/solana-sdk
# or
yarn add @pyro-labs/evm-sdk @pyro-labs/solana-sdk
```

## Quick Start

### Solana

```typescript
import { SolanaSDK } from "@pyro-labs/solana-sdk";
import { Keypair } from "@solana/web3.js";

// Initialize SDK
const sdk = new SolanaSDK({
  network: "mainnet-beta", // or "testnet", "devnet"
});

const wallet = Keypair.generate();

// Send SOL
const result = await sdk.send(
  wallet,
  "RecipientAddress...",
  1000000, // lamports
  { waitForConfirmation: true }
);
```

### EVM (Ethereum, Polygon, etc.)

```typescript
import { EVMSDK } from "@pyro-labs/evm-sdk";
import { Wallet } from "ethers";

// Initialize SDK
const sdk = new EVMSDK({
  network: "mainnet", // or "sepolia", "polygon", "arbitrum", etc.
});

const wallet = new Wallet("private-key");

// Send ETH
const result = await sdk.send(
  wallet,
  "0xRecipientAddress...",
  "1000000000000000000", // 1 ETH in wei
  { waitForConfirmation: true, maxConfirmations: 3 }
);
```

## Packages

| Package                 | Description                                       | Install                             |
| ----------------------- | ------------------------------------------------- | ----------------------------------- |
| `@pyro-labs/evm-sdk`    | EVM chain SDK (Ethereum, Polygon, Arbitrum, etc.) | `npm install @pyro-labs/evm-sdk`    |
| `@pyro-labs/solana-sdk` | Solana SDK                                        | `npm install @pyro-labs/solana-sdk` |
| `@pyro-labs/core`       | Core types and interfaces                         | `npm install @pyro-labs/core`       |
| `@pyro-labs/utils`      | Utility functions and logger                      | `npm install @pyro-labs/utils`      |
| `@pyro-labs/periphery`  | Periphery utilities (fee wrapper, flashloans)     | `npm install @pyro-labs/periphery`  |
| `@pyro-labs/unoswap`    | Unoswap quoter                                    | `npm install @pyro-labs/unoswap`    |

## Examples

### Send SPL Token (Solana)

```typescript
const result = await sdk.send(
  wallet,
  "RecipientAddress...",
  BigInt("1000000"),
  { waitForConfirmation: true },
  "TokenMintAddress..." // SPL token mint
);
```

### Atomic Transaction (Solana)

```typescript
import { TransactionInstruction, SystemProgram } from "@solana/web3.js";

const instructions = [
  SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: new PublicKey("Address1..."),
    lamports: 1000000,
  }),
  SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: new PublicKey("Address2..."),
    lamports: 2000000,
  }),
];

// All succeed or all fail
const result = await sdk.sendAtomicTransaction(wallet, instructions);
```

### Send ERC20 Token (EVM)

```typescript
const result = await sdk.send(
  wallet,
  "0xRecipientAddress...",
  "1000000000000000000",
  { waitForConfirmation: true },
  "0xTokenContractAddress..." // ERC20 token
);
```

### Call Smart Contract (EVM)

```typescript
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
];

// Write operation
const result = await sdk.callContractFunction(
  wallet,
  "0xTokenContractAddress...",
  ERC20_ABI,
  "transfer",
  ["0xRecipientAddress...", "1000000000000000000"],
  { waitForConfirmation: true }
);

// Read operation (no transaction)
const balance = await sdk.callContract(
  "0xTokenContractAddress...",
  ERC20_ABI,
  "balanceOf",
  ["0xOwnerAddress..."]
);
```

### Custom Transaction (Solana)

```typescript
import { Transaction, SystemProgram } from "@solana/web3.js";

const transaction = new Transaction();
transaction.add(
  SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: new PublicKey("RecipientAddress..."),
    lamports: 1000000,
  })
);

const result = await sdk.sendTransaction(wallet, transaction);
```

## Supported Networks

### EVM Chains

**Mainnets:**

- Ethereum (`mainnet`)
- Polygon (`polygon`)
- Arbitrum (`arbitrum`)
- Optimism (`optimism`)
- Base (`base`)

**Testnets:**

- Sepolia (`sepolia`)
- Holesky (`holesky`)
- Mumbai (`mumbai`)
- Arbitrum Sepolia (`arbitrum-sepolia`)
- Optimism Sepolia (`optimism-sepolia`)
- Base Sepolia (`base-sepolia`)

### Solana

- Mainnet (`mainnet-beta`)
- Testnet (`testnet`)
- Devnet (`devnet`)

## Documentation

- [Full Documentation](https://github.com/DGrayArea/pyro-workspace)
- [API Reference](https://github.com/DGrayArea/pyro-workspace)

## Requirements

- Node.js 18+
- TypeScript 5.0+ (recommended)

## License

MIT

## Links

- [GitHub](https://github.com/DGrayArea/pyro-workspace)
- [npm](https://www.npmjs.com/org/pyro)
