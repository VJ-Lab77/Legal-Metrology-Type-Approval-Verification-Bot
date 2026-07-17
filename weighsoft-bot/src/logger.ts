import { config } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (): number => LEVELS[config.LOG_LEVEL] ?? LEVELS.info;

/**
 * Returns an ISO timestamp string for log lines.
 */
function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Creates a tagged logger that respects the configured LOG_LEVEL.
 * @param tag - Short module label (e.g. "loader", "bot")
 */
export function createLogger(tag: string) {
  const prefix = `[${timestamp()}] [${tag}]`;

  return {
    /** Log a debug message. */
    debug: (...args: unknown[]) => {
      if (currentLevel() <= LEVELS.debug) console.debug(prefix, ...args);
    },
    /** Log an info message. */
    info: (...args: unknown[]) => {
      if (currentLevel() <= LEVELS.info) console.info(prefix, ...args);
    },
    /** Log a warning message. */
    warn: (...args: unknown[]) => {
      if (currentLevel() <= LEVELS.warn) console.warn(prefix, ...args);
    },
    /** Log an error message. */
    error: (...args: unknown[]) => {
      if (currentLevel() <= LEVELS.error) console.error(prefix, ...args);
    },
  };
}
