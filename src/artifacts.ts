import * as fs from 'fs/promises';
import { Buffer } from 'buffer';
import type { RestMediaArtifact, RestBashOutputArtifact } from './types.js';

// Helper to check if running in a Node.js environment
const isNode =
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null;

export class MediaArtifact {
  public readonly type = 'media';
  public readonly data: string;
  public readonly format: string;

  constructor(artifact: RestMediaArtifact['media']) {
    this.data = artifact.data;
    this.format = artifact.format;
  }

  async save(filepath: string): Promise<void> {
    if (!isNode) {
      throw new Error(
        'MediaArtifact.save() is only available in Node.js environments.',
      );
    }

    const buffer = Buffer.from(this.data, 'base64');
    await fs.writeFile(filepath, buffer);
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
