/**
 * Abstract interface for platform-specific functionality.
 * Allows the SDK to run in both Node.js and browser environments.
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
}
