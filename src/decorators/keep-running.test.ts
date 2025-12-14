/**
 * Tests for KeepRunningUntilFailure decorator
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { FailureNode, SuccessNode } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { KeepRunningUntilFailure } from "./keep-running.js";

describe("KeepRunningUntilFailure", () => {
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

  it.effect("should return RUNNING while child succeeds", () =>
    Effect.gen(function* (_) {
      const keep = new KeepRunningUntilFailure({ id: "keep1" });
      keep.setChild(new SuccessNode({ id: "child" }));

      const result = yield* _(keep.tick(context));
      expect(result).toBe(NodeStatus.RUNNING);
    }),
  );

  it.effect("should return SUCCESS on child failure", () =>
    Effect.gen(function* (_) {
      const keep = new KeepRunningUntilFailure({ id: "keep1" });
      keep.setChild(new FailureNode({ id: "child" }));

      const result = yield* _(keep.tick(context));
      expect(result).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should reset child between ticks", () =>
    Effect.gen(function* (_) {
      const keep = new KeepRunningUntilFailure({ id: "keep1" });

      let tickCount = 0;
      class CountingNode extends SuccessNode {
        tick(context: EffectTickContext) {
          tickCount++;
          return super.tick(context);
        }
      }

      keep.setChild(new CountingNode({ id: "child" }));

      yield* _(keep.tick(context));
      yield* _(keep.tick(context));
      yield* _(keep.tick(context));

      expect(tickCount).toBe(3); // Ticked 3 times (reset between each)
    }),
  );

  it.effect("should propagate RUNNING from child", () =>
    Effect.gen(function* (_) {
      const keep = new KeepRunningUntilFailure({ id: "keep1" });

      let tickCount = 0;
      class RunningThenFail extends SuccessNode {
        tick(_context: EffectTickContext) {
          const self = this;
          return Effect.gen(function* (_) {
            tickCount++;
            if (tickCount < 3) {
              self._status = NodeStatus.RUNNING;
              return yield* _(Effect.succeed(NodeStatus.RUNNING));
            }
            self._status = NodeStatus.FAILURE;
            return yield* _(Effect.succeed(NodeStatus.FAILURE));
          });
        }
      }

      keep.setChild(new RunningThenFail({ id: "child" }));

      let result = yield* _(keep.tick(context));
      expect(result).toBe(NodeStatus.RUNNING);

      result = yield* _(keep.tick(context));
      expect(result).toBe(NodeStatus.RUNNING);

      result = yield* _(keep.tick(context));
      expect(result).toBe(NodeStatus.SUCCESS); // Child failed
    }),
  );

  it.effect("should propagate ConfigurationError if no child", () =>
    Effect.gen(function* (_) {
      const keep = new KeepRunningUntilFailure({ id: "keep1" });

      const result = yield* _(Effect.exit(keep.tick(context)));
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure" && result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(ConfigurationError);
        expect(result.cause.error.message).toContain(
          "KeepRunningUntilFailure requires a child",
        );
      }
    }),
  );
});
