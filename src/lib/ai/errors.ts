export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

export class AIUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIUpstreamError";
  }
}
