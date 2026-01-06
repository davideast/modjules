export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly response?: any,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export class GitHubNotFoundError extends GitHubError {
  constructor(resource: string) {
    super(`GitHub resource not found: ${resource}`, 404);
    this.name = 'GitHubNotFoundError';
  }
}

export class GitHubAuthError extends GitHubError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'GitHubAuthError';
  }
}

export class GitHubRateLimitError extends GitHubError {
  constructor(
    public readonly resetAt: Date,
    public readonly limit: number,
    public readonly remaining: number,
  ) {
    super(
      `GitHub rate limit exceeded. Resets at ${resetAt.toISOString()}`,
      429,
    );
    this.name = 'GitHubRateLimitError';
  }
}
