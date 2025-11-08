# Pyro SDK Monorepo

A comprehensive SDK for interacting with Solana and EVM chains, with support for transactions, swaps, NFTs, and more.

## Packages

- `@pyro/core` - Core types and interfaces
- `@pyro/utils` - Utility functions
- `@pyro/solana-sdk` - Solana SDK with send, receive, and transaction confirmation
- `@pyro/evm-sdk` - EVM SDK with send, receive, and transaction confirmation
- `@pyro/periphery` - Periphery contracts and utilities (fee wrapper, simulation, flashloans)
- `@pyro/unoswap` - Unoswap quoter for aggregating quotes across DEX versions and fee tiers

## Installation

```bash
pnpm install
```

## Building

```bash
pnpm build
```

## Usage

### Solana SDK

```typescript
import { SolanaSDK } from '@pyro/solana-sdk';
import { Keypair } from '@solana/web3.js';

const sdk = new SolanaSDK({
  rpc: 'https://api.mainnet-beta.solana.com',
  commitment: 'confirmed'
});

const wallet = Keypair.generate();

// Send native SOL
const result = await sdk.send(
  wallet,
  'RecipientAddress...',
  1000000, // lamports
  {
    waitForConfirmation: true,
    confirmationStatus: 'confirmed',
    confirmationTimeout: 30,
    maxConfirmations: 1
  }
);

// Send SPL token
const tokenResult = await sdk.send(
  wallet,
  'RecipientAddress...',
  BigInt('1000000'), // token amount (with decimals)
  {
    waitForConfirmation: true,
    confirmationStatus: 'confirmed',
  },
  'TokenMintAddress...' // SPL token mint address
);
```

### EVM SDK

```typescript
import { EVMSDK } from '@pyro/evm-sdk';
import { Wallet } from 'ethers';

const sdk = new EVMSDK({
  rpc: 'https://eth.llamarpc.com'
});

const wallet = new Wallet('private-key');

// Send native ETH
const result = await sdk.send(
  wallet,
  '0xRecipientAddress...',
  '1000000000000000000', // 1 ETH in wei
  {
    waitForConfirmation: true,
    maxConfirmations: 3,
    confirmationTimeout: 60
  }
);

// Send ERC20 token
const tokenResult = await sdk.send(
  wallet,
  '0xRecipientAddress...',
  '1000000000000000000', // token amount (with decimals)
  {
    waitForConfirmation: true,
    maxConfirmations: 3,
  },
  '0xTokenContractAddress...' // ERC20 token contract address
);
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Clean all packages
pnpm clean
```

