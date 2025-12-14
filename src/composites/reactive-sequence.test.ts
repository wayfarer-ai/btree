/**
 * Tests for ReactiveSequence node
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { FailureNode, SuccessNode } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { ReactiveSequence } from "./reactive-sequence.js";

describe("ReactiveSequence", () => {
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

  describe("Basic Functionality", () => {
    it.effect("should execute children in order", () =>
      Effect.gen(function* (_) {
        const seq = new ReactiveSequence({ id: "seq1" });
        const child1 = new SuccessNode({ id: "child1" });
        const child2 = new SuccessNode({ id: "child2" });
        const child3 = new SuccessNode({ id: "child3" });

        seq.addChildren([child1, child2, child3]);

        const result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
      }),
    );

    it.effect("should fail fast on first failure", () =>
      Effect.gen(function* (_) {
        const seq = new ReactiveSequence({ id: "seq1" });
        const child1 = new SuccessNode({ id: "child1" });
        const child2 = new FailureNode({ id: "child2" });
        const child3 = new SuccessNode({ id: "child3" });

        seq.addChildren([child1, child2, child3]);

        const result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.FAILURE);
        expect(child3.status()).toBe(NodeStatus.IDLE); // Never executed
      }),
    );
  });

  describe("Reactive Behavior", () => {
    it.effect("should restart from beginning each tick", () =>
      Effect.gen(function* (_) {
        const seq = new ReactiveSequence({ id: "seq1" });

        // Track ticks for each child
        let child1Ticks = 0;
        let child2Ticks = 0;

        class CountingSuccess extends SuccessNode {
          tick(context: EffectTickContext) {
            const self = this;
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              if (self.id === "child1") child1Ticks++;
              if (self.id === "child2") child2Ticks++;
              return yield* _(superTick(context));
            });
          }
        }

        const child1 = new CountingSuccess({ id: "child1" });
        const child2 = new CountingSuccess({ id: "child2" });

        // Child3 runs first time, succeeds second time
        let child3TickCount = 0;
        class TwoTickNode extends SuccessNode {
          tick(context: EffectTickContext) {
            const self = this;
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              child3TickCount++;
              if (child3TickCount === 1) {
                self._status = NodeStatus.RUNNING;
                return yield* _(Effect.succeed(NodeStatus.RUNNING));
              }
              return yield* _(superTick(context));
            });
          }
        }
        const child3 = new TwoTickNode({ id: "child3" });

        seq.addChildren([child1, child2, child3]);

        // First tick: child1, child2 succeed, child3 returns RUNNING
        let result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.RUNNING);
        expect(child1Ticks).toBe(1);
        expect(child2Ticks).toBe(1);
        expect(child3TickCount).toBe(1);

        // Second tick: should restart from child1 (reactive behavior)
        result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(child1Ticks).toBe(2); // Re-executed
        expect(child2Ticks).toBe(2); // Re-executed
        expect(child3TickCount).toBe(2);
      }),
    );

    it.effect("should re-evaluate conditions that might change", () =>
      Effect.gen(function* (_) {
        const seq = new ReactiveSequence({ id: "seq1" });

        // Condition that checks blackboard value
        let conditionTicks = 0;
        class CheckValueCondition extends SuccessNode {
          tick(context: EffectTickContext) {
            const self = this;
            return Effect.gen(function* (_) {
              conditionTicks++;
              const value = context.blackboard.get("shouldContinue");
              self._status = value ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
              return yield* _(Effect.succeed(self._status));
            });
          }
        }

        const condition = new CheckValueCondition({ id: "condition" });

        // Action that stays running
        let actionTicks = 0;
        class RunningAction extends SuccessNode {
          tick(_context: EffectTickContext) {
            const self = this;
            return Effect.gen(function* (_) {
              actionTicks++;
              self._status = NodeStatus.RUNNING;
              return yield* _(Effect.succeed(NodeStatus.RUNNING));
            });
          }
        }
        const action = new RunningAction({ id: "action" });

        seq.addChildren([condition, action]);

        // First tick: condition true, action runs
        blackboard.set("shouldContinue", true);
        let result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.RUNNING);
        expect(conditionTicks).toBe(1);
        expect(actionTicks).toBe(1);

        // Second tick: condition still true, both re-evaluated
        result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.RUNNING);
        expect(conditionTicks).toBe(2); // Condition re-checked
        expect(actionTicks).toBe(2);

        // Third tick: condition becomes false, sequence fails
        blackboard.set("shouldContinue", false);
        result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.FAILURE);
        expect(conditionTicks).toBe(3); // Condition re-checked again
        expect(actionTicks).toBe(2); // Action not ticked (condition failed)
      }),
    );
  });

  describe("Edge Cases", () => {
    it.effect("should handle empty children array", () =>
      Effect.gen(function* (_) {
        const seq = new ReactiveSequence({ id: "seq1" });
        const result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
      }),
    );

    it.effect("should handle single child", () =>
      Effect.gen(function* (_) {
        const seq = new ReactiveSequence({ id: "seq1" });
        const child = new SuccessNode({ id: "child1" });
        seq.addChild(child);

        const result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
      }),
    );
  });
});
