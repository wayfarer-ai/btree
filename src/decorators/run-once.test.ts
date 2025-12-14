/**
 * Tests for RunOnce decorator
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { FailureNode, SuccessNode } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { RunOnce } from "./run-once.js";

describe("RunOnce", () => {
  let blackboard: ScopedBlackboard;
  let context: EffectTickContext;

  beforeEach(() => {
    blackboard = new ScopedBlackboard("root");
    context = {
      blackboard,
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };
  });

  it.effect("should execute child once", () =>
    Effect.gen(function* (_) {
      const runOnce = new RunOnce({ id: "once1" });

      let tickCount = 0;
      class CountingNode extends SuccessNode {
        tick(context: EffectTickContext) {
          tickCount++;
          return super.tick(context);
        }
      }

      runOnce.setChild(new CountingNode({ id: "child" }));

      yield* _(runOnce.tick(context));
      yield* _(runOnce.tick(context));
      yield* _(runOnce.tick(context));

      expect(tickCount).toBe(1); // Only executed once
    }),
  );

  it.effect("should cache SUCCESS result", () =>
    Effect.gen(function* (_) {
      const runOnce = new RunOnce({ id: "once1" });
      runOnce.setChild(new SuccessNode({ id: "child" }));

      const result1 = yield* _(runOnce.tick(context));
      const result2 = yield* _(runOnce.tick(context));
      const result3 = yield* _(runOnce.tick(context));

      expect(result1).toBe(NodeStatus.SUCCESS);
      expect(result2).toBe(NodeStatus.SUCCESS);
      expect(result3).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should cache FAILURE result", () =>
    Effect.gen(function* (_) {
      const runOnce = new RunOnce({ id: "once1" });
      runOnce.setChild(new FailureNode({ id: "child" }));

      const result1 = yield* _(runOnce.tick(context));
      const result2 = yield* _(runOnce.tick(context));

      expect(result1).toBe(NodeStatus.FAILURE);
      expect(result2).toBe(NodeStatus.FAILURE);
    }),
  );

  it.effect("should not cache RUNNING result", () =>
    Effect.gen(function* (_) {
      const runOnce = new RunOnce({ id: "once1" });

      let tickCount = 0;
      class RunningThenSuccess extends SuccessNode {
        tick(context: EffectTickContext) {
          const self = this;
          const superTick = super.tick.bind(this);
          return Effect.gen(function* (_) {
            tickCount++;
            if (tickCount < 3) {
              self._status = NodeStatus.RUNNING;
              return yield* _(Effect.succeed(NodeStatus.RUNNING));
            }
            return yield* _(superTick(context));
          });
        }
      }

      runOnce.setChild(new RunningThenSuccess({ id: "child" }));

      const result1 = yield* _(runOnce.tick(context)); // RUNNING
      const result2 = yield* _(runOnce.tick(context)); // RUNNING
      const result3 = yield* _(runOnce.tick(context)); // SUCCESS (cached)
      const result4 = yield* _(runOnce.tick(context)); // SUCCESS (from cache)

      expect(result1).toBe(NodeStatus.RUNNING);
      expect(result2).toBe(NodeStatus.RUNNING);
      expect(result3).toBe(NodeStatus.SUCCESS);
      expect(result4).toBe(NodeStatus.SUCCESS);
      expect(tickCount).toBe(3); // Ticked 3 times (not cached while RUNNING)
    }),
  );

  it.effect("should reset cache on reset", () =>
    Effect.gen(function* (_) {
      const runOnce = new RunOnce({ id: "once1" });

      let tickCount = 0;
      class CountingNode extends SuccessNode {
        tick(context: EffectTickContext) {
          tickCount++;
          return super.tick(context);
        }
      }

      runOnce.setChild(new CountingNode({ id: "child" }));

      // First execution
      yield* _(runOnce.tick(context));
      expect(tickCount).toBe(1);

      // Second tick - should use cache
      yield* _(runOnce.tick(context));
      expect(tickCount).toBe(1);

      // Reset
      runOnce.reset();

      // Third tick - should execute again
      yield* _(runOnce.tick(context));
      expect(tickCount).toBe(2);
    }),
  );

  it.effect("should propagate ConfigurationError if no child", () =>
    Effect.gen(function* (_) {
      const runOnce = new RunOnce({ id: "once1" });

      const result = yield* _(Effect.exit(runOnce.tick(context)));
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure" && result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(ConfigurationError);
        expect(result.cause.error.message).toContain(
          "RunOnce requires a child",
        );
      }
    }),
  );
});
