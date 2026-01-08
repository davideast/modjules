import { describe, it, expect } from 'vitest';
import { createPolicy } from '../src/policy.js';

describe('createPolicy', () => {
  it('should be a function', () => {
    expect(typeof createPolicy).toBe('function');
  });
});
