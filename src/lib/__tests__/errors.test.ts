/// <reference types="jest" />

import { DomainError, ValidationError, CrawlError } from "../errors";

describe("errors", () => {
  describe("DomainError", () => {
    it("should create error with message and url", () => {
      const error = new DomainError("Invalid domain", "https://example.com");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DomainError);
      expect(error.message).toBe("Invalid domain");
      expect(error.url).toBe("https://example.com");
      expect(error.name).toBe("DomainError");
    });

    it("should preserve stack trace", () => {
      const error = new DomainError("Test error", "https://example.com");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("DomainError");
    });

    it("should be throwable and catchable", () => {
      expect(() => {
        throw new DomainError("Test", "https://example.com");
      }).toThrow(DomainError);

      expect(() => {
        throw new DomainError("Test", "https://example.com");
      }).toThrow("Test");
    });
  });

  describe("ValidationError", () => {
    it("should create error with message", () => {
      const error = new ValidationError("Invalid input");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe("Invalid input");
      expect(error.name).toBe("ValidationError");
    });

    it("should create error with message and field", () => {
      const error = new ValidationError("Invalid value", "maxPages");

      expect(error.message).toBe("Invalid value");
      expect(error.field).toBe("maxPages");
    });

    it("should preserve stack trace", () => {
      const error = new ValidationError("Test error", "field");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("ValidationError");
    });

    it("should be throwable and catchable", () => {
      expect(() => {
        throw new ValidationError("Test");
      }).toThrow(ValidationError);

      expect(() => {
        throw new ValidationError("Test", "field");
      }).toThrow("Test");
    });
  });

  describe("CrawlError", () => {
    it("should create error with message and url", () => {
      const error = new CrawlError("Network error", "https://example.com");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CrawlError);
      expect(error.message).toBe("Network error");
      expect(error.url).toBe("https://example.com");
      expect(error.name).toBe("CrawlError");
    });

    it("should create error with original error", () => {
      const originalError = new Error("Original error");
      const error = new CrawlError("Network error", "https://example.com", originalError);

      expect(error.originalError).toBe(originalError);
    });

    it("should preserve stack trace", () => {
      const error = new CrawlError("Test error", "https://example.com");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("CrawlError");
    });

    it("should be throwable and catchable", () => {
      expect(() => {
        throw new CrawlError("Test", "https://example.com");
      }).toThrow(CrawlError);

      expect(() => {
        throw new CrawlError("Test", "https://example.com");
      }).toThrow("Test");
    });
  });

  describe("Error type discrimination", () => {
    it("should allow type-safe error handling", () => {
      const domainError = new DomainError("Domain error", "https://example.com");
      const validationError = new ValidationError("Validation error", "field");
      const crawlError = new CrawlError("Crawl error", "https://example.com");

      function handleError(error: Error) {
        if (error instanceof DomainError) {
          return `Domain error for ${error.url}`;
        }
        if (error instanceof ValidationError) {
          return `Validation error in field ${error.field}`;
        }
        if (error instanceof CrawlError) {
          return `Crawl error for ${error.url}`;
        }
        return "Unknown error";
      }

      expect(handleError(domainError)).toBe("Domain error for https://example.com");
      expect(handleError(validationError)).toBe("Validation error in field field");
      expect(handleError(crawlError)).toBe("Crawl error for https://example.com");
    });
  });
});

