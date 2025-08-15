import { Data } from "effect";

export class AiError extends Data.TaggedError("AiError")<{
  readonly cause: unknown;
  readonly description: string;
  readonly method: string;
  readonly module: string;
}> {
  get message() {
    return `${this.module}.${this.method}: ${this.description}`;
  }
}
