import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { MockAction } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { Invert } from "./invert.js";

describe("Invert", () => {
  let context: EffectTickContext;
  let invert: Invert;

  beforeEach(() => {
    context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };
    invert = new Invert({ id: "test-invert" });
  });

  it.effect("should propagate ConfigurationError if no child is set", () =>
    Effect.gen(function* (_) {
      const result = yield* _(Effect.exit(invert.tick(context)));
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure" && result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(ConfigurationError);
        expect(result.cause.error.message).toContain(
          "Decorator must have a child",
        );
      }
    }),
  );

  it.effect("should invert SUCCESS to FAILURE", () =>
    Effect.gen(function* (_) {
      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.SUCCESS,
      });

      invert.setChild(child);

      const status = yield* _(invert.tick(context));
      expect(status).toBe(NodeStatus.FAILURE);
      expect(invert.status()).toBe(NodeStatus.FAILURE);
    }),
  );

  it.effect("should invert FAILURE to SUCCESS", () =>
    Effect.gen(function* (_) {
      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.FAILURE,
      });

      invert.setChild(child);

      const status = yield* _(invert.tick(context));
      expect(status).toBe(NodeStatus.SUCCESS);
      expect(invert.status()).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should pass through RUNNING status", () =>
    Effect.gen(function* (_) {
      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.RUNNING,
      });

      invert.setChild(child);

      const status = yield* _(invert.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);
      expect(invert.status()).toBe(NodeStatus.RUNNING);
    }),
  );

  it.effect("should pass through other statuses unchanged", () =>
    Effect.gen(function* (_) {
      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.IDLE,
      });

      invert.setChild(child);

      const status = yield* _(invert.tick(context));
      expect(status).toBe(NodeStatus.IDLE);
    }),
  );

  it("should properly propagate halt to child", () => {
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.RUNNING,
    });

    invert.setChild(child);

    // Set child to RUNNING state
    (child as unknown)._status = NodeStatus.RUNNING;

    // Halt the invert decorator
    invert.halt();

    expect(child.status()).toBe(NodeStatus.IDLE);
  });

  it("should properly propagate reset to child", () => {
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
    });

    invert.setChild(child);

    // Set child to SUCCESS state
    (child as unknown)._status = NodeStatus.SUCCESS;

    // Reset the invert decorator
    invert.reset();

    expect(child.status()).toBe(NodeStatus.IDLE);
  });

  it.effect("should work with async children", () =>
    Effect.gen(function* (_) {
      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.SUCCESS,
        ticksBeforeComplete: 2, // Will return RUNNING first
      });

      invert.setChild(child);

      // First tick - child returns RUNNING
      let status = yield* _(invert.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);

      // Second tick - child returns SUCCESS, inverted to FAILURE
      status = yield* _(invert.tick(context));
      expect(status).toBe(NodeStatus.FAILURE);
    }),
  );
});
