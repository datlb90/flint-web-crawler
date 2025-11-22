/**
 * Custom error classes for better error handling and type safety.
 * These allow the API layer to distinguish between different error types
 * and return appropriate HTTP status codes.
 */

/**
 * Thrown when a URL does not belong to the allowed domain
 */
export class DomainError extends Error {
  constructor(message: string, public readonly url: string) {
    super(message);
    this.name = "DomainError";
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DomainError);
    }
  }
}

/**
 * Thrown when input validation fails (e.g., invalid maxPages value)
 */
export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = "ValidationError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

/**
 * Thrown when a network or HTTP error occurs during crawling
 */
export class CrawlError extends Error {
  constructor(message: string, public readonly url: string, public readonly originalError?: Error) {
    super(message);
    this.name = "CrawlError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CrawlError);
    }
  }
}

