import type { RestMediaArtifact, RestBashOutputArtifact } from './types.js';
import { Platform } from './platform/types.js';

/**
 * Represents a media artifact (e.g. image) produced by an activity.
 * Provides helper methods for saving and viewing the media.
 */
export class MediaArtifact {
  public readonly type = 'media';
  public readonly data: string;
  public readonly format: string;
  private platform: Platform;
  private activityId?: string;

  constructor(
    artifact: RestMediaArtifact['media'],
    platform: Platform,
    activityId?: string,
  ) {
    this.data = artifact.data;
    this.format = artifact.format;
    this.platform = platform;
    this.activityId = activityId;
  }

  /**
   * Saves the media artifact to a file.
   *
   * **Side Effects:**
   * - Node.js: Writes the file to disk (overwrites if exists).
   * - Browser: Saves the file to the 'artifacts' object store in IndexedDB.
   *
   * @param filepath The path where the file should be saved.
   */
  async save(filepath: string): Promise<void> {
    await this.platform.saveFile(
      filepath,
      this.data,
      'base64',
      this.activityId,
    );
  }

  /**
   * Converts the media artifact to a data URL.
   * Useful for displaying images in a browser.
   *
   * **Data Transformation:**
   * - Prefixes the base64 data with `data:<mimeType>;base64,`.
   *
   * @returns A valid Data URI string.
   */
  toUrl(): string {
    return this.platform.createDataUrl(this.data, this.format);
  }
}

/**
 * Represents the output of a bash command executed by the agent.
 */
export class BashArtifact {
  public readonly type = 'bashOutput';
  public readonly command: string;
  public readonly stdout: string;
  public readonly stderr: string;
  public readonly exitCode: number | null;

  constructor(artifact: RestBashOutputArtifact['bashOutput']) {
    this.command = artifact.command;
    this.stdout = artifact.stdout;
    this.stderr = artifact.stderr;
    this.exitCode = artifact.exitCode;
  }

  /**
   * Formats the bash output as a string, mimicking a terminal session.
   *
   * **Data Transformation:**
   * - Combines `stdout` and `stderr`.
   * - Formats the command with a `$` prompt.
   * - Appends the exit code.
   */
  toString(): string {
    const output = [this.stdout, this.stderr].filter(Boolean).join('');
    const commandLine = `$ ${this.command}`;
    const outputLine = output ? `${output}\n` : '';
    const exitLine = `[exit code: ${this.exitCode ?? 'N/A'}]`;
    return `${commandLine}\n${outputLine}${exitLine}`;
  }
}
