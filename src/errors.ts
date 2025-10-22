// src/errors.ts

/**
 * Base class for all SDK-specific errors.
 * This allows consumers to catch all Jules SDK errors with a single `catch` block.
 */
export class JulesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * An error class representing a failed API response.
 */
export class JulesApiError extends JulesError {
    public readonly status: number;
    public readonly statusText: string;

    constructor(message: string, status: number, statusText: string) {
        super(message);
        this.status = status;
        this.statusText = statusText;
    }
}

/**
 * Thrown when an API key is required but not provided.
 */
export class MissingApiKeyError extends JulesError {
  constructor() {
    super(
      'Jules API key is missing. Pass it to the constructor or set the JULES_API_KEY environment variable.'
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
export class RunFailedError extends JulesError {
  constructor(reason?: string) {
    let message = 'The Jules run terminated with a FAILED state.';
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
