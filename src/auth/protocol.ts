/**
 * Defines the strict permissions granted by a Capability Token.
 */
export interface TokenScope {
  /**
   * The specific Session ID this token is bound to.
   * Accessing any other session with this token will fail.
   */
  sessionId: string;

  /**
   * Allowed operations (e.g., 'read', 'write').
   * If undefined, assumes full access to the session.
   */
  permissions?: ('read' | 'write')[];
}

/**
 * The standard JWT Payload structure.
 */
export interface TokenClaims {
  /** Issued At (Timestamp) */
  iat: number;
  /** Expiration (Timestamp) */
  exp: number;
  /** The capability scope */
  scope: TokenScope;
}

/**
 * The "Handshake" Request sent from Client -> Proxy.
 */
export type HandshakeRequest =
  | {
      intent: 'create';
      /** The raw auth token from the provider (e.g., Firebase ID Token) */
      authToken?: string;
      /** Context for the creation (e.g., user prompt, repo URL) */
      context: Record<string, any>;
    }
  | {
      intent: 'resume';
      authToken?: string;
      sessionId: string;
    };

/**
 * The "Handshake" Response sent from Proxy -> Client.
 */
export type HandshakeResponse =
  | {
      success: true;
      /** The Signed Capability Token (JWT) */
      token: string;
      /** The Session ID (useful if intent was 'create') */
      sessionId: string;
    }
  | {
      success: false;
      error: string;
    };
