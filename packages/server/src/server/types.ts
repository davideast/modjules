import type { Platform } from 'modjules';
import { Identity } from '../auth/types.js';

export { Identity };

// --- Scope & Authorization ---

export type Scope = 'read' | 'write' | 'admin';

export interface AuthorizationResult {
  scopes: Scope[];
  /** Optional: Return the raw resource if needed for caching/logging */
  resource?: any;
}

/**
 * Any data object returned by a database strategy must at least
 * have an ownerId to support the "Security by Default" fallback.
 */
export interface ProtectedResource {
  ownerId: string;
  [key: string]: any;
}

/**
 * Callback to verify the user's identity provider token.
 * Returns the user Identity or just a uid string.
 */
export type VerifyCallback = (
  authToken: string,
  platform: Platform,
) => Promise<Identity | string>;

/**
 * Authorization strategy that determines scopes for a user+session pair.
 * The Server Core treats this as a black box.
 */
export type AuthorizationStrategy = (
  user: Identity,
  sessionId: string,
) => Promise<AuthorizationResult>;

// --- Gateway Configuration (Discriminated Union) ---

interface BaseGatewayConfig {
  /** The Google API Key for the Jules API */
  apiKey: string;
  /** Custom platform adapter. Defaults to WebPlatform if omitted. */
  platform?: Platform;
}

/**
 * Mode 1: Simple Proxy
 * Just forwards requests. No auth checks on your end.
 * Great for server-to-server or private networks.
 */
export interface ProxyGatewayConfig extends BaseGatewayConfig {
  kind: 'proxy';
}

/**
 * Mode 2: Session Gateway
 * Enforces Handshake, Capabilities, and RBAC.
 * Required for public-facing apps.
 */
export interface SessionGatewayConfig extends BaseGatewayConfig {
  kind: 'session';
  /** The secret used to sign Browser Capability Tokens */
  clientSecret: string;
  /** Auth configuration */
  auth: {
    verify: VerifyCallback;
    authorize: AuthorizationStrategy;
  };
}

/**
 * Union type for gateway configuration.
 * Use `kind: 'proxy'` for simple forwarding or `kind: 'session'` for secure access.
 */
export type GatewayConfig = ProxyGatewayConfig | SessionGatewayConfig;

// --- Request/Response Abstractions ---

/** Normalized Request (Abstracts Express/Next/Hono) */
export interface ServerRequest {
  method: string;
  /** Full URL or path with query string */
  url: string;
  /** @deprecated Use url instead. Kept for backwards compatibility. */
  path?: string;
  headers: Record<string, string>;
  body?: any;
}

/** Normalized Response */
export interface ServerResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
}

// --- Legacy Exports (For backwards compatibility during migration) ---

/** @deprecated Use SessionGatewayConfig instead */
export interface ServerConfig {
  apiKey: string;
  clientSecret: string;
  verify: VerifyCallback;
  authorize: AuthorizationStrategy;
}
