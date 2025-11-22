/**
 * A unified response interface that works across Node, Browser, and GAS.
 */
export interface PlatformResponse {
  ok: boolean;
  status: number;
  json<T = any>(): Promise<T>;
  text(): Promise<string>;
}

/**
 * Abstract interface for platform-specific functionality.
 * Allows the SDK to run in both Node.js, browser, and Google Apps Script environments.
 */
export interface Platform {
  /**
   * Saves a file to the platform's filesystem.
   */
  saveFile(
    filepath: string,
    data: string,
    encoding: 'base64',
    activityId?: string,
  ): Promise<void>;

  /**
   * Pauses execution for the specified duration.
   */
  sleep(ms: number): Promise<void>;

  /**
   * Creates a data URL for the given data.
   */
  createDataUrl(data: string, mimeType: string): string;

  /**
   * Unified network fetch.
   */
  fetch(input: string, init?: any): Promise<PlatformResponse>;

  /**
   * Unified crypto operations.
   */
  crypto: {
    /**
     * Generates a standard UUID v4.
     */
    randomUUID(): string;

    /**
     * Signs a string using HMAC-SHA256 and returns a Base64Url encoded string.
     * Used for minting Capability Tokens.
     */
    sign(text: string, secret: string): Promise<string>;

    /**
     * Verifies a signature.
     */
    verify(text: string, signature: string, secret: string): Promise<boolean>;
  };
}
