import { vi } from 'vitest';
import { Platform } from '../../src/platform.js';

export const mockPlatform: Platform = {
  saveFile: vi.fn(),
  sleep: vi.fn(),
};
