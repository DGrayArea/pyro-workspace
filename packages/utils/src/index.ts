/**
 * @pyro/utils - Utility functions for Pyro SDK
 */

export * from "./logger";
export function toHex(value: string | number | bigint | Uint8Array): string {
  if (value instanceof Uint8Array) {
    return bytesToHex(value);
  }
  if (typeof value === "bigint") {
    return "0x" + value.toString(16);
  }
  if (typeof value === "number") {
    return "0x" + value.toString(16);
  }
  if (typeof value === "string") {
    if (value.startsWith("0x")) {
      return value;
    }
    return "0x" + BigInt(value).toString(16);
  }
  throw new Error(`Invalid value type for hex conversion: ${typeof value}`);
}

/**
 * Convert hex string to bigint
 */
export function hexToBigInt(hex: string): bigint {
  if (hex.startsWith("0x")) {
    return BigInt(hex);
  }
  return BigInt("0x" + hex);
}

/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry utility
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await sleep(delay * (i + 1));
      }
    }
  }
  throw lastError!;
}
