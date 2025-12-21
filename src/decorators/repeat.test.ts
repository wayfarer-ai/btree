/**
 * Tests for Repeat decorator
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { SuccessNode } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { Repeat } from "./repeat.js";

describe("Repeat", () => {
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

  it("should execute child exactly N times", async () => {
    const repeat = new Repeat({ id: "repeat1", numCycles: 3 });

    let tickCount = 0;
    class CountingNode extends SuccessNode {
      tick(context: TemporalContext) {
        tickCount++;
        return super.tick(context);
      }
    }

    repeat.setChild(new CountingNode({ id: "child" }));

    // First 2 ticks return RUNNING
    let result = await repeat.tick(context);
    expect(result).toBe(NodeStatus.RUNNING);
    expect(tickCount).toBe(1);

    result = await repeat.tick(context);
    expect(result).toBe(NodeStatus.RUNNING);
    expect(tickCount).toBe(2);

    // Third tick returns SUCCESS
    result = await repeat.tick(context);
    expect(result).toBe(NodeStatus.SUCCESS);
    expect(tickCount).toBe(3);
  });

  it("should fail on child failure", async () => {
    const repeat = new Repeat({ id: "repeat1", numCycles: 5 });

    let tickCount = 0;
    class FailOnThird extends SuccessNode {
      tick(context: TemporalContext) {
        const self = this;
        const superTick = super.tick.bind(this);
        return (async () => {
          tickCount++;
          if (tickCount === 3) {
            self._status = NodeStatus.FAILURE;
            return NodeStatus.FAILURE;
          }
          return await superTick(context);
        })();
      }
    }

    repeat.setChild(new FailOnThird({ id: "child" }));

    await repeat.tick(context); // Cycle 1
    await repeat.tick(context); // Cycle 2
    const result = await repeat.tick(context); // Cycle 3 fails

    expect(result).toBe(NodeStatus.FAILURE);
    expect(tickCount).toBe(3);
  });

  it("should reset child between cycles", async () => {
    const repeat = new Repeat({ id: "repeat1", numCycles: 3 });

    let resetCount = 0;
    class ResetTracker extends SuccessNode {
      reset(): void {
        resetCount++;
        super.reset();
      }
    }

    repeat.setChild(new ResetTracker({ id: "child" }));

    await repeat.tick(context); // Cycle 1, reset after
    await repeat.tick(context); // Cycle 2, reset after
    await repeat.tick(context); // Cycle 3, completes

    expect(resetCount).toBe(2); // Reset after cycles 1 and 2
  });

  it("should handle RUNNING state", async () => {
    const repeat = new Repeat({ id: "repeat1", numCycles: 2 });

    let tickCount = 0;
    class TwoTickNode extends SuccessNode {
      tick(context: TemporalContext) {
        const self = this;
        const superTick = super.tick.bind(this);
        return (async () => {
          tickCount++;
          if (tickCount % 2 === 1) {
            // Odd ticks return RUNNING
            self._status = NodeStatus.RUNNING;
            return NodeStatus.RUNNING;
          }
          return await superTick(context);
        })();
      }
    }

    repeat.setChild(new TwoTickNode({ id: "child" }));

    // Cycle 1: tick 1 (RUNNING), tick 2 (SUCCESS)
    let result = await repeat.tick(context);
    expect(result).toBe(NodeStatus.RUNNING);
    result = await repeat.tick(context);
    expect(result).toBe(NodeStatus.RUNNING); // Still more cycles

    // Cycle 2: tick 3 (RUNNING), tick 4 (SUCCESS)
    result = await repeat.tick(context);
    expect(result).toBe(NodeStatus.RUNNING);
    result = await repeat.tick(context);
    expect(result).toBe(NodeStatus.SUCCESS);

    expect(tickCount).toBe(4);
  });

  it("should reset cycle count on completion", async () => {
    const repeat = new Repeat({ id: "repeat1", numCycles: 2 });

    let firstRunTicks = 0;
    let secondRunTicks = 0;
    let inSecondRun = false;

    class CountingNode extends SuccessNode {
      tick(context: TemporalContext) {
        const superTick = super.tick.bind(this);
        return (async () => {
          if (inSecondRun) {
            secondRunTicks++;
          } else {
            firstRunTicks++;
          }
          return await superTick(context);
        })();
      }
    }

    repeat.setChild(new CountingNode({ id: "child" }));

    // First run
    await repeat.tick(context);
    await repeat.tick(context);
    expect(firstRunTicks).toBe(2);

    // Second run
    inSecondRun = true;
    await repeat.tick(context);
    await repeat.tick(context);
    expect(secondRunTicks).toBe(2);
  });

  it("should propagate ConfigurationError if no child", async () => {
    const repeat = new Repeat({ id: "repeat1", numCycles: 1 });

    try {
      await repeat.tick(context);
      throw new Error("Expected tick to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).message).toContain(
        "Repeat requires a child",
      );
    }
  });
});
