/**
 * Tests for RunOnce decorator
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { FailureNode, SuccessNode } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { RunOnce } from "./run-once.js";

describe("RunOnce", () => {
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

  it("should execute child once", async () => {
    const runOnce = new RunOnce({ id: "once1" });

    let tickCount = 0;
    class CountingNode extends SuccessNode {
      async tick(context: TemporalContext) {
        tickCount++;
        return await super.tick(context);
      }
    }

    runOnce.setChild(new CountingNode({ id: "child" }));

    await runOnce.tick(context);
    await runOnce.tick(context);
    await runOnce.tick(context);

    expect(tickCount).toBe(1); // Only executed once
  });

  it("should cache SUCCESS result", async () => {
    const runOnce = new RunOnce({ id: "once1" });
    runOnce.setChild(new SuccessNode({ id: "child" }));

    const result1 = await runOnce.tick(context);
    const result2 = await runOnce.tick(context);
    const result3 = await runOnce.tick(context);

    expect(result1).toBe(NodeStatus.SUCCESS);
    expect(result2).toBe(NodeStatus.SUCCESS);
    expect(result3).toBe(NodeStatus.SUCCESS);
  });

  it("should cache FAILURE result", async () => {
    const runOnce = new RunOnce({ id: "once1" });
    runOnce.setChild(new FailureNode({ id: "child" }));

    const result1 = await runOnce.tick(context);
    const result2 = await runOnce.tick(context);

    expect(result1).toBe(NodeStatus.FAILURE);
    expect(result2).toBe(NodeStatus.FAILURE);
  });

  it("should not cache RUNNING result", async () => {
    const runOnce = new RunOnce({ id: "once1" });

    let tickCount = 0;
    class RunningThenSuccess extends SuccessNode {
      async tick(context: TemporalContext) {
        tickCount++;
        if (tickCount < 3) {
          this._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;
        }
        return await super.tick(context);
      }
    }

    runOnce.setChild(new RunningThenSuccess({ id: "child" }));

    const result1 = await runOnce.tick(context); // RUNNING
    const result2 = await runOnce.tick(context); // RUNNING
    const result3 = await runOnce.tick(context); // SUCCESS (cached)
    const result4 = await runOnce.tick(context); // SUCCESS (from cache)

    expect(result1).toBe(NodeStatus.RUNNING);
    expect(result2).toBe(NodeStatus.RUNNING);
    expect(result3).toBe(NodeStatus.SUCCESS);
    expect(result4).toBe(NodeStatus.SUCCESS);
    expect(tickCount).toBe(3); // Ticked 3 times (not cached while RUNNING)
  });

  it("should reset cache on reset", async () => {
    const runOnce = new RunOnce({ id: "once1" });

    let tickCount = 0;
    class CountingNode extends SuccessNode {
      async tick(context: TemporalContext) {
        tickCount++;
        return await super.tick(context);
      }
    }

    runOnce.setChild(new CountingNode({ id: "child" }));

    // First execution
    await runOnce.tick(context);
    expect(tickCount).toBe(1);

    // Second tick - should use cache
    await runOnce.tick(context);
    expect(tickCount).toBe(1);

    // Reset
    runOnce.reset();

    // Third tick - should execute again
    await runOnce.tick(context);
    expect(tickCount).toBe(2);
  });

  it("should propagate ConfigurationError if no child", async () => {
    const runOnce = new RunOnce({ id: "once1" });

    try {
      await runOnce.tick(context);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).message).toContain(
        "RunOnce requires a child",
      );
    }
  });
});
