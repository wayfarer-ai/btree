/**
 * Tests for Repeat decorator
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { SuccessNode } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { Repeat } from "./repeat.js";

describe("Repeat", () => {
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

  it.effect("should execute child exactly N times", () =>
    Effect.gen(function* (_) {
      const repeat = new Repeat({ id: "repeat1", numCycles: 3 });

      let tickCount = 0;
      class CountingNode extends SuccessNode {
        tick(context: EffectTickContext) {
          tickCount++;
          return super.tick(context);
        }
      }

      repeat.setChild(new CountingNode({ id: "child" }));

      // First 2 ticks return RUNNING
      let result = yield* _(repeat.tick(context));
      expect(result).toBe(NodeStatus.RUNNING);
      expect(tickCount).toBe(1);

      result = yield* _(repeat.tick(context));
      expect(result).toBe(NodeStatus.RUNNING);
      expect(tickCount).toBe(2);

      // Third tick returns SUCCESS
      result = yield* _(repeat.tick(context));
      expect(result).toBe(NodeStatus.SUCCESS);
      expect(tickCount).toBe(3);
    }),
  );

  it.effect("should fail on child failure", () =>
    Effect.gen(function* (_) {
      const repeat = new Repeat({ id: "repeat1", numCycles: 5 });

      let tickCount = 0;
      class FailOnThird extends SuccessNode {
        tick(context: EffectTickContext) {
          const self = this;
          const superTick = super.tick.bind(this);
          return Effect.gen(function* (_) {
            tickCount++;
            if (tickCount === 3) {
              self._status = NodeStatus.FAILURE;
              return yield* _(Effect.succeed(NodeStatus.FAILURE));
            }
            return yield* _(superTick(context));
          });
        }
      }

      repeat.setChild(new FailOnThird({ id: "child" }));

      yield* _(repeat.tick(context)); // Cycle 1
      yield* _(repeat.tick(context)); // Cycle 2
      const result = yield* _(repeat.tick(context)); // Cycle 3 fails

      expect(result).toBe(NodeStatus.FAILURE);
      expect(tickCount).toBe(3);
    }),
  );

  it.effect("should reset child between cycles", () =>
    Effect.gen(function* (_) {
      const repeat = new Repeat({ id: "repeat1", numCycles: 3 });

      let resetCount = 0;
      class ResetTracker extends SuccessNode {
        reset(): void {
          resetCount++;
          super.reset();
        }
      }

      repeat.setChild(new ResetTracker({ id: "child" }));

      yield* _(repeat.tick(context)); // Cycle 1, reset after
      yield* _(repeat.tick(context)); // Cycle 2, reset after
      yield* _(repeat.tick(context)); // Cycle 3, completes

      expect(resetCount).toBe(2); // Reset after cycles 1 and 2
    }),
  );

  it.effect("should handle RUNNING state", () =>
    Effect.gen(function* (_) {
      const repeat = new Repeat({ id: "repeat1", numCycles: 2 });

      let tickCount = 0;
      class TwoTickNode extends SuccessNode {
        tick(context: EffectTickContext) {
          const self = this;
          const superTick = super.tick.bind(this);
          return Effect.gen(function* (_) {
            tickCount++;
            if (tickCount % 2 === 1) {
              // Odd ticks return RUNNING
              self._status = NodeStatus.RUNNING;
              return yield* _(Effect.succeed(NodeStatus.RUNNING));
            }
            return yield* _(superTick(context));
          });
        }
      }

      repeat.setChild(new TwoTickNode({ id: "child" }));

      // Cycle 1: tick 1 (RUNNING), tick 2 (SUCCESS)
      let result = yield* _(repeat.tick(context));
      expect(result).toBe(NodeStatus.RUNNING);
      result = yield* _(repeat.tick(context));
      expect(result).toBe(NodeStatus.RUNNING); // Still more cycles

      // Cycle 2: tick 3 (RUNNING), tick 4 (SUCCESS)
      result = yield* _(repeat.tick(context));
      expect(result).toBe(NodeStatus.RUNNING);
      result = yield* _(repeat.tick(context));
      expect(result).toBe(NodeStatus.SUCCESS);

      expect(tickCount).toBe(4);
    }),
  );

  it.effect("should reset cycle count on completion", () =>
    Effect.gen(function* (_) {
      const repeat = new Repeat({ id: "repeat1", numCycles: 2 });

      let firstRunTicks = 0;
      let secondRunTicks = 0;
      let inSecondRun = false;

      class CountingNode extends SuccessNode {
        tick(context: EffectTickContext) {
          const superTick = super.tick.bind(this);
          return Effect.gen(function* (_) {
            if (inSecondRun) {
              secondRunTicks++;
            } else {
              firstRunTicks++;
            }
            return yield* _(superTick(context));
          });
        }
      }

      repeat.setChild(new CountingNode({ id: "child" }));

      // First run
      yield* _(repeat.tick(context));
      yield* _(repeat.tick(context));
      expect(firstRunTicks).toBe(2);

      // Second run
      inSecondRun = true;
      yield* _(repeat.tick(context));
      yield* _(repeat.tick(context));
      expect(secondRunTicks).toBe(2);
    }),
  );

  it.effect("should propagate ConfigurationError if no child", () =>
    Effect.gen(function* (_) {
      const repeat = new Repeat({ id: "repeat1", numCycles: 1 });

      const result = yield* _(Effect.exit(repeat.tick(context)));
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure" && result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(ConfigurationError);
        expect(result.cause.error.message).toContain("Repeat requires a child");
      }
    }),
  );
});
