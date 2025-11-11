import type { RestMediaArtifact, RestBashOutputArtifact } from './types.js';

// Helper to check if running in a Node.js environment
const isNode =
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null;

import { Platform } from './platform.js';

export class MediaArtifact {
  public readonly type = 'media';
  public readonly data: string;
  public readonly format: string;
  private platform: Platform;

  constructor(artifact: RestMediaArtifact['media'], platform: Platform) {
    this.data = artifact.data;
    this.format = artifact.format;
    this.platform = platform;
  }

  async save(filepath: string): Promise<void> {
    await this.platform.saveFile(filepath, this.data, 'base64');
  }
}

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

  toString(): string {
    const output = [this.stdout, this.stderr].filter(Boolean).join('');
    const commandLine = `$ ${this.command}`;
    const outputLine = output ? `${output}\n` : '';
    const exitLine = `[exit code: ${this.exitCode ?? 'N/A'}]`;
    return `${commandLine}\n${outputLine}${exitLine}`;
  }
}
