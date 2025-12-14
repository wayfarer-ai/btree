import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { MockAction, WaitAction } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { Timeout } from "./timeout.js";

describe("Timeout", () => {
  let context: EffectTickContext;

  beforeEach(() => {
    context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };
  });

  it("should throw error if timeoutMs is not positive", () => {
    expect(() => new Timeout({ id: "test", timeoutMs: 0 })).toThrow(
      "test: Timeout must be positive (got 0)",
    );

    expect(() => new Timeout({ id: "test", timeoutMs: -100 })).toThrow(
      "test: Timeout must be positive (got -100)",
    );
  });

  it.live("should propagate ConfigurationError if no child is set", () =>
    Effect.gen(function* (_) {
      const timeout = new Timeout({ id: "test-timeout", timeoutMs: 1000 });
      const result = yield* _(Effect.exit(timeout.tick(context)));
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure" && result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(ConfigurationError);
        expect(result.cause.error.message).toContain(
          "Decorator must have a child",
        );
      }
    }),
  );

  it.live("should pass through immediate SUCCESS", () =>
    Effect.gen(function* (_) {
      const timeout = new Timeout({ id: "test-timeout", timeoutMs: 1000 });
      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.SUCCESS,
      });

      timeout.setChild(child);

      const status = yield* _(timeout.tick(context));
      expect(status).toBe(NodeStatus.SUCCESS);
      expect(timeout.status()).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.live("should pass through immediate FAILURE", () =>
    Effect.gen(function* (_) {
      const timeout = new Timeout({ id: "test-timeout", timeoutMs: 1000 });
      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.FAILURE,
      });

      timeout.setChild(child);

      const status = yield* _(timeout.tick(context));
      expect(status).toBe(NodeStatus.FAILURE);
      expect(timeout.status()).toBe(NodeStatus.FAILURE);
    }),
  );

  it.live("should fail if child takes too long", () =>
    Effect.gen(function* (_) {
      const timeout = new Timeout({ id: "test-timeout", timeoutMs: 50 });
      const child = new WaitAction({
        id: "child",
        waitMs: 200, // Will take longer than timeout
      });

      timeout.setChild(child);

      // First tick - child starts running
      let status = yield* _(timeout.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);

      // Wait for timeout to elapse
      yield* _(Effect.sleep("60 millis"));

      // Next tick should fail due to timeout
      status = yield* _(timeout.tick(context));
      expect(status).toBe(NodeStatus.FAILURE);
      expect(child.status()).toBe(NodeStatus.IDLE); // Child should be halted
    }),
  );

  it.live("should succeed if child completes before timeout", () =>
    Effect.gen(function* (_) {
      const timeout = new Timeout({ id: "test-timeout", timeoutMs: 100 });
      const child = new WaitAction({
        id: "child",
        waitMs: 30, // Will complete before timeout
      });

      timeout.setChild(child);

      // First tick - child starts running
      let status = yield* _(timeout.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);

      // Wait for child to complete
      yield* _(Effect.sleep("40 millis"));

      // Next tick should succeed
      status = yield* _(timeout.tick(context));
      expect(status).toBe(NodeStatus.SUCCESS);
      expect(timeout.status()).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.live("should halt child when timeout is reached", () =>
    Effect.gen(function* (_) {
      const timeout = new Timeout({ id: "test-timeout", timeoutMs: 50 });
      const child = new WaitAction({
        id: "child",
        waitMs: 200,
      });

      const haltSpy = vi.spyOn(child, "halt");

      timeout.setChild(child);

      // Start execution
      yield* _(timeout.tick(context));

      // Wait for timeout
      yield* _(Effect.sleep("60 millis"));

      // Next tick should halt the child
      yield* _(timeout.tick(context));

      expect(haltSpy).toHaveBeenCalled();
    }),
  );

  it.live("should cleanup timeout on completion", () =>
    Effect.gen(function* (_) {
      const timeout = new Timeout({ id: "test-timeout", timeoutMs: 1000 });
      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.SUCCESS,
      });

      timeout.setChild(child);

      yield* _(timeout.tick(context));

      // Check internal state is cleaned up
      expect((timeout as unknown).startTime).toBeNull();
    }),
  );

  it.live("should handle halt correctly", () =>
    Effect.gen(function* (_) {
      const timeout = new Timeout({ id: "test-timeout", timeoutMs: 1000 });
      const child = new WaitAction({
        id: "child",
        waitMs: 100,
      });

      timeout.setChild(child);

      // Start execution but don't await
      const tickEffect = timeout.tick(context);

      // Give it a moment to start
      yield* _(Effect.sleep("5 millis"));

      // Halt while running
      timeout.halt();

      // Status should be IDLE immediately after halt
      expect(timeout.status()).toBe(NodeStatus.IDLE);
      expect((timeout as unknown).startTime).toBeNull();

      // Wait for tick to complete or fail (may complete with error)
      try {
        yield* _(tickEffect);
      } catch (_e) {
        // Expected if halt interrupts execution
      }
    }),
  );

  it.live("should handle reset correctly", () =>
    Effect.gen(function* (_) {
      const timeout = new Timeout({ id: "test-timeout", timeoutMs: 1000 });
      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.SUCCESS,
      });

      timeout.setChild(child);

      // Execute
      yield* _(timeout.tick(context));

      // Reset
      timeout.reset();

      expect(timeout.status()).toBe(NodeStatus.IDLE);
      expect((timeout as unknown).startTime).toBeNull();
    }),
  );

  it.live("should handle multiple ticks while waiting", () =>
    Effect.gen(function* (_) {
      const timeout = new Timeout({ id: "test-timeout", timeoutMs: 100 });
      const child = new WaitAction({
        id: "child",
        waitMs: 50,
      });

      timeout.setChild(child);

      // Multiple ticks while child is running
      let status = yield* _(timeout.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);

      status = yield* _(timeout.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);

      // Wait for child to complete
      yield* _(Effect.sleep("60 millis"));

      status = yield* _(timeout.tick(context));
      expect(status).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.live("should fail immediately if already timed out", () =>
    Effect.gen(function* (_) {
      const timeout = new Timeout({ id: "test-timeout", timeoutMs: 50 });
      const child = new WaitAction({
        id: "child",
        waitMs: 200,
      });

      timeout.setChild(child);

      // Start and wait for timeout
      yield* _(timeout.tick(context));
      yield* _(Effect.sleep("60 millis"));

      // Second tick after timeout elapsed - should fail immediately
      const status = yield* _(timeout.tick(context));
      expect(status).toBe(NodeStatus.FAILURE);
    }),
  );

  it.live("should handle timeout during child execution", () =>
    Effect.gen(function* (_) {
      const timeout = new Timeout({ id: "test-timeout", timeoutMs: 20 });

      // Child that will definitely take longer than timeout
      const child = new WaitAction({
        id: "child",
        waitMs: 100, // Much longer than timeout
      });

      timeout.setChild(child);

      // First tick: should start timeout and return RUNNING
      const startTime = Date.now();
      let status = yield* _(timeout.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);
      expect(timeout.status()).toBe(NodeStatus.RUNNING);

      // Wait for timeout to occur
      yield* _(Effect.sleep("30 millis"));

      // Second tick: should detect timeout and return FAILURE
      status = yield* _(timeout.tick(context));
      const elapsed = Date.now() - startTime;

      // Should timeout after ~20ms, not wait for full 100ms
      expect(elapsed).toBeLessThan(50); // Give some buffer for test environment
      expect(status).toBe(NodeStatus.FAILURE);
      expect(timeout.status()).toBe(NodeStatus.FAILURE);

      // Child should have been halted
      expect(child.status()).toBe(NodeStatus.IDLE);
    }),
  );
});
