/**
 * Logger utility for Pyro SDK
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LoggerConfig {
  level?: LogLevel;
  prefix?: string;
  enableTimestamp?: boolean;
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private prefix: string = "[Pyro]";
  private enableTimestamp: boolean = true;

  constructor(config: LoggerConfig = {}) {
    this.level = config.level ?? LogLevel.INFO;
    this.prefix = config.prefix ?? "[Pyro]";
    this.enableTimestamp = config.enableTimestamp ?? true;
  }

  private formatMessage(
    level: string,
    message: string,
    ...args: any[]
  ): string {
    const timestamp = this.enableTimestamp ? new Date().toISOString() : "";
    const prefix = timestamp
      ? `${this.prefix} [${timestamp}] [${level}]`
      : `${this.prefix} [${level}]`;

    if (args.length > 0) {
      return `${prefix} ${message} ${JSON.stringify(args, null, 2)}`;
    }
    return `${prefix} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.formatMessage("DEBUG", message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(this.formatMessage("INFO", message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage("WARN", message, ...args));
    }
  }

  error(message: string, error?: Error | unknown, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      const errorDetails =
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
              ...((error as any).code && { code: (error as any).code }),
              ...((error as any).context && {
                context: (error as any).context,
              }),
            }
          : error;

      console.error(
        this.formatMessage("ERROR", message, ...args),
        errorDetails ? "\nError details:" : "",
        errorDetails
      );
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }
}

// Default logger instance
export const logger = new Logger();

// Create logger factory
export function createLogger(config: LoggerConfig = {}): Logger {
  return new Logger(config);
}
