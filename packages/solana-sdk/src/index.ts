/**
 * @pyro/solana-sdk - Solana SDK for Pyro
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  TransactionSignature,
  Commitment,
  ParsedTransactionWithMeta,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { RPCConfig, SendOptions, TransactionResult } from '@pyro/core';
import { sleep, retry } from '@pyro/utils';

export interface SolanaSDKConfig {
  rpc?: RPCConfig | string;
  connection?: Connection;
  commitment?: Commitment;
}

export class SolanaSDK {
  private connection: Connection;
  private commitment: Commitment;

  constructor(config: SolanaSDKConfig = {}) {
    if (config.connection) {
      this.connection = config.connection;
    } else {
      const rpcUrl = typeof config.rpc === 'string' 
        ? config.rpc 
        : config.rpc?.url || 'https://api.mainnet-beta.solana.com';
      
      this.connection = new Connection(rpcUrl, {
        commitment: config.commitment || 'confirmed',
        ...(typeof config.rpc === 'object' && config.rpc.timeout 
          ? { fetch: (url, options) => 
              fetch(url, { ...options, signal: AbortSignal.timeout(config.rpc!.timeout!) })
            }
          : {}),
      });
    }
    
    this.commitment = config.commitment || 'confirmed';
  }

  /**
   * Get the connection instance
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Send SOL or SPL tokens to an address
   * @param from - Sender keypair
   * @param to - Recipient address (PublicKey or string)
   * @param amount - Amount to send (in lamports for SOL, in token decimals for SPL tokens)
   * @param options - Send options including confirmation settings
   * @param tokenMint - Optional SPL token mint address. If not provided, sends native SOL
   */
  async send(
    from: Keypair,
    to: string | PublicKey,
    amount: number | bigint,
    options: SendOptions = {},
    tokenMint?: string | PublicKey
  ): Promise<TransactionResult> {
    const toPublicKey = typeof to === 'string' ? new PublicKey(to) : to;
    const transaction = new Transaction();

    if (tokenMint) {
      // Send SPL token
      const mintPublicKey = typeof tokenMint === 'string' ? new PublicKey(tokenMint) : tokenMint;
      const tokenAmount = typeof amount === 'bigint' ? amount : BigInt(amount);

      // Get or create associated token accounts
      const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        from,
        mintPublicKey,
        from.publicKey
      );

      const toTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        from,
        mintPublicKey,
        toPublicKey
      );

      // Create transfer instruction
      transaction.add(
        createTransferInstruction(
          fromTokenAccount.address,
          toTokenAccount.address,
          from.publicKey,
          tokenAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );
    } else {
      // Send native SOL
      const lamports = typeof amount === 'bigint' ? Number(amount) : amount;
      transaction.add(
        await this.connection.createTransferInstruction(
          from.publicKey,
          toPublicKey,
          lamports
        )
      );
    }

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [from],
      {
        commitment: (options.confirmationStatus as Commitment) || this.commitment,
        maxRetries: options.confirmationTimeout ? undefined : 0,
      }
    );

    if (options.waitForConfirmation !== false) {
      return await this.waitForConfirmation(
        signature,
        options.confirmationStatus || 'confirmed',
        options.confirmationTimeout,
        options.maxConfirmations
      );
    }

    return {
      txHash: signature,
      status: 'pending',
    };
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(
    signature: TransactionSignature,
    status: 'confirmed' | 'finalized' | 'processed' = 'confirmed',
    timeout?: number,
    maxConfirmations?: number
  ): Promise<TransactionResult> {
    const commitment: Commitment = status === 'processed' 
      ? 'processed' 
      : status === 'finalized' 
      ? 'finalized' 
      : 'confirmed';

    const startTime = Date.now();
    const timeoutMs = timeout ? timeout * 1000 : 30000; // Default 30 seconds


    while (Date.now() - startTime < timeoutMs) {
      try {
        const signatureStatus = await this.connection.getSignatureStatus(signature);
        
        if (signatureStatus.value) {
          if (signatureStatus.value.err) {
            return {
              txHash: signature,
              status: 'failed',
            };
          }

          if (signatureStatus.value.confirmationStatus === commitment || 
              (commitment === 'confirmed' && signatureStatus.value.confirmationStatus === 'finalized')) {
            const slot = signatureStatus.value.slot;
            if (slot) {
              const blockInfo = await retry(
                () => this.connection.getBlock(slot, { commitment }),
                3,
                1000
              );

              return {
                txHash: signature,
                blockNumber: slot,
                blockHash: blockInfo?.blockhash,
                confirmations: signatureStatus.value.confirmations || 0,
                status: 'confirmed',
              };
            }
          }

          if (maxConfirmations && signatureStatus.value.confirmations) {
            if (signatureStatus.value.confirmations >= maxConfirmations) {
              const slot = signatureStatus.value.slot;
              if (slot) {
                const blockInfo = await retry(
                  () => this.connection.getBlock(slot, { commitment }),
                  3,
                  1000
                );

                return {
                  txHash: signature,
                  blockNumber: slot,
                  blockHash: blockInfo?.blockhash,
                  confirmations: signatureStatus.value.confirmations,
                  status: 'confirmed',
                };
              }
            }
          }
        }

        await sleep(500);
      } catch (error) {
        // Continue polling on error
        await sleep(500);
      }
    }

    // Timeout reached
    return {
      txHash: signature,
      status: 'pending',
    };
  }

  /**
   * Receive transaction information
   */
  async receive(txHash: string): Promise<ParsedTransactionWithMeta | null> {
    return await this.connection.getParsedTransaction(txHash, {
      commitment: this.commitment,
      maxSupportedTransactionVersion: 0,
    });
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<TransactionResult> {
    const status = await this.connection.getSignatureStatus(txHash);
    
    if (!status.value) {
      return {
        txHash,
        status: 'pending',
      };
    }

    if (status.value.err) {
      return {
        txHash,
        status: 'failed',
      };
    }

    const slot = status.value.slot;
    const blockInfo = await this.connection.getBlock(slot, { commitment: this.commitment });

    return {
      txHash,
      blockNumber: slot,
      blockHash: blockInfo?.blockhash,
      confirmations: status.value.confirmations || 0,
      status: 'confirmed',
    };
  }
}

