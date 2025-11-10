/**
 * @pyro/solana-sdk - Solana SDK for Pyro
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  TransactionSignature,
  Commitment,
  Finality,
  ParsedTransactionWithMeta,
  SystemProgram,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  RPCConfig,
  SendOptions,
  TransactionResult,
  RPCError,
  TransactionError,
  ValidationError,
  TimeoutError,
  SolanaNetwork,
} from "@pyro-labs/core";
import { sleep, retry, logger } from "@pyro-labs/utils";

// Network RPC URLs
const SOLANA_NETWORKS: Record<SolanaNetwork, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  testnet: "https://api.testnet.solana.com",
  devnet: "https://api.devnet.solana.com",
};

export interface SolanaSDKConfig {
  rpc?: RPCConfig | string;
  connection?: Connection;
  commitment?: Commitment;
  network?: SolanaNetwork;
}

export class SolanaSDK {
  private connection: Connection;
  private commitment: Commitment;

  constructor(config: SolanaSDKConfig = {}) {
    if (config.connection) {
      this.connection = config.connection;
    } else {
      let rpcUrl: string;

      if (config.network && SOLANA_NETWORKS[config.network]) {
        rpcUrl = SOLANA_NETWORKS[config.network];
      } else if (typeof config.rpc === "string") {
        rpcUrl = config.rpc;
      } else if (config.rpc?.url) {
        rpcUrl = config.rpc.url;
      } else {
        rpcUrl = SOLANA_NETWORKS["mainnet-beta"];
      }

      const connectionOptions: any = {
        commitment: config.commitment || "confirmed",
      };

      if (
        typeof config.rpc === "object" &&
        config.rpc &&
        "timeout" in config.rpc &&
        config.rpc.timeout
      ) {
        const timeout = config.rpc.timeout;
        connectionOptions.fetch = (url: string, options: any) =>
          fetch(url, {
            ...options,
            signal: AbortSignal.timeout(timeout),
          });
      }

      this.connection = new Connection(rpcUrl, connectionOptions);
    }

    this.commitment = config.commitment || "confirmed";
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
    try {
      // Validate inputs
      if (!from || !from.publicKey) {
        throw new ValidationError("Invalid sender keypair", "from");
      }

      if (
        amount === undefined ||
        amount === null ||
        amount === 0 ||
        amount === BigInt(0)
      ) {
        throw new ValidationError(
          "Amount must be greater than zero",
          "amount",
          { amount }
        );
      }

      let toPublicKey: PublicKey;
      try {
        toPublicKey = typeof to === "string" ? new PublicKey(to) : to;
      } catch (error) {
        throw new ValidationError("Invalid recipient address", "to", {
          to,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      logger.debug("Sending transaction", {
        to: toPublicKey.toString(),
        amount,
        tokenMint,
        options,
      });

      const transaction = new Transaction();

      if (tokenMint) {
        // Send SPL token
        let mintPublicKey: PublicKey;
        try {
          mintPublicKey =
            typeof tokenMint === "string"
              ? new PublicKey(tokenMint)
              : tokenMint;
        } catch (error) {
          throw new ValidationError("Invalid token mint address", "tokenMint", {
            tokenMint,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        const tokenAmount =
          typeof amount === "bigint" ? amount : BigInt(amount);

        try {
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
        } catch (error) {
          logger.error("Failed to create SPL token transfer", error, {
            tokenMint: mintPublicKey.toString(),
            to: toPublicKey.toString(),
          });
          throw new TransactionError(
            `Failed to create SPL token transfer: ${error instanceof Error ? error.message : String(error)}`,
            undefined,
            "failed",
            { tokenMint: mintPublicKey.toString(), to: toPublicKey.toString() }
          );
        }
      } else {
        // Send native SOL
        const lamports = typeof amount === "bigint" ? Number(amount) : amount;
        try {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: from.publicKey,
              toPubkey: toPublicKey,
              lamports,
            })
          );
        } catch (error) {
          logger.error("Failed to create SOL transfer instruction", error, {
            to: toPublicKey.toString(),
            lamports,
          });
          throw new TransactionError(
            `Failed to create SOL transfer instruction: ${error instanceof Error ? error.message : String(error)}`,
            undefined,
            "failed",
            { to: toPublicKey.toString(), lamports }
          );
        }
      }

      let signature: TransactionSignature;
      try {
        signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [from],
          {
            commitment:
              (options.confirmationStatus as Commitment) || this.commitment,
            maxRetries: options.confirmationTimeout ? undefined : 0,
          }
        );
      } catch (error) {
        logger.error("Failed to send and confirm transaction", error, {
          from: from.publicKey.toString(),
          to: toPublicKey.toString(),
        });
        throw new TransactionError(
          `Failed to send transaction: ${error instanceof Error ? error.message : String(error)}`,
          undefined,
          "failed",
          { from: from.publicKey.toString(), to: toPublicKey.toString() }
        );
      }

      logger.info("Transaction sent", { txHash: signature });

      if (options.waitForConfirmation !== false) {
        return await this.waitForConfirmation(
          signature,
          options.confirmationStatus || "confirmed",
          options.confirmationTimeout,
          options.maxConfirmations
        );
      }

      return {
        txHash: signature,
        status: "pending",
      };
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof TransactionError
      ) {
        throw error;
      }
      logger.error("Unexpected error in send method", error);
      throw new TransactionError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        "failed"
      );
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(
    signature: TransactionSignature,
    status: "confirmed" | "finalized" | "processed" = "confirmed",
    timeout?: number,
    maxConfirmations?: number
  ): Promise<TransactionResult> {
    const commitment: Commitment =
      status === "processed"
        ? "processed"
        : status === "finalized"
          ? "finalized"
          : "confirmed";

    const startTime = Date.now();
    const timeoutMs = timeout ? timeout * 1000 : 30000; // Default 30 seconds

    logger.debug("Waiting for transaction confirmation", {
      signature,
      status,
      timeout,
      maxConfirmations,
    });

    while (Date.now() - startTime < timeoutMs) {
      try {
        const signatureStatus = await retry(
          () => this.connection.getSignatureStatus(signature),
          3,
          1000
        ).catch((error) => {
          logger.warn("Failed to get signature status, retrying", {
            signature,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        });

        if (signatureStatus.value) {
          if (signatureStatus.value.err) {
            logger.error("Transaction failed", undefined, {
              signature,
              err: signatureStatus.value.err,
            });
            throw new TransactionError(
              `Transaction failed: ${JSON.stringify(signatureStatus.value.err)}`,
              signature,
              "failed",
              { err: signatureStatus.value.err }
            );
          }

          if (
            signatureStatus.value.confirmationStatus === commitment ||
            (commitment === "confirmed" &&
              signatureStatus.value.confirmationStatus === "finalized")
          ) {
            const slot = signatureStatus.value.slot;
            if (slot) {
              const finality: Finality =
                commitment === "processed" ? "confirmed" : commitment;
              const blockInfo = await retry(
                () => this.connection.getBlock(slot, { commitment: finality }),
                3,
                1000
              );

              const result = {
                txHash: signature,
                blockNumber: slot,
                blockHash: blockInfo?.blockhash,
                confirmations: signatureStatus.value.confirmations || 0,
                status: "confirmed" as const,
              };

              logger.info("Transaction confirmed", {
                signature,
                slot,
                confirmations: result.confirmations,
              });
              return result;
            }
          }

          if (maxConfirmations && signatureStatus.value.confirmations) {
            if (signatureStatus.value.confirmations >= maxConfirmations) {
              const slot = signatureStatus.value.slot;
              if (slot) {
                const finality: Finality =
                  commitment === "processed" ? "confirmed" : commitment;
                const blockInfo = await retry(
                  () =>
                    this.connection.getBlock(slot, { commitment: finality }),
                  3,
                  1000
                );

                const result = {
                  txHash: signature,
                  blockNumber: slot,
                  blockHash: blockInfo?.blockhash,
                  confirmations: signatureStatus.value.confirmations,
                  status: "confirmed" as const,
                };

                logger.info("Transaction confirmed", {
                  signature,
                  slot,
                  confirmations: result.confirmations,
                });
                return result;
              }
            }
          }
        }

        await sleep(500);
      } catch (error) {
        // If it's a TransactionError, rethrow it
        if (error instanceof TransactionError) {
          throw error;
        }
        // Continue polling on other errors
        logger.debug(
          "Error while waiting for confirmation, continuing to poll",
          {
            signature,
            error: error instanceof Error ? error.message : String(error),
          }
        );
        await sleep(500);
      }
    }

    // Timeout reached
    logger.warn("Transaction confirmation timeout", {
      signature,
      timeout: timeoutMs,
    });
    throw new TimeoutError(
      `Transaction confirmation timeout after ${timeoutMs / 1000} seconds`,
      timeoutMs / 1000,
      { signature, status, maxConfirmations }
    );
  }

  /**
   * Receive transaction information
   */
  async receive(txHash: string): Promise<ParsedTransactionWithMeta | null> {
    try {
      if (!txHash || txHash.length === 0) {
        throw new ValidationError("Invalid transaction hash", "txHash", {
          txHash,
        });
      }

      logger.debug("Fetching transaction", { txHash });
      const finality: Finality =
        this.commitment === "processed" ||
        this.commitment === "recent" ||
        this.commitment === "single" ||
        this.commitment === "singleGossip" ||
        this.commitment === "root" ||
        this.commitment === "max"
          ? "confirmed"
          : this.commitment;
      const transaction = await this.connection.getParsedTransaction(txHash, {
        commitment: finality,
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction) {
        logger.warn("Transaction not found", { txHash });
      } else {
        logger.debug("Transaction retrieved", {
          txHash,
          slot: transaction.slot,
        });
      }

      return transaction;
    } catch (error) {
      logger.error("Failed to receive transaction", error, { txHash });
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new RPCError(
        `Failed to get transaction: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        undefined,
        { txHash }
      );
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<TransactionResult> {
    try {
      if (!txHash || txHash.length === 0) {
        throw new ValidationError("Invalid transaction hash", "txHash", {
          txHash,
        });
      }

      logger.debug("Getting transaction status", { txHash });
      const status = await this.connection.getSignatureStatus(txHash);

      if (!status.value) {
        logger.debug("Transaction not found, returning pending status", {
          txHash,
        });
        return {
          txHash,
          status: "pending",
        };
      }

      if (status.value.err) {
        logger.warn("Transaction failed", { txHash, err: status.value.err });
        return {
          txHash,
          status: "failed",
        };
      }

      const slot = status.value.slot;
      if (!slot) {
        return {
          txHash,
          status: "pending",
        };
      }

      const finality: Finality =
        this.commitment === "processed" ||
        this.commitment === "recent" ||
        this.commitment === "single" ||
        this.commitment === "singleGossip" ||
        this.commitment === "root" ||
        this.commitment === "max"
          ? "confirmed"
          : this.commitment;
      const blockInfo = await this.connection.getBlock(slot, {
        commitment: finality,
      });

      const result = {
        txHash,
        blockNumber: slot,
        blockHash: blockInfo?.blockhash,
        confirmations: status.value.confirmations || 0,
        status: "confirmed" as const,
      };

      logger.debug("Transaction status retrieved", {
        txHash,
        status: result.status,
        confirmations: result.confirmations,
      });
      return result;
    } catch (error) {
      logger.error("Failed to get transaction status", error, { txHash });
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new RPCError(
        `Failed to get transaction status: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        undefined,
        { txHash }
      );
    }
  }

  /**
   * Send a custom Transaction object
   * @param from - Sender keypair
   * @param transaction - Pre-built Transaction object
   * @param options - Send options including confirmation settings
   */
  async sendTransaction(
    from: Keypair,
    transaction: Transaction,
    options: SendOptions = {}
  ): Promise<TransactionResult> {
    try {
      if (!from || !from.publicKey) {
        throw new ValidationError("Invalid sender keypair", "from");
      }

      if (!transaction) {
        throw new ValidationError("Transaction cannot be null", "transaction");
      }

      logger.debug("Sending custom transaction", {
        from: from.publicKey.toString(),
        instructions: transaction.instructions.length,
        options,
      });

      // Get recent blockhash if not set
      if (!transaction.recentBlockhash) {
        const { blockhash } = await retry(
          () => this.connection.getLatestBlockhash(this.commitment),
          3,
          1000
        );
        transaction.recentBlockhash = blockhash;
      }

      // Set fee payer if not set
      if (!transaction.feePayer) {
        transaction.feePayer = from.publicKey;
      }

      // Sign transaction
      transaction.sign(from);

      let signature: TransactionSignature;
      try {
        signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [from],
          {
            commitment:
              (options.confirmationStatus as Commitment) || this.commitment,
            maxRetries: options.confirmationTimeout ? undefined : 0,
          }
        );
      } catch (error) {
        logger.error("Failed to send transaction", error, {
          from: from.publicKey.toString(),
        });
        throw new TransactionError(
          `Failed to send transaction: ${error instanceof Error ? error.message : String(error)}`,
          undefined,
          "failed",
          { from: from.publicKey.toString() }
        );
      }

      logger.info("Transaction sent", { txHash: signature });

      if (options.waitForConfirmation !== false) {
        return await this.waitForConfirmation(
          signature,
          options.confirmationStatus || "confirmed",
          options.confirmationTimeout,
          options.maxConfirmations
        );
      }

      return {
        txHash: signature,
        status: "pending",
      };
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof TransactionError
      ) {
        throw error;
      }
      logger.error("Unexpected error in sendTransaction method", error);
      throw new TransactionError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        "failed"
      );
    }
  }

  /**
   * Send an atomic transaction (multiple instructions in one transaction)
   * @param from - Sender keypair
   * @param instructions - Array of TransactionInstruction objects
   * @param options - Send options including confirmation settings
   */
  async sendAtomicTransaction(
    from: Keypair,
    instructions: TransactionInstruction[],
    options: SendOptions = {}
  ): Promise<TransactionResult> {
    try {
      if (!from || !from.publicKey) {
        throw new ValidationError("Invalid sender keypair", "from");
      }

      if (!instructions || instructions.length === 0) {
        throw new ValidationError(
          "Instructions array cannot be empty",
          "instructions"
        );
      }

      logger.debug("Sending atomic transaction", {
        from: from.publicKey.toString(),
        instructionCount: instructions.length,
        options,
      });

      const transaction = new Transaction();

      // Add all instructions
      for (const instruction of instructions) {
        transaction.add(instruction);
      }

      // Get recent blockhash
      const { blockhash } = await retry(
        () => this.connection.getLatestBlockhash(this.commitment),
        3,
        1000
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = from.publicKey;

      // Sign transaction
      transaction.sign(from);

      let signature: TransactionSignature;
      try {
        signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [from],
          {
            commitment:
              (options.confirmationStatus as Commitment) || this.commitment,
            maxRetries: options.confirmationTimeout ? undefined : 0,
          }
        );
      } catch (error) {
        logger.error("Failed to send atomic transaction", error, {
          from: from.publicKey.toString(),
          instructionCount: instructions.length,
        });
        throw new TransactionError(
          `Failed to send atomic transaction: ${error instanceof Error ? error.message : String(error)}`,
          undefined,
          "failed",
          {
            from: from.publicKey.toString(),
            instructionCount: instructions.length,
          }
        );
      }

      logger.info("Atomic transaction sent", { txHash: signature });

      if (options.waitForConfirmation !== false) {
        return await this.waitForConfirmation(
          signature,
          options.confirmationStatus || "confirmed",
          options.confirmationTimeout,
          options.maxConfirmations
        );
      }

      return {
        txHash: signature,
        status: "pending",
      };
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof TransactionError
      ) {
        throw error;
      }
      logger.error("Unexpected error in sendAtomicTransaction method", error);
      throw new TransactionError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        "failed"
      );
    }
  }
}
