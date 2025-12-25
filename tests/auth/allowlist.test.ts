import { describe, it, expect, vi } from 'vitest';
import {
  withAllowList,
  normalizeEmailKey,
} from '../../src/auth/strategies/utils.js';
import { createRTDBAllowList } from '../../src/auth/strategies/rtdb.js';

describe('Allow List Helpers', () => {
  describe('normalizeEmailKey', () => {
    it('normalizes emails for RTDB', () => {
      expect(normalizeEmailKey('test.user@example.com', 'rtdb')).toBe(
        'test,user@example,com',
      );
    });

    it('returns email as-is for Firestore', () => {
      expect(normalizeEmailKey('test.user@example.com', 'firestore')).toBe(
        'test.user@example.com',
      );
    });

    it('throws if email is missing', () => {
      expect(() => normalizeEmailKey('', 'rtdb')).toThrow();
    });
  });

  describe('withAllowList', () => {
    const mockStrategy = vi.fn();
    const platform: any = {};

    it('allows access when user is in static array', async () => {
      mockStrategy.mockResolvedValue({ uid: 'user1', email: 'user1@test.com' });
      const wrapped = withAllowList(['user1@test.com'], mockStrategy);

      await expect(wrapped('token', platform)).resolves.toEqual({
        uid: 'user1',
        email: 'user1@test.com',
      });
    });

    it('denies access when user is not in static array', async () => {
      mockStrategy.mockResolvedValue({
        uid: 'user2',
        email: 'unknown@test.com',
      });
      const wrapped = withAllowList(['user1@test.com'], mockStrategy);

      await expect(wrapped('token', platform)).rejects.toThrow('Access Denied');
    });

    it('uses async checker function', async () => {
      mockStrategy.mockResolvedValue({ uid: 'user1' });
      const checker = vi.fn().mockResolvedValue(true);
      const wrapped = withAllowList(checker, mockStrategy);

      await expect(wrapped('token', platform)).resolves.toEqual({
        uid: 'user1',
      });
      expect(checker).toHaveBeenCalledWith({ uid: 'user1' });
    });
  });

  describe('createRTDBAllowList', () => {
    it('checks RTDB for allowed user', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        exists: () => true,
        val: () => true,
      });
      const mockDb: any = {
        ref: vi.fn().mockReturnValue({ get: mockGet }),
      };

      const checker = createRTDBAllowList(mockDb);
      const result = await checker({ uid: 'u1', email: 'bob@test.com' });

      expect(result).toBe(true);
      expect(mockDb.ref).toHaveBeenCalledWith('allowlist/bob@test,com');
    });

    it('returns false if value is not true', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        exists: () => true,
        val: () => false,
      });
      const mockDb: any = {
        ref: vi.fn().mockReturnValue({ get: mockGet }),
      };

      const checker = createRTDBAllowList(mockDb);
      const result = await checker({ uid: 'u1', email: 'bob@test.com' });

      expect(result).toBe(false);
    });
  });
});
