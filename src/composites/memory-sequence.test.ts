/**
 * Tests for MemorySequence node
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { FailureNode, RunningNode, SuccessNode } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { MemorySequence, SequenceWithMemory } from "./memory-sequence.js";

describe("MemorySequence", () => {
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
        const seq = new MemorySequence({ id: "seq1" });
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
        const seq = new MemorySequence({ id: "seq1" });
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

  describe("Memory Behavior", () => {
    it.effect("should skip completed children on retry after failure", () =>
      Effect.gen(function* (_) {
        const seq = new MemorySequence({ id: "seq1" });

        // Track execution count for each child
        let child1Ticks = 0;
        let child2Ticks = 0;
        let child3Ticks = 0;

        class CountingSuccess extends SuccessNode {
          tick(context: EffectTickContext) {
            const self = this;
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              if (self.id === "child1") child1Ticks++;
              if (self.id === "child2") child2Ticks++;
              if (self.id === "child3") child3Ticks++;
              return yield* _(superTick(context));
            });
          }
        }

        const child1 = new CountingSuccess({ id: "child1" });
        const child2 = new CountingSuccess({ id: "child2" });

        // Child3 fails first time, succeeds second
        let child3TickCount = 0;
        class FlipFlopNode extends SuccessNode {
          tick(context: EffectTickContext) {
            const self = this;
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              child3TickCount++;
              child3Ticks++;
              // Fail first time, succeed second
              if (child3TickCount === 1) {
                self._status = NodeStatus.FAILURE;
                return yield* _(Effect.succeed(NodeStatus.FAILURE));
              }
              return yield* _(superTick(context));
            });
          }
        }

        const child3 = new FlipFlopNode({ id: "child3" });

        seq.addChildren([child1, child2, child3]);

        // First tick: child1 and child2 succeed, child3 fails
        let result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.FAILURE);
        expect(child1Ticks).toBe(1);
        expect(child2Ticks).toBe(1);
        expect(child3Ticks).toBe(1);

        // Second tick: should skip child1 and child2, go straight to child3
        result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(child1Ticks).toBe(1); // Not re-executed
        expect(child2Ticks).toBe(1); // Not re-executed
        expect(child3Ticks).toBe(2); // Re-executed (not completed before)
      }),
    );

    it.effect("should remember successful children across ticks", () =>
      Effect.gen(function* (_) {
        const seq = new MemorySequence({ id: "seq1" });

        const child1 = new SuccessNode({ id: "child1" });

        // Child2 returns RUNNING first time, SUCCESS second time
        let child2TickCount = 0;
        class TwoTickNode extends SuccessNode {
          tick(context: EffectTickContext) {
            const self = this;
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              child2TickCount++;
              if (child2TickCount === 1) {
                self._status = NodeStatus.RUNNING;
                return yield* _(Effect.succeed(NodeStatus.RUNNING));
              }
              return yield* _(superTick(context));
            });
          }
        }

        const child2 = new TwoTickNode({ id: "child2" });
        const child3 = new SuccessNode({ id: "child3" });

        seq.addChildren([child1, child2, child3]);

        // First tick: child1 succeeds, child2 returns RUNNING
        let result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.RUNNING);
        expect(child1.status()).toBe(NodeStatus.SUCCESS);
        expect(child2.status()).toBe(NodeStatus.RUNNING);
        expect(child3.status()).toBe(NodeStatus.IDLE);

        // Second tick: should skip child1, continue from child2 which now succeeds
        result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(child2TickCount).toBe(2);
        expect(child3.status()).toBe(NodeStatus.SUCCESS);
      }),
    );

    it.effect("should not skip RUNNING children", () =>
      Effect.gen(function* (_) {
        const seq = new MemorySequence({ id: "seq1" });

        const child1 = new SuccessNode({ id: "child1" });
        const child2 = new RunningNode({ id: "child2" });

        seq.addChildren([child1, child2]);

        // First tick: child1 succeeds, child2 running
        let result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.RUNNING);

        // Second tick: child2 still running, should be ticked again
        result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.RUNNING);
        expect(child2.status()).toBe(NodeStatus.RUNNING);
      }),
    );

    it.effect("should clear memory on reset", () =>
      Effect.gen(function* (_) {
        const seq = new MemorySequence({ id: "seq1" });

        let child1Ticks = 0;
        class CountingSuccess extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              child1Ticks++;
              return yield* _(superTick(context));
            });
          }
        }

        const child1 = new CountingSuccess({ id: "child1" });
        const child2 = new FailureNode({ id: "child2" });

        seq.addChildren([child1, child2]);

        // First execution: child1 succeeds, child2 fails
        yield* _(seq.tick(context));
        expect(child1Ticks).toBe(1);

        // Reset should clear memory
        seq.reset();

        // Second execution: child1 should be re-executed
        yield* _(seq.tick(context));
        expect(child1Ticks).toBe(2);
      }),
    );
  });

  describe("Edge Cases", () => {
    it.effect("should handle empty children array", () =>
      Effect.gen(function* (_) {
        const seq = new MemorySequence({ id: "seq1" });
        const result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
      }),
    );

    it.effect("should handle single child", () =>
      Effect.gen(function* (_) {
        const seq = new MemorySequence({ id: "seq1" });
        const child = new SuccessNode({ id: "child1" });
        seq.addChild(child);

        const result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
      }),
    );
  });

  describe("Alias", () => {
    it.effect("should work with SequenceWithMemory alias", () =>
      Effect.gen(function* (_) {
        const seq = new SequenceWithMemory({ id: "seq1" });
        const child1 = new SuccessNode({ id: "child1" });
        const child2 = new SuccessNode({ id: "child2" });

        seq.addChildren([child1, child2]);

        const result = yield* _(seq.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
      }),
    );
  });
});
