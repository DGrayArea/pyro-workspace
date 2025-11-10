/**
 * @pyro/evm-sdk - EVM SDK for Pyro
 */

import {
  JsonRpcProvider,
  Wallet,
  TransactionRequest,
  TransactionResponse,
  TransactionReceipt,
  Provider,
  Contract,
} from "ethers";
import {
  RPCConfig,
  SendOptions,
  TransactionResult,
  RPCError,
  TransactionError,
  ValidationError,
  TimeoutError,
  EVMNetwork,
} from "@pyro-labs/core";
import { bytesToHex, sleep, retry, logger } from "@pyro-labs/utils";

// ERC20 ABI for transfer function
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
];

// Network RPC URLs and Chain IDs
const EVM_NETWORKS: Record<EVMNetwork, { rpcUrl: string; chainId: number }> = {
  mainnet: {
    rpcUrl: "https://eth.llamarpc.com",
    chainId: 1,
  },
  sepolia: {
    rpcUrl: "https://rpc.sepolia.org",
    chainId: 11155111,
  },
  goerli: {
    rpcUrl: "https://rpc.ankr.com/eth_goerli",
    chainId: 5,
  },
  holesky: {
    rpcUrl: "https://rpc.holesky.ethpandaops.io",
    chainId: 17000,
  },
  polygon: {
    rpcUrl: "https://polygon-rpc.com",
    chainId: 137,
  },
  mumbai: {
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
    chainId: 80001,
  },
  arbitrum: {
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    chainId: 42161,
  },
  "arbitrum-sepolia": {
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    chainId: 421614,
  },
  optimism: {
    rpcUrl: "https://mainnet.optimism.io",
    chainId: 10,
  },
  "optimism-sepolia": {
    rpcUrl: "https://sepolia.optimism.io",
    chainId: 11155420,
  },
  base: {
    rpcUrl: "https://mainnet.base.org",
    chainId: 8453,
  },
  "base-sepolia": {
    rpcUrl: "https://sepolia.base.org",
    chainId: 84532,
  },
};

export interface EVMSDKConfig {
  rpc?: RPCConfig | string;
  provider?: Provider;
  chainId?: number;
  network?: EVMNetwork;
}

export interface ContractCallOptions extends SendOptions {
  abi?: any[];
  functionName: string;
  args?: any[];
}

export class EVMSDK {
  private provider: Provider;

  constructor(config: EVMSDKConfig = {}) {
    if (config.provider) {
      this.provider = config.provider;
    } else {
      let rpcUrl: string;
      let networkChainId: number | undefined;

      if (config.network && EVM_NETWORKS[config.network]) {
        rpcUrl = EVM_NETWORKS[config.network].rpcUrl;
        networkChainId = EVM_NETWORKS[config.network].chainId;
      } else if (typeof config.rpc === "string") {
        rpcUrl = config.rpc;
        networkChainId = config.chainId;
      } else if (config.rpc?.url) {
        rpcUrl = config.rpc.url;
        networkChainId = config.chainId;
      } else {
        rpcUrl = EVM_NETWORKS.mainnet.rpcUrl;
        networkChainId = EVM_NETWORKS.mainnet.chainId;
      }

      this.provider = new JsonRpcProvider(rpcUrl, networkChainId, {
        ...(typeof config.rpc === "object" && config.rpc.headers
          ? { staticNetwork: true }
          : {}),
      });
    }
  }

  /**
   * Get the provider instance
   */
  getProvider(): Provider {
    return this.provider;
  }

