/**
 * Tests for error handler utility
 */

import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ConfigurationError } from "../errors.js";
import { NodeStatus } from "../types.js";
import { handleNodeError } from "./error-handler.js";
import { OperationCancelledError } from "./signal-check.js";

describe("handleNodeError", () => {
  describe("ConfigurationError handling", () => {
    it.effect("should re-propagate ConfigurationError as Effect failure", () =>
      Effect.gen(function* (_) {
        const error = new ConfigurationError("Test config error");
        const result = yield* _(Effect.exit(handleNodeError(error)));

        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure" && result.cause._tag === "Fail") {
          expect(result.cause.error).toBeInstanceOf(ConfigurationError);
          expect(result.cause.error.message).toBe("Test config error");
        }
      }),
    );

    it.effect(
      "should preserve ConfigurationError hint when re-propagating",
      () =>
        Effect.gen(function* (_) {
          const error = new ConfigurationError(
            "Test config error",
            "Check your test file",
          );
          const result = yield* _(Effect.exit(handleNodeError(error)));

          expect(result._tag).toBe("Failure");
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(result.cause.error).toBeInstanceOf(ConfigurationError);
            expect(result.cause.error.hint).toBe("Check your test file");
          }
        }),
    );
  });

  describe("OperationCancelledError handling", () => {
    it.effect(
      "should re-propagate OperationCancelledError as Effect failure",
      () =>
        Effect.gen(function* (_) {
          const error = new OperationCancelledError("Test cancelled");
          const result = yield* _(Effect.exit(handleNodeError(error)));

          expect(result._tag).toBe("Failure");
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(result.cause.error).toBeInstanceOf(OperationCancelledError);
            expect(result.cause.error.message).toBe("Test cancelled");
          }
        }),
    );
  });

  describe("Generic error handling", () => {
    it.effect("should convert generic Error to FAILURE status", () =>
      Effect.gen(function* (_) {
        const error = new Error("Generic error");
        const result = yield* _(handleNodeError(error));

        expect(result).toBe(NodeStatus.FAILURE);
      }),
    );

    it.effect("should convert string error to FAILURE status", () =>
      Effect.gen(function* (_) {
        const error = "String error";
        const result = yield* _(handleNodeError(error));

        expect(result).toBe(NodeStatus.FAILURE);
      }),
    );

    it.effect("should convert unknown error to FAILURE status", () =>
      Effect.gen(function* (_) {
        const error = { custom: "error object" };
        const result = yield* _(handleNodeError(error));

        expect(result).toBe(NodeStatus.FAILURE);
      }),
    );

    it.effect("should convert null error to FAILURE status", () =>
      Effect.gen(function* (_) {
        const error = null;
        const result = yield* _(handleNodeError(error));

        expect(result).toBe(NodeStatus.FAILURE);
      }),
    );

    it.effect("should convert undefined error to FAILURE status", () =>
      Effect.gen(function* (_) {
        const error = undefined;
        const result = yield* _(handleNodeError(error));

        expect(result).toBe(NodeStatus.FAILURE);
      }),
    );
  });

  describe("Error type priority", () => {
    it.effect(
      "should prioritize ConfigurationError over other error types",
      () =>
        Effect.gen(function* (_) {
          // Even if ConfigurationError extends Error, it should be caught first
          const error = new ConfigurationError("Config error");
          const result = yield* _(Effect.exit(handleNodeError(error)));

          expect(result._tag).toBe("Failure");
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(result.cause.error).toBeInstanceOf(ConfigurationError);
          }
        }),
    );

    it.effect(
      "should prioritize OperationCancelledError over generic errors",
      () =>
        Effect.gen(function* (_) {
          // Even if OperationCancelledError extends Error, it should be caught first
          const error = new OperationCancelledError("Cancelled");
          const result = yield* _(Effect.exit(handleNodeError(error)));

          expect(result._tag).toBe("Failure");
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(result.cause.error).toBeInstanceOf(OperationCancelledError);
          }
        }),
    );
  });
});
