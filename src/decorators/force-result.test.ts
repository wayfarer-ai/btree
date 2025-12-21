/**
 * Tests for ForceSuccess and ForceFailure decorators
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { FailureNode, RunningNode, SuccessNode } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { ForceFailure, ForceSuccess } from "./force-result.js";

describe("ForceSuccess", () => {
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

  it("should return SUCCESS when child succeeds", async () => {
    const force = new ForceSuccess({ id: "force1" });
    force.setChild(new SuccessNode({ id: "child" }));

    const result = await force.tick(context);
    expect(result).toBe(NodeStatus.SUCCESS);
  });

  it("should return SUCCESS when child fails", async () => {
    const force = new ForceSuccess({ id: "force1" });
    force.setChild(new FailureNode({ id: "child" }));

    const result = await force.tick(context);
    expect(result).toBe(NodeStatus.SUCCESS);
  });

  it("should return RUNNING when child is running", async () => {
    const force = new ForceSuccess({ id: "force1" });
    force.setChild(new RunningNode({ id: "child" }));

    const result = await force.tick(context);
    expect(result).toBe(NodeStatus.RUNNING);
    expect(force.status()).toBe(NodeStatus.RUNNING);
  });

  it("should still tick child for side effects", async () => {
    const force = new ForceSuccess({ id: "force1" });

    let childTicked = false;
    class SideEffectNode extends FailureNode {
      tick(context: TemporalContext) {
        childTicked = true;
        return super.tick(context);
      }
    }

    force.setChild(new SideEffectNode({ id: "child" }));

    await force.tick(context);
    expect(childTicked).toBe(true);
  });

  it("should throw ConfigurationError if no child", async () => {
    const force = new ForceSuccess({ id: "force1" });

    await expect(force.tick(context)).rejects.toThrow("ForceSuccess requires a child");
  });
});

describe("ForceFailure", () => {
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

  it("should return FAILURE when child succeeds", async () => {
    const force = new ForceFailure({ id: "force1" });
    force.setChild(new SuccessNode({ id: "child" }));

    const result = await force.tick(context);
    expect(result).toBe(NodeStatus.FAILURE);
  });

  it("should return FAILURE when child fails", async () => {
    const force = new ForceFailure({ id: "force1" });
    force.setChild(new FailureNode({ id: "child" }));

    const result = await force.tick(context);
    expect(result).toBe(NodeStatus.FAILURE);
  });

  it("should return RUNNING when child is running", async () => {
    const force = new ForceFailure({ id: "force1" });
    force.setChild(new RunningNode({ id: "child" }));

    const result = await force.tick(context);
    expect(result).toBe(NodeStatus.RUNNING);
    expect(force.status()).toBe(NodeStatus.RUNNING);
  });

  it("should still tick child for side effects", async () => {
    const force = new ForceFailure({ id: "force1" });

    let childTicked = false;
    class SideEffectNode extends SuccessNode {
      tick(context: TemporalContext) {
        childTicked = true;
        return super.tick(context);
      }
    }

    force.setChild(new SideEffectNode({ id: "child" }));

    await force.tick(context);
    expect(childTicked).toBe(true);
  });

  it("should throw ConfigurationError if no child", async () => {
    const force = new ForceFailure({ id: "force1" });

    await expect(force.tick(context)).rejects.toThrow("ForceFailure requires a child");
  });
});
