/**
 * Tests for @pyro/solana-sdk
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SolanaSDK } from './index';
import { Keypair, Connection } from '@solana/web3.js';
import { ValidationError } from '@pyro-labs/core';

// Mock Solana web3.js
vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js');
  return {
    ...actual,
    Connection: vi.fn(),
  };
});

describe('SolanaSDK', () => {
  let mockConnection: any;

  beforeEach(() => {
    mockConnection = {
      getSignatureStatus: vi.fn(),
      getBlock: vi.fn(),
      getParsedTransaction: vi.fn(),
      createTransferInstruction: vi.fn(),
    };

    (Connection as any).mockImplementation(() => mockConnection);
  });

  describe('constructor', () => {
    it('should create SDK with default RPC', () => {
      const sdk = new SolanaSDK();
      expect(sdk).toBeDefined();
    });

    it('should create SDK with custom RPC', () => {
      const sdk = new SolanaSDK({ rpc: 'https://custom-rpc.com' });
      expect(sdk).toBeDefined();
    });

    it('should create SDK with connection', () => {
      const sdk = new SolanaSDK({ connection: mockConnection });
      expect(sdk.getConnection()).toBe(mockConnection);
    });
  });

  describe('send', () => {
    it('should validate sender keypair', async () => {
      const sdk = new SolanaSDK({ connection: mockConnection });
      const invalidKeypair = null as any;

      await expect(
        sdk.send(invalidKeypair, '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 1000000)
      ).rejects.toThrow(ValidationError);
    });

    it('should validate amount', async () => {
      const sdk = new SolanaSDK({ connection: mockConnection });
      const keypair = Keypair.generate();

      await expect(
        sdk.send(keypair, '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 0)
      ).rejects.toThrow(ValidationError);
    });

    it('should validate recipient address', async () => {
      const sdk = new SolanaSDK({ connection: mockConnection });
      const keypair = Keypair.generate();

      await expect(
        sdk.send(keypair, 'invalid-address', 1000000)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('receive', () => {
    it('should validate transaction hash', async () => {
      const sdk = new SolanaSDK({ connection: mockConnection });

      await expect(
        sdk.receive('')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getTransactionStatus', () => {
    it('should validate transaction hash', async () => {
      const sdk = new SolanaSDK({ connection: mockConnection });

      await expect(
        sdk.getTransactionStatus('')
      ).rejects.toThrow(ValidationError);
    });
  });
});



