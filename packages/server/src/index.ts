// Main server exports
export { createGateway } from './server/index.js';
export type {
  GatewayConfig,
  ProxyGatewayConfig,
  SessionGatewayConfig,
  VerifyCallback,
  AuthorizationStrategy,
  AuthorizationResult,
  ProtectedResource,
  Scope,
  ServerRequest,
  ServerResponse,
} from './server/types.js';

// Core handler for custom integrations
export { createHandlerCore, createForwardingHandler } from './server/core.js';
export {
  proxyRequest,
  verifyAccess,
  handleHandshake,
} from './server/gateway.js';

// Auth exports
export { TokenManager } from './auth/tokenizer.js';
export type {
  HandshakeRequest,
  HandshakeResponse,
  TokenClaims,
  TokenScope,
} from './auth/protocol.js';
