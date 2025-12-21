/**
 * Tests for ReactiveSequence node
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { FailureNode, SuccessNode } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { ReactiveSequence } from "./reactive-sequence.js";

describe("ReactiveSequence", () => {
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
      const seq = new ReactiveSequence({ id: "seq1" });
      const child1 = new SuccessNode({ id: "child1" });
      const child2 = new SuccessNode({ id: "child2" });
      const child3 = new SuccessNode({ id: "child3" });

      seq.addChildren([child1, child2, child3]);

      const result = await seq.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
    });

    it("should fail fast on first failure", async () => {
      const seq = new ReactiveSequence({ id: "seq1" });
      const child1 = new SuccessNode({ id: "child1" });
      const child2 = new FailureNode({ id: "child2" });
      const child3 = new SuccessNode({ id: "child3" });

      seq.addChildren([child1, child2, child3]);

      const result = await seq.tick(context);
      expect(result).toBe(NodeStatus.FAILURE);
      expect(child3.status()).toBe(NodeStatus.IDLE); // Never executed
    });
  });

  describe("Reactive Behavior", () => {
    it("should restart from beginning each tick", async () => {
      const seq = new ReactiveSequence({ id: "seq1" });

      // Track ticks for each child
      let child1Ticks = 0;
      let child2Ticks = 0;

      class CountingSuccess extends SuccessNode {
        async tick(context: TemporalContext): Promise<NodeStatus> {
          const superTick = super.tick.bind(this);
          if (this.id === "child1") child1Ticks++;
          if (this.id === "child2") child2Ticks++;
          return await superTick(context);
        }
      }

      const child1 = new CountingSuccess({ id: "child1" });
      const child2 = new CountingSuccess({ id: "child2" });

      // Child3 runs first time, succeeds second time
      let child3TickCount = 0;
      class TwoTickNode extends SuccessNode {
        async tick(context: TemporalContext): Promise<NodeStatus> {
          const superTick = super.tick.bind(this);
          child3TickCount++;
          if (child3TickCount === 1) {
            this._status = NodeStatus.RUNNING;
            return NodeStatus.RUNNING;
          }
          return await superTick(context);
        }
      }
      const child3 = new TwoTickNode({ id: "child3" });

      seq.addChildren([child1, child2, child3]);

      // First tick: child1, child2 succeed, child3 returns RUNNING
      let result = await seq.tick(context);
      expect(result).toBe(NodeStatus.RUNNING);
      expect(child1Ticks).toBe(1);
      expect(child2Ticks).toBe(1);
      expect(child3TickCount).toBe(1);

      // Second tick: should restart from child1 (reactive behavior)
      result = await seq.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
      expect(child1Ticks).toBe(2); // Re-executed
      expect(child2Ticks).toBe(2); // Re-executed
      expect(child3TickCount).toBe(2);
    });

    it("should re-evaluate conditions that might change", async () => {
      const seq = new ReactiveSequence({ id: "seq1" });

      // Condition that checks blackboard value
      let conditionTicks = 0;
      class CheckValueCondition extends SuccessNode {
        async tick(context: TemporalContext): Promise<NodeStatus> {
          conditionTicks++;
          const value = context.blackboard.get("shouldContinue");
          this._status = value ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
          return this._status;
        }
      }

      const condition = new CheckValueCondition({ id: "condition" });

      // Action that stays running
      let actionTicks = 0;
      class RunningAction extends SuccessNode {
        async tick(_context: TemporalContext): Promise<NodeStatus> {
          actionTicks++;
          this._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;
        }
      }
      const action = new RunningAction({ id: "action" });

      seq.addChildren([condition, action]);

      // First tick: condition true, action runs
      blackboard.set("shouldContinue", true);
      let result = await seq.tick(context);
      expect(result).toBe(NodeStatus.RUNNING);
      expect(conditionTicks).toBe(1);
      expect(actionTicks).toBe(1);

      // Second tick: condition still true, both re-evaluated
      result = await seq.tick(context);
      expect(result).toBe(NodeStatus.RUNNING);
      expect(conditionTicks).toBe(2); // Condition re-checked
      expect(actionTicks).toBe(2);

      // Third tick: condition becomes false, sequence fails
      blackboard.set("shouldContinue", false);
      result = await seq.tick(context);
      expect(result).toBe(NodeStatus.FAILURE);
      expect(conditionTicks).toBe(3); // Condition re-checked again
      expect(actionTicks).toBe(2); // Action not ticked (condition failed)
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty children array", async () => {
      const seq = new ReactiveSequence({ id: "seq1" });
      const result = await seq.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
    });

    it("should handle single child", async () => {
      const seq = new ReactiveSequence({ id: "seq1" });
      const child = new SuccessNode({ id: "child1" });
      seq.addChild(child);

      const result = await seq.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
    });
  });
});