  /**
   * Send native currency (ETH, etc.) or ERC20 tokens to an address
   * @param wallet - Wallet to send from
   * @param to - Recipient address
   * @param amount - Amount to send (in wei for native currency, in token units for ERC20)
   * @param options - Send options including confirmation settings
   * @param tokenAddress - Optional ERC20 token address. If not provided, sends native currency
   */
  async send(
    wallet: Wallet,
    to: string,
    amount: string | bigint,
    options: SendOptions = {},
    tokenAddress?: string
  ): Promise<TransactionResult> {
    try {
      // Validate inputs
      if (!to || !to.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new ValidationError("Invalid recipient address", "to", { to });
      }

      // Convert to BigInt for validation
      const value = typeof amount === "bigint" ? amount : BigInt(amount || "0");
      
      if (
        amount === undefined ||
        amount === null ||
        amount === "" ||
        amount === "0" ||
        value === BigInt(0)
      ) {
        throw new ValidationError(
          "Amount must be greater than zero",
          "amount",
          { amount }
        );
      }

      if (tokenAddress && !tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new ValidationError("Invalid token address", "tokenAddress", {
          tokenAddress,
        });
      }

      logger.debug("Sending transaction", {
        to,
        amount,
        tokenAddress,
        options,
      });

      const connectedWallet = wallet.connect(this.provider);

      let txResponse: TransactionResponse;

      if (tokenAddress) {
        // Send ERC20 token
        const tokenContract = new Contract(
          tokenAddress,
          ERC20_ABI,
          connectedWallet
        );

        const txRequest: TransactionRequest = {
          to: tokenAddress,
          data: tokenContract.interface.encodeFunctionData("transfer", [
            to,
            value,
          ]),
        };

        // Set gas options if provided
        if (options.gasLimit) {
          txRequest.gasLimit =
            typeof options.gasLimit === "bigint"
              ? options.gasLimit
              : BigInt(options.gasLimit);
        }

        if (options.gasPrice) {
          txRequest.gasPrice =
            typeof options.gasPrice === "bigint"
              ? options.gasPrice
              : BigInt(options.gasPrice);
        }

        if (options.maxFeePerGas) {
          txRequest.maxFeePerGas =
            typeof options.maxFeePerGas === "bigint"
              ? options.maxFeePerGas
              : BigInt(options.maxFeePerGas);
        }

        if (options.maxPriorityFeePerGas) {
          txRequest.maxPriorityFeePerGas =
            typeof options.maxPriorityFeePerGas === "bigint"
              ? options.maxPriorityFeePerGas
              : BigInt(options.maxPriorityFeePerGas);
        }

        try {
          txResponse = await connectedWallet.sendTransaction(txRequest);
        } catch (error: any) {
          logger.error("Failed to send ERC20 token transaction", error, {
            tokenAddress,
            to,
            amount,
          });
          throw new TransactionError(
            `Failed to send ERC20 token transaction: ${error.message}`,
            undefined,
            "failed",
            { tokenAddress, to, amount, error: error.message }
          );
        }
      } else {
        // Send native currency
        const txRequest: TransactionRequest = {
          to,
          value,
        };

        // Set gas options if provided
        if (options.gasLimit) {
          txRequest.gasLimit =
            typeof options.gasLimit === "bigint"
              ? options.gasLimit
              : BigInt(options.gasLimit);
        }

        if (options.gasPrice) {
          txRequest.gasPrice =
            typeof options.gasPrice === "bigint"
              ? options.gasPrice
              : BigInt(options.gasPrice);
        }

        if (options.maxFeePerGas) {
          txRequest.maxFeePerGas =
            typeof options.maxFeePerGas === "bigint"
              ? options.maxFeePerGas
              : BigInt(options.maxFeePerGas);
        }

        if (options.maxPriorityFeePerGas) {
          txRequest.maxPriorityFeePerGas =
            typeof options.maxPriorityFeePerGas === "bigint"
              ? options.maxPriorityFeePerGas
              : BigInt(options.maxPriorityFeePerGas);
        }

        try {
          txResponse = await connectedWallet.sendTransaction(txRequest);
        } catch (error: any) {
          logger.error("Failed to send native currency transaction", error, {
            to,
            amount,
          });
          throw new TransactionError(
            `Failed to send native currency transaction: ${error.message}`,
            undefined,
            "failed",
            { to, amount, error: error.message }
          );
        }
      }

      logger.info("Transaction sent", { txHash: txResponse.hash });

      if (options.waitForConfirmation !== false) {
        return await this.waitForConfirmation(
          txResponse.hash,
          options.maxConfirmations || 1,
          options.confirmationTimeout
        );
      }

      return {
        txHash: txResponse.hash,
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
    txHash: string,
    maxConfirmations: number = 1,
    timeout?: number
  ): Promise<TransactionResult> {
    const startTime = Date.now();
    const timeoutMs = timeout ? timeout * 1000 : 60000; // Default 60 seconds

    logger.debug("Waiting for transaction confirmation", {
      txHash,
      maxConfirmations,
      timeout,
    });

    while (Date.now() - startTime < timeoutMs) {
      try {
        const receipt = await retry(
          () => this.provider.getTransactionReceipt(txHash),
          3,
          1000
        ).catch((error) => {
          logger.warn("Failed to get transaction receipt, retrying", {
            txHash,
            error: error.message,
          });
          throw error;
        });

        if (receipt) {
          // Check if we have enough confirmations
          if (maxConfirmations > 1) {
            const currentBlock = await this.provider.getBlockNumber();
            const confirmations = currentBlock - receipt.blockNumber + 1;

            if (confirmations >= maxConfirmations) {
              if (receipt.status === 0) {
                logger.error("Transaction failed", undefined, {
                  txHash,
                  receipt,
                });
                throw new TransactionError(
                  "Transaction failed",
                  txHash,
                  "failed",
                  { receipt }
                );
              }

              const result: TransactionResult = {
                txHash: receipt.hash,
                blockNumber: Number(receipt.blockNumber),
                blockHash: receipt.blockHash,
                confirmations: Number(confirmations),
                status: "confirmed" as const,
              };

              logger.info("Transaction confirmed", {
                txHash,
                confirmations,
                status: result.status,
              });
              return result;
            }
          } else {
            // Single confirmation is enough
            if (receipt.status === 0) {
              logger.error("Transaction failed", undefined, {
                txHash,
                receipt,
              });
              throw new TransactionError(
                "Transaction failed",
                txHash,
                "failed",
                { receipt }
              );
            }

            const result: TransactionResult = {
              txHash: receipt.hash,
              blockNumber: Number(receipt.blockNumber),
              blockHash: receipt.blockHash,
              confirmations: 1,
              status: "confirmed" as const,
            };

            logger.info("Transaction confirmed", {
              txHash,
              status: result.status,
            });
            return result;
          }
        }

        // Transaction not yet mined, wait and retry
        await sleep(2000);
      } catch (error) {
        // If it's a TransactionError, rethrow it
        if (error instanceof TransactionError) {
          throw error;
        }
        // Continue polling on other errors
        logger.debug(
          "Error while waiting for confirmation, continuing to poll",
          {
            txHash,
            error: error instanceof Error ? error.message : String(error),
          }
        );
        await sleep(2000);
      }
    }

    // Timeout reached
    logger.warn("Transaction confirmation timeout", {
      txHash,
      timeout: timeoutMs,
    });
    throw new TimeoutError(
      `Transaction confirmation timeout after ${timeoutMs / 1000} seconds`,
      timeoutMs / 1000,
      { txHash, maxConfirmations }
    );
  }

  /**
   * Receive transaction information
   */
  async receive(txHash: string): Promise<TransactionReceipt | null> {
    try {
      if (!txHash || !txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
        throw new ValidationError("Invalid transaction hash", "txHash", {
          txHash,
        });
      }

      logger.debug("Fetching transaction receipt", { txHash });
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        logger.warn("Transaction receipt not found", { txHash });
      } else {
        logger.debug("Transaction receipt retrieved", {
          txHash,
          blockNumber: receipt.blockNumber,
        });
      }

      return receipt;
    } catch (error) {
      logger.error("Failed to receive transaction", error, { txHash });
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new RPCError(
        `Failed to get transaction receipt: ${error instanceof Error ? error.message : String(error)}`,
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
      if (!txHash || !txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
        throw new ValidationError("Invalid transaction hash", "txHash", {
          txHash,
        });
      }

      logger.debug("Getting transaction status", { txHash });
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        logger.debug("Transaction not found, returning pending status", {
          txHash,
        });
        return {
          txHash,
          status: "pending",
        };
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;

      const result: TransactionResult = {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        blockHash: receipt.blockHash,
        confirmations: Number(confirmations),
        status:
          receipt.status === 1 ? ("confirmed" as const) : ("failed" as const),
      };

      logger.debug("Transaction status retrieved", {
        txHash,
        status: result.status,
        confirmations,
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
   * Send raw transaction data (bytes)
   */
  async sendRawTransaction(
    wallet: Wallet,
    to: string,
    data: string | Uint8Array,
    value?: string | bigint,
    options: SendOptions = {}
  ): Promise<TransactionResult> {
    try {
      // Validate inputs
      if (!to || !to.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new ValidationError("Invalid recipient address", "to", { to });
      }

      if (
        !data ||
        (typeof data === "string" && data.length === 0) ||
        (data instanceof Uint8Array && data.length === 0)
      ) {
        throw new ValidationError("Transaction data cannot be empty", "data");
      }

      logger.debug("Sending raw transaction", {
        to,
        dataLength: typeof data === "string" ? data.length : data.length,
        value,
        options,
      });

      const connectedWallet = wallet.connect(this.provider);

      const txRequest: TransactionRequest = {
        to,
        data: typeof data === "string" ? data : bytesToHex(data),
      };

      if (value !== undefined) {
        txRequest.value = typeof value === "bigint" ? value : BigInt(value);
      }

      if (options.gasLimit) {
        txRequest.gasLimit =
          typeof options.gasLimit === "bigint"
            ? options.gasLimit
            : BigInt(options.gasLimit);
      }

      if (options.gasPrice) {
        txRequest.gasPrice =
          typeof options.gasPrice === "bigint"
            ? options.gasPrice
            : BigInt(options.gasPrice);
      }

      if (options.maxFeePerGas) {
        txRequest.maxFeePerGas =
          typeof options.maxFeePerGas === "bigint"
            ? options.maxFeePerGas
            : BigInt(options.maxFeePerGas);
      }

      if (options.maxPriorityFeePerGas) {
        txRequest.maxPriorityFeePerGas =
          typeof options.maxPriorityFeePerGas === "bigint"
            ? options.maxPriorityFeePerGas
            : BigInt(options.maxPriorityFeePerGas);
      }

      let txResponse: TransactionResponse;
      try {
        txResponse = await connectedWallet.sendTransaction(txRequest);
      } catch (error: any) {
        logger.error("Failed to send raw transaction", error, {
          to,
          dataLength: typeof data === "string" ? data.length : data.length,
        });
        throw new TransactionError(
          `Failed to send raw transaction: ${error.message}`,
          undefined,
          "failed",
          { to, error: error.message }
        );
      }

      logger.info("Raw transaction sent", { txHash: txResponse.hash });

      if (options.waitForConfirmation !== false) {
        return await this.waitForConfirmation(
          txResponse.hash,
          options.maxConfirmations || 1,
          options.confirmationTimeout
        );
      }

      return {
        txHash: txResponse.hash,
        status: "pending",
      };
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof TransactionError
      ) {
        throw error;
      }
      logger.error("Unexpected error in sendRawTransaction method", error);
      throw new TransactionError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        "failed"
      );
    }
  }

  /**
   * Call a contract function (read-only, no transaction)
   * @param contractAddress - Contract address
   * @param abi - Contract ABI
   * @param functionName - Function name to call
   * @param args - Function arguments
   */
  async callContract(
    contractAddress: string,
    abi: any[],
    functionName: string,
    args: any[] = []
  ): Promise<any> {
    try {
      if (!contractAddress || !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new ValidationError(
          "Invalid contract address",
          "contractAddress",
          {
            contractAddress,
          }
        );
      }

      logger.debug("Calling contract function", {
        contractAddress,
        functionName,
        args,
      });

      const contract = new Contract(contractAddress, abi, this.provider);
      const result = await contract[functionName](...args);

      logger.debug("Contract call successful", {
        contractAddress,
        functionName,
        result: result.toString(),
      });

      return result;
    } catch (error) {
      logger.error("Failed to call contract", error, {
        contractAddress,
        functionName,
      });
      throw new RPCError(
        `Failed to call contract: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        undefined,
        { contractAddress, functionName }
      );
    }
  }

  /**
   * Send a transaction to call a contract function (write operation)
   * @param wallet - Wallet to send from
   * @param contractAddress - Contract address
   * @param abi - Contract ABI
   * @param functionName - Function name to call
   * @param args - Function arguments
   * @param options - Send options including confirmation settings
   */
  async callContractFunction(
    wallet: Wallet,
    contractAddress: string,
    abi: any[],
    functionName: string,
    args: any[] = [],
    options: SendOptions = {}
  ): Promise<TransactionResult> {
    try {
      if (!contractAddress || !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new ValidationError(
          "Invalid contract address",
          "contractAddress",
          {
            contractAddress,
          }
        );
      }

      logger.debug("Calling contract function (write)", {
        contractAddress,
        functionName,
        args,
        options,
      });

      const connectedWallet = wallet.connect(this.provider);
      const contract = new Contract(contractAddress, abi, connectedWallet);

      // Build transaction request
      const txRequest: TransactionRequest = {
        to: contractAddress,
      };

      // Encode function call
      try {
        txRequest.data = contract.interface.encodeFunctionData(
          functionName,
          args
        );
      } catch (error) {
        logger.error("Failed to encode function call", error, {
          contractAddress,
          functionName,
          args,
        });
        throw new ValidationError(
          `Failed to encode function call: ${error instanceof Error ? error.message : String(error)}`,
          "functionName",
          { functionName, args }
        );
      }

      // Set gas options if provided
      if (options.gasLimit) {
        txRequest.gasLimit =
          typeof options.gasLimit === "bigint"
            ? options.gasLimit
            : BigInt(options.gasLimit);
      }

      if (options.gasPrice) {
        txRequest.gasPrice =
          typeof options.gasPrice === "bigint"
            ? options.gasPrice
            : BigInt(options.gasPrice);
      }

      if (options.maxFeePerGas) {
        txRequest.maxFeePerGas =
          typeof options.maxFeePerGas === "bigint"
            ? options.maxFeePerGas
            : BigInt(options.maxFeePerGas);
      }

      if (options.maxPriorityFeePerGas) {
        txRequest.maxPriorityFeePerGas =
          typeof options.maxPriorityFeePerGas === "bigint"
            ? options.maxPriorityFeePerGas
            : BigInt(options.maxPriorityFeePerGas);
      }

      // Set value if provided
      if (options.fee) {
        txRequest.value =
          typeof options.fee === "bigint" ? options.fee : BigInt(options.fee);
      }

      let txResponse: TransactionResponse;
      try {
        txResponse = await connectedWallet.sendTransaction(txRequest);
      } catch (error: any) {
        logger.error("Failed to send contract transaction", error, {
          contractAddress,
          functionName,
        });
        throw new TransactionError(
          `Failed to send contract transaction: ${error.message}`,
          undefined,
          "failed",
          { contractAddress, functionName, error: error.message }
        );
      }

      logger.info("Contract transaction sent", { txHash: txResponse.hash });

      if (options.waitForConfirmation !== false) {
        return await this.waitForConfirmation(
          txResponse.hash,
          options.maxConfirmations || 1,
          options.confirmationTimeout
        );
      }

      return {
        txHash: txResponse.hash,
        status: "pending",
      };
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof TransactionError ||
        error instanceof RPCError
      ) {
        throw error;
      }
      logger.error("Unexpected error in callContractFunction method", error);
      throw new TransactionError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        "failed"
      );
    }
  }

  /**
   * Send transaction via Flashbots (private transaction routing)
   * Note: This requires the @flashbots/sdk package to be installed
   * @param wallet - Wallet to send from
   * @param transaction - Transaction request
   * @param options - Send options
   * @param flashbotsRelayUrl - Optional Flashbots relay URL (defaults to mainnet)
   */
  async sendFlashbotsTransaction(
    wallet: Wallet,
    transaction: TransactionRequest,
    _options: SendOptions = {},
    flashbotsRelayUrl?: string
  ): Promise<TransactionResult> {
    try {
      logger.warn(
        "Flashbots support requires @flashbots/sdk package. Install it with: pnpm add @flashbots/sdk"
      );

      // Check if Flashbots SDK is available
      let FlashbotsBundleProvider: any;
      try {
        // Dynamic import to avoid requiring it as a dependency
        // @ts-ignore - Optional dependency
        const flashbotsModule = await import("@flashbots/sdk");
        FlashbotsBundleProvider = flashbotsModule.FlashbotsBundleProvider;
      } catch (error) {
        throw new ValidationError(
          "Flashbots SDK not installed. Install with: pnpm add @flashbots/sdk",
          "flashbots",
          { error: error instanceof Error ? error.message : String(error) }
        );
      }

      if (!transaction.to) {
        throw new ValidationError(
          "Transaction must have a 'to' address",
          "transaction"
        );
      }

      logger.debug("Sending Flashbots transaction", {
        to: transaction.to,
        flashbotsRelayUrl,
      });

      const connectedWallet = wallet.connect(this.provider);
      const flashbotsProvider = await FlashbotsBundleProvider.create(
        this.provider,
        connectedWallet,
        flashbotsRelayUrl || "https://relay.flashbots.net"
      );

      // Create bundle with transaction
      const bundle = [
        {
          transaction: {
            ...transaction,
            from: connectedWallet.address,
          },
          signer: connectedWallet,
        },
      ];

      // Send bundle
      const bundleResponse = await flashbotsProvider.sendBundle(bundle, 1); // target block = current + 1

      if ("error" in bundleResponse) {
        logger.error("Flashbots bundle error", undefined, {
          error: bundleResponse.error,
        });
        throw new TransactionError(
          `Flashbots bundle error: ${JSON.stringify(bundleResponse.error)}`,
          undefined,
          "failed",
          { error: bundleResponse.error }
        );
      }

      const bundleHash = bundleResponse.bundleHash;
      logger.info("Flashbots bundle submitted", { bundleHash });

      // Wait for bundle to be included
      const waitResponse = await bundleResponse.wait();

      if (waitResponse === 0) {
        logger.info("Flashbots bundle included in block", { bundleHash });
        // Get transaction hash from the bundle
        // Note: Flashbots doesn't return individual tx hashes, so we need to track it differently
        return {
          txHash: bundleHash, // Using bundle hash as identifier
          status: "confirmed",
        };
      } else {
        throw new TransactionError(
          `Flashbots bundle not included: ${waitResponse}`,
          bundleHash,
          "failed"
        );
      }
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof TransactionError
      ) {
        throw error;
      }
      logger.error(
        "Unexpected error in sendFlashbotsTransaction method",
        error
      );
      throw new TransactionError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        "failed"
      );
    }
  }
}
