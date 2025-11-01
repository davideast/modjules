import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Buffer } from 'buffer';
import type {
  RestMediaArtifact,
  RestBashOutputArtifact,
} from '../src/types.js';

// Mock the entire fs/promises module
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
}));

describe('Artifacts', () => {
  // These modules will be dynamically imported to handle environment mocking
  let MediaArtifact: any;
  let BashArtifact: any;
  let mapRestArtifactToSdkArtifact: any;
  let fs_promises: any;

  describe('in a Node.js environment', () => {
    beforeEach(async () => {
      // Ensure we are in a simulated Node environment
      if (typeof global.process === 'undefined') {
        // @ts-ignore
        global.process = { versions: { node: '20.0.0' } };
      }
      vi.resetModules(); // Isolate module imports for this describe block
      const artifacts = await import('../src/artifacts.js');
      const mappers = await import('../src/mappers.js');
      fs_promises = await import('fs/promises');

      MediaArtifact = artifacts.MediaArtifact;
      BashArtifact = artifacts.BashArtifact;
      mapRestArtifactToSdkArtifact = mappers.mapRestArtifactToSdkArtifact;

      vi.clearAllMocks(); // Clear mock history before each test
    });

    describe('MediaArtifact', () => {
      it('should correctly decode base64 and call fs.writeFile', async () => {
        const base64Data = 'SGVsbG8sIFdvcmxkIQ=='; // "Hello, World!"
        const artifact = new MediaArtifact({
          data: base64Data,
          format: 'text/plain',
        });
        const filepath = '/path/to/file.txt';

        await artifact.save(filepath);

        const expectedBuffer = Buffer.from(base64Data, 'base64');
        expect(fs_promises.writeFile).toHaveBeenCalledOnce();
        expect(fs_promises.writeFile).toHaveBeenCalledWith(
          filepath,
          expectedBuffer,
        );
      });
    });

    describe('BashArtifact', () => {
      it('should format toString() correctly with stdout', () => {
        const artifact = new BashArtifact({
          command: 'ls -l',
          stdout: 'total 0',
          stderr: '',
          exitCode: 0,
        });
        const expected = `$ ls -l\ntotal 0\n[exit code: 0]`;
        expect(artifact.toString()).toBe(expected);
      });

      it('should format toString() correctly with stderr', () => {
        const artifact = new BashArtifact({
          command: 'grep foo nonexistent.txt',
          stdout: '',
          stderr: 'File not found',
          exitCode: 2,
        });
        const expected = `$ grep foo nonexistent.txt\nFile not found\n[exit code: 2]`;
        expect(artifact.toString()).toBe(expected);
      });

      it('should format toString() correctly with no output and a null exit code', () => {
        const artifact = new BashArtifact({
          command: 'sleep 10',
          stdout: '',
          stderr: '',
          exitCode: null,
        });
        const expected = `$ sleep 10\n[exit code: N/A]`;
        expect(artifact.toString()).toBe(expected);
      });
    });

    describe('Mapper Integration', () => {
      it('should map REST media artifact to a MediaArtifact instance', () => {
        const restArtifact: RestMediaArtifact = {
          media: { data: 'data', format: 'image/png' },
        };
        const sdkArtifact = mapRestArtifactToSdkArtifact(restArtifact);
        expect(sdkArtifact).toBeInstanceOf(MediaArtifact);
        expect(sdkArtifact.type).toBe('media');
        expect(typeof sdkArtifact.save).toBe('function');
      });

      it('should map REST bash artifact to a BashArtifact instance', () => {
        const restArtifact: RestBashOutputArtifact = {
          bashOutput: {
            command: 'echo "hi"',
            stdout: 'hi',
            stderr: '',
            exitCode: 0,
          },
        };
        const sdkArtifact = mapRestArtifactToSdkArtifact(restArtifact);
        expect(sdkArtifact).toBeInstanceOf(BashArtifact);
        expect(sdkArtifact.type).toBe('bashOutput');
        expect(typeof sdkArtifact.toString).toBe('function');
      });
    });
  });

  describe('in a non-Node.js environment', () => {
    let originalProcess: any;

    beforeEach(() => {
      originalProcess = global.process;
      // @ts-ignore
      delete global.process; // Simulate a browser-like environment
      vi.resetModules(); // This is key to re-evaluating the isNode check
    });

    afterEach(() => {
      global.process = originalProcess; // Restore for other tests
      vi.resetModules();
    });

    it('should cause MediaArtifact.save() to throw an error', async () => {
      // Dynamically import the class AFTER mocking the environment
      const { MediaArtifact: BrowserMediaArtifact } = await import(
        '../src/artifacts.js'
      );
      const artifact = new BrowserMediaArtifact({
        data: 'SGVsbG8sIFdvcmxkIQ==',
        format: 'text/plain',
      });

      await expect(artifact.save('/any/path.txt')).rejects.toThrow(
        'MediaArtifact.save() is only available in Node.js environments.',
      );
    });
  });
});
