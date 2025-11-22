import { describe, it, expect, beforeEach } from 'vitest';
import { TokenManager } from '../../src/auth/tokenizer';
import { NodePlatform } from '../../src/platform/node';

describe('TokenManager (Security Logic)', () => {
  const secret = 'super-secret-key-123';
  const platform = new NodePlatform(); // Trusted foundation from Phase 1
  let tokenizer: TokenManager;

  beforeEach(() => {
    tokenizer = new TokenManager(platform, secret);
  });

  it('mints and verifies a valid token', async () => {
    const scope = { sessionId: 'sess_abc' };
    const token = await tokenizer.mint(scope);

    // Check structure
    expect(token.split('.')).toHaveLength(3);

    // Verify
    const claims = await tokenizer.verify(token);
    expect(claims.scope.sessionId).toBe('sess_abc');
    expect(claims.iat).toBeDefined();
  });

  it('rejects tampered payloads', async () => {
    const token = await tokenizer.mint({ sessionId: 'sess_abc' });
    const [header, payload, sig] = token.split('.');

    // Hack: Decode payload, change ID, re-encode
    const fakePayload = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
        scope: { sessionId: 'sess_ADMIN' }, // malicious change
      }),
    ).toString('base64url');

    const forgedToken = `${header}.${fakePayload}.${sig}`;

    await expect(tokenizer.verify(forgedToken)).rejects.toThrow(
      'Invalid token signature',
    );
  });

  it('rejects expired tokens', async () => {
    // Mint token that expired 1 second ago
    const expiredToken = await tokenizer.mint({ sessionId: 'sess_old' }, -1);

    await expect(tokenizer.verify(expiredToken)).rejects.toThrow(
      'Token expired',
    );
  });

  it('rejects invalid secrets (Wrong Key Attack)', async () => {
    const token = await tokenizer.mint({ sessionId: 'sess_abc' });

    // Attacker tries to verify with a different secret
    const attackerTokenizer = new TokenManager(platform, 'wrong-secret');

    await expect(attackerTokenizer.verify(token)).rejects.toThrow(
      'Invalid token signature',
    );
  });
});
