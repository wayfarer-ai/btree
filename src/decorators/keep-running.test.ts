/**
 * Tests for KeepRunningUntilFailure decorator
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { FailureNode, SuccessNode } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { KeepRunningUntilFailure } from "./keep-running.js";

describe("KeepRunningUntilFailure", () => {
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

  it("should return RUNNING while child succeeds", async () => {
    const keep = new KeepRunningUntilFailure({ id: "keep1" });
    keep.setChild(new SuccessNode({ id: "child" }));

    const result = await keep.tick(context);
    expect(result).toBe(NodeStatus.RUNNING);
  });

  it("should return SUCCESS on child failure", async () => {
    const keep = new KeepRunningUntilFailure({ id: "keep1" });
    keep.setChild(new FailureNode({ id: "child" }));

    const result = await keep.tick(context);
    expect(result).toBe(NodeStatus.SUCCESS);
  });

  it("should reset child between ticks", async () => {
    const keep = new KeepRunningUntilFailure({ id: "keep1" });

    let tickCount = 0;
    class CountingNode extends SuccessNode {
      tick(context: TemporalContext) {
        tickCount++;
        return super.tick(context);
      }
    }

    keep.setChild(new CountingNode({ id: "child" }));

    await keep.tick(context);
    await keep.tick(context);
    await keep.tick(context);

    expect(tickCount).toBe(3); // Ticked 3 times (reset between each)
  });

  it("should propagate RUNNING from child", async () => {
    const keep = new KeepRunningUntilFailure({ id: "keep1" });

    let tickCount = 0;
    class RunningThenFail extends SuccessNode {
      tick(_context: TemporalContext) {
        const self = this;
        return (async () => {
          tickCount++;
          if (tickCount < 3) {
            self._status = NodeStatus.RUNNING;
            return NodeStatus.RUNNING;
          }
          self._status = NodeStatus.FAILURE;
          return NodeStatus.FAILURE;
        })();
      }
    }

    keep.setChild(new RunningThenFail({ id: "child" }));

    let result = await keep.tick(context);
    expect(result).toBe(NodeStatus.RUNNING);

    result = await keep.tick(context);
    expect(result).toBe(NodeStatus.RUNNING);

    result = await keep.tick(context);
    expect(result).toBe(NodeStatus.SUCCESS); // Child failed
  });

  it("should propagate ConfigurationError if no child", async () => {
    const keep = new KeepRunningUntilFailure({ id: "keep1" });

    try {
      await keep.tick(context);
      throw new Error("Expected tick to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).message).toContain(
        "KeepRunningUntilFailure requires a child",
      );
    }
  });
});
