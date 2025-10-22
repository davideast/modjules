// src/errors.ts

/**
 * Base class for all SDK-specific errors.
 * This allows consumers to catch all Jules SDK errors with a single `catch` block.
 */
export class JulesError extends Error {
  /** The original error that caused this error, if any. */
  public readonly cause?: Error;

  constructor(message: string, options?: { cause?: Error }) {
    super(message);
    this.name = this.constructor.name;
    this.cause = options?.cause;
  }
}

/**
 * Thrown for fundamental network issues like fetch failures or timeouts.
 */
export class JulesNetworkError extends JulesError {}

/**
 * A generic wrapper for non-2xx API responses that don't match other specific errors.
 */
export class JulesApiError extends JulesError {
  public readonly status: number;
  public readonly statusText: string;

  constructor(
    message: string,
    status: number,
    statusText: string,
    options?: { cause?: Error },
  ) {
    super(message, options);
    this.status = status;
    this.statusText = statusText;
  }
}

/**
 * Thrown for 401 Unauthorized or 403 Forbidden API responses.
 */
export class JulesAuthenticationError extends JulesApiError {
  constructor(status: number, statusText: string) {
    super(
      `Authentication failed with status ${status}. Ensure your API key is correct.`,
      status,
      statusText,
    );
  }
}

/**
 * Thrown for 429 Too Many Requests API responses.
 */
export class JulesRateLimitError extends JulesApiError {
  constructor(status: number, statusText: string) {
    super(
      `API rate limit exceeded with status ${status}.`,
      status,
      statusText,
    );
  }
}

/**
 * Thrown when an API key is required but not provided.
 */
export class MissingApiKeyError extends JulesError {
  constructor() {
    super(
      'Jules API key is missing. Pass it to the constructor or set the JULES_API_KEY environment variable.',
    );
  }
}

/**
 * Thrown when a requested source cannot be found.
 */
export class SourceNotFoundError extends JulesError {
  constructor(sourceIdentifier: string) {
    super(`Could not get source '${sourceIdentifier}'`);
  }
}

/**
 * Thrown when a jules.run() operation terminates in a FAILED state.
 */
export class AutomatedSessionFailedError extends JulesError {
  constructor(reason?: string) {
    let message = 'The Jules automated session terminated with a FAILED state.';
    if (reason) {
      message += ` Reason: ${reason}`;
    }
    super(message);
  }
}

/**
 * Thrown when an operation is attempted on a session that is not in a
 * valid state for that operation.
 */
export class InvalidStateError extends JulesError {
  constructor(message: string) {
    super(message);
  }
}
