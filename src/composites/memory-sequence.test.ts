/**
 * Tests for MemorySequence node
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { FailureNode, RunningNode, SuccessNode } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { MemorySequence, SequenceWithMemory } from "./memory-sequence.js";

describe("MemorySequence", () => {
  let blackboard: ScopedBlackboard;
  let context: TemporalContext;

  beforeEach(() => {
    blackboard = new ScopedBlackboard("root");
    context = {
      blackboard,
      timestamp: Date.now(),
      deltaTime: 0,
    };
  });

  describe("Basic Functionality", () => {
    it("should execute children in order", async () => {
      const seq = new MemorySequence({ id: "seq1" });
      const child1 = new SuccessNode({ id: "child1" });
      const child2 = new SuccessNode({ id: "child2" });
      const child3 = new SuccessNode({ id: "child3" });

      seq.addChildren([child1, child2, child3]);

      const result = await seq.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
    });

    it("should fail fast on first failure", async () => {
      const seq = new MemorySequence({ id: "seq1" });
      const child1 = new SuccessNode({ id: "child1" });
      const child2 = new FailureNode({ id: "child2" });
      const child3 = new SuccessNode({ id: "child3" });

      seq.addChildren([child1, child2, child3]);

      const result = await seq.tick(context);
      expect(result).toBe(NodeStatus.FAILURE);
      expect(child3.status()).toBe(NodeStatus.IDLE); // Never executed
    });
  });

  describe("Memory Behavior", () => {
    it("should skip completed children on retry after failure", async () => {
      const seq = new MemorySequence({ id: "seq1" });

      // Track execution count for each child
      let child1Ticks = 0;
      let child2Ticks = 0;
      let child3Ticks = 0;

      class CountingSuccess extends SuccessNode {
        async tick(context: TemporalContext): Promise<NodeStatus> {
          const superTick = super.tick.bind(this);
          if (this.id === "child1") child1Ticks++;
          if (this.id === "child2") child2Ticks++;
          if (this.id === "child3") child3Ticks++;
          return await superTick(context);
        }
      }

      const child1 = new CountingSuccess({ id: "child1" });
      const child2 = new CountingSuccess({ id: "child2" });

      // Child3 fails first time, succeeds second
      let child3TickCount = 0;
      class FlipFlopNode extends SuccessNode {
        async tick(context: TemporalContext): Promise<NodeStatus> {
          const superTick = super.tick.bind(this);
          child3TickCount++;
          child3Ticks++;
          // Fail first time, succeed second
          if (child3TickCount === 1) {
            this._status = NodeStatus.FAILURE;
            return NodeStatus.FAILURE;
          }
          return await superTick(context);
        }
      }

      const child3 = new FlipFlopNode({ id: "child3" });

      seq.addChildren([child1, child2, child3]);

      // First tick: child1 and child2 succeed, child3 fails
      let result = await seq.tick(context);
      expect(result).toBe(NodeStatus.FAILURE);
      expect(child1Ticks).toBe(1);
      expect(child2Ticks).toBe(1);
      expect(child3Ticks).toBe(1);

      // Second tick: should skip child1 and child2, go straight to child3
      result = await seq.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
      expect(child1Ticks).toBe(1); // Not re-executed
      expect(child2Ticks).toBe(1); // Not re-executed
      expect(child3Ticks).toBe(2); // Re-executed (not completed before)
    });

    it("should remember successful children across ticks", async () => {
      const seq = new MemorySequence({ id: "seq1" });

      const child1 = new SuccessNode({ id: "child1" });

      // Child2 returns RUNNING first time, SUCCESS second time
      let child2TickCount = 0;
      class TwoTickNode extends SuccessNode {
        async tick(context: TemporalContext): Promise<NodeStatus> {
          const superTick = super.tick.bind(this);
          child2TickCount++;
          if (child2TickCount === 1) {
            this._status = NodeStatus.RUNNING;
            return NodeStatus.RUNNING;
          }
          return await superTick(context);
        }
      }

      const child2 = new TwoTickNode({ id: "child2" });
      const child3 = new SuccessNode({ id: "child3" });

      seq.addChildren([child1, child2, child3]);

      // First tick: child1 succeeds, child2 returns RUNNING
      let result = await seq.tick(context);
      expect(result).toBe(NodeStatus.RUNNING);
      expect(child1.status()).toBe(NodeStatus.SUCCESS);
      expect(child2.status()).toBe(NodeStatus.RUNNING);
      expect(child3.status()).toBe(NodeStatus.IDLE);

      // Second tick: should skip child1, continue from child2 which now succeeds
      result = await seq.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
      expect(child2TickCount).toBe(2);
      expect(child3.status()).toBe(NodeStatus.SUCCESS);
    });

    it("should not skip RUNNING children", async () => {
      const seq = new MemorySequence({ id: "seq1" });

      const child1 = new SuccessNode({ id: "child1" });
      const child2 = new RunningNode({ id: "child2" });

      seq.addChildren([child1, child2]);

      // First tick: child1 succeeds, child2 running
      let result = await seq.tick(context);
      expect(result).toBe(NodeStatus.RUNNING);

      // Second tick: child2 still running, should be ticked again
      result = await seq.tick(context);
      expect(result).toBe(NodeStatus.RUNNING);
      expect(child2.status()).toBe(NodeStatus.RUNNING);
    });

    it("should clear memory on reset", async () => {
      const seq = new MemorySequence({ id: "seq1" });

      let child1Ticks = 0;
      class CountingSuccess extends SuccessNode {
        async tick(context: TemporalContext): Promise<NodeStatus> {
          const superTick = super.tick.bind(this);
          child1Ticks++;
          return await superTick(context);
        }
      }

      const child1 = new CountingSuccess({ id: "child1" });
      const child2 = new FailureNode({ id: "child2" });

      seq.addChildren([child1, child2]);

      // First execution: child1 succeeds, child2 fails
      await seq.tick(context);
      expect(child1Ticks).toBe(1);

      // Reset should clear memory
      seq.reset();

      // Second execution: child1 should be re-executed
      await seq.tick(context);
      expect(child1Ticks).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty children array", async () => {
      const seq = new MemorySequence({ id: "seq1" });
      const result = await seq.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
    });

    it("should handle single child", async () => {
      const seq = new MemorySequence({ id: "seq1" });
      const child = new SuccessNode({ id: "child1" });
      seq.addChild(child);

      const result = await seq.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
    });
  });

  describe("Alias", () => {
    it("should work with SequenceWithMemory alias", async () => {
      const seq = new SequenceWithMemory({ id: "seq1" });
      const child1 = new SuccessNode({ id: "child1" });
      const child2 = new SuccessNode({ id: "child2" });

      seq.addChildren([child1, child2]);

      const result = await seq.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
    });
  });
});
