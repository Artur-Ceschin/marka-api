export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    // Sent as Retry-After, so clients back off for the right length of time.
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}
