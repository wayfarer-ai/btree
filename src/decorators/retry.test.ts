import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { MockAction } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { Retry, RetryUntilSuccessful } from "./retry.js";

describe("RetryUntilSuccessful", () => {
  let context: EffectTickContext;
  let retry: RetryUntilSuccessful;

  beforeEach(() => {
    context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };
    retry = new RetryUntilSuccessful({ id: "test-retry" });
  });

  it.live("should propagate ConfigurationError if no child is set", () =>
    Effect.gen(function* (_) {
      const result = yield* _(Effect.exit(retry.tick(context)));
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure" && result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(ConfigurationError);
        expect(result.cause.error.message).toContain(
          "Decorator must have a child",
        );
      }
    }),
  );

  it.live("should return SUCCESS immediately if child succeeds", () =>
    Effect.gen(function* (_) {
      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.SUCCESS,
      });

      retry.setChild(child);

      const status = yield* _(retry.tick(context));
      expect(status).toBe(NodeStatus.SUCCESS);
      expect(retry.status()).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.live("should retry on failure up to max attempts", () =>
    Effect.gen(function* (_) {
      retry = new RetryUntilSuccessful({
        id: "test-retry",
        maxAttempts: 3,
      });

      let attempts = 0;
      const child = new MockAction({ id: "child" });
      child.tick = (_ctx) =>
        Effect.gen(function* (_) {
          attempts++;
          if (attempts < 3) {
            (child as unknown)._status = NodeStatus.FAILURE;
            return yield* _(Effect.succeed(NodeStatus.FAILURE));
          }
          (child as unknown)._status = NodeStatus.SUCCESS;
          return yield* _(Effect.succeed(NodeStatus.SUCCESS));
        });

      retry.setChild(child);

      // First tick - child fails
      let status = yield* _(retry.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);
      expect(attempts).toBe(1);

      // Second tick - child fails again
      status = yield* _(retry.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);
      expect(attempts).toBe(2);

      // Third tick - child succeeds
      status = yield* _(retry.tick(context));
      expect(status).toBe(NodeStatus.SUCCESS);
      expect(attempts).toBe(3);
    }),
  );

  it.live("should fail after max attempts", () =>
    Effect.gen(function* (_) {
      retry = new RetryUntilSuccessful({
        id: "test-retry",
        maxAttempts: 2,
      });

      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.FAILURE,
      });

      retry.setChild(child);

      // First tick - child fails
      let status = yield* _(retry.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);

      // Second tick - child fails, max attempts reached
      status = yield* _(retry.tick(context));
      expect(status).toBe(NodeStatus.FAILURE);
      expect(retry.status()).toBe(NodeStatus.FAILURE);
    }),
  );

  it.live("should pass through RUNNING status", () =>
    Effect.gen(function* (_) {
      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.RUNNING,
      });

      retry.setChild(child);

      const status = yield* _(retry.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);
      expect(retry.status()).toBe(NodeStatus.RUNNING);
    }),
  );

  it.live("should reset child between retry attempts", () =>
    Effect.gen(function* (_) {
      retry = new RetryUntilSuccessful({
        id: "test-retry",
        maxAttempts: 3,
      });

      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.FAILURE,
      });

      const resetSpy = vi.spyOn(child, "reset");

      retry.setChild(child);

      // First failure
      yield* _(retry.tick(context));

      // Second tick triggers reset
      yield* _(retry.tick(context));

      expect(resetSpy).toHaveBeenCalled();
    }),
  );

  describe("Retry delay", () => {
    it.live("should wait between retries when delay is configured", () =>
      Effect.gen(function* (_) {
        retry = new RetryUntilSuccessful({
          id: "test-retry",
          maxAttempts: 2,
          retryDelay: 50, // 50ms delay
        });

        const child = new MockAction({
          id: "child",
          returnStatus: NodeStatus.FAILURE,
        });

        retry.setChild(child);

        // First tick - child fails
        const startTime = Date.now();
        let status = yield* _(retry.tick(context));
        expect(status).toBe(NodeStatus.RUNNING);

        // Second tick - should be waiting
        status = yield* _(retry.tick(context));
        expect(status).toBe(NodeStatus.RUNNING);
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(50);

        // Wait for delay to complete
        yield* _(Effect.sleep("60 millis"));

        // Third tick - second attempt should fail, reaching max attempts
        status = yield* _(retry.tick(context));
        expect(status).toBe(NodeStatus.FAILURE); // Max attempts reached
      }),
    );

    it.live("should not delay when retryDelay is 0", () =>
      Effect.gen(function* (_) {
        retry = new RetryUntilSuccessful({
          id: "test-retry",
          maxAttempts: 2,
          retryDelay: 0,
        });

        let tickCount = 0;
        const child = new MockAction({ id: "child" });
        child.tick = (_ctx) =>
          Effect.gen(function* (_) {
            tickCount++;
            (child as unknown)._status = NodeStatus.FAILURE;
            return yield* _(Effect.succeed(NodeStatus.FAILURE));
          });

        retry.setChild(child);

        // First tick - child fails, immediate retry
        const status = yield* _(retry.tick(context));
        expect(status).toBe(NodeStatus.RUNNING);
        expect(tickCount).toBe(1);

        // Second tick should trigger another attempt immediately
        yield* _(retry.tick(context));
        expect(tickCount).toBe(2);
      }),
    );
  });

  it.live("should reset attempt count on success", () =>
    Effect.gen(function* (_) {
      retry = new RetryUntilSuccessful({
        id: "test-retry",
        maxAttempts: 3,
      });

      let callCount = 0;
      const child = new MockAction({ id: "child" });
      child.tick = (_ctx) =>
        Effect.gen(function* (_) {
          callCount++;
          if (callCount === 2) {
            (child as unknown)._status = NodeStatus.SUCCESS;
            return yield* _(Effect.succeed(NodeStatus.SUCCESS));
          }
          (child as unknown)._status = NodeStatus.FAILURE;
          return yield* _(Effect.succeed(NodeStatus.FAILURE));
        });

      retry.setChild(child);

      // First execution - fails once, then succeeds
      yield* _(retry.tick(context));
      yield* _(retry.tick(context));
      expect(retry.status()).toBe(NodeStatus.SUCCESS);

      // Reset for second execution
      retry.reset();
      child.reset();
      callCount = 0;

      // Should start counting from 0 again
      yield* _(retry.tick(context));
      expect(callCount).toBe(1);
    }),
  );

  it.live("should handle halt correctly", () =>
    Effect.gen(function* (_) {
      retry = new RetryUntilSuccessful({
        id: "test-retry",
        maxAttempts: 3,
        retryDelay: 100,
      });

      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.FAILURE,
      });

      retry.setChild(child);

      // Start retry with delay
      yield* _(retry.tick(context));
      expect(retry.status()).toBe(NodeStatus.RUNNING);

      // Halt while waiting
      retry.halt();

      expect(retry.status()).toBe(NodeStatus.IDLE);
      expect((retry as unknown).currentAttempt).toBe(0);
      expect((retry as unknown).isWaiting).toBe(false);
    }),
  );
});

describe("Retry", () => {
  it("should be an alias for RetryUntilSuccessful", () => {
    const retry = new Retry({ id: "test-retry" });
    expect(retry).toBeInstanceOf(RetryUntilSuccessful);
    expect(retry.type).toBe("Retry");
  });
});
