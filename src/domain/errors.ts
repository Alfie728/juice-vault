import { Data } from "effect";

/**
 * Error thrown when a requested resource is not found
 */
export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly resource: string;
  readonly id: string | number;
}> {
  get message() {
    return `${this.resource} with id ${this.id} not found`;
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string;
  readonly reason: string;
}> {
  get message() {
    return `Validation failed for field ${this.field}: ${this.reason}`;
  }
}

/**
 * Error thrown when a database operation fails
 */
export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly operation: string;
  readonly reason: string;
}> {
  get message() {
    return `Database operation ${this.operation} failed: ${this.reason}`;
  }
}

/**
 * Error thrown when authorization fails
 */
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
  readonly reason?: string;
}> {
  get message() {
    return this.reason ?? "Unauthorized access";
  }
}