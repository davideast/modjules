import { vi } from 'vitest';
import { Platform } from '../../src/platform/types.js';

export const mockPlatform: Platform = {
  saveFile: vi.fn(),
  sleep: vi.fn(),
  createDataUrl: vi.fn(),
};
