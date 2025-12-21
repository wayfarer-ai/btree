/**
 * Tests for SoftAssert decorator
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { FailureNode, RunningNode, SuccessNode } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { SoftAssert } from "./soft-assert.js";

describe("SoftAssert", () => {
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

  it("should convert FAILURE to SUCCESS", async () => {
    const soft = new SoftAssert({ id: "soft1" });
    soft.setChild(new FailureNode({ id: "child" }));

    const result = await soft.tick(context);
    expect(result).toBe(NodeStatus.SUCCESS);
  });

  it("should propagate SUCCESS", async () => {
    const soft = new SoftAssert({ id: "soft1" });
    soft.setChild(new SuccessNode({ id: "child" }));

    const result = await soft.tick(context);
    expect(result).toBe(NodeStatus.SUCCESS);
  });

  it("should propagate RUNNING", async () => {
    const soft = new SoftAssert({ id: "soft1" });
    soft.setChild(new RunningNode({ id: "child" }));

    const result = await soft.tick(context);
    expect(result).toBe(NodeStatus.RUNNING);
  });

  it("should log failures", async () => {
    const soft = new SoftAssert({ id: "soft1" });
    soft.setChild(new FailureNode({ id: "child" }));

    await soft.tick(context);

    const failures = soft.getFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0]?.message).toContain("Soft assertion failed");
  });

  it("should track multiple failures", async () => {
    const soft = new SoftAssert({ id: "soft1" });
    soft.setChild(new FailureNode({ id: "child" }));

    await soft.tick(context);
    await soft.tick(context);
    await soft.tick(context);

    const failures = soft.getFailures();
    expect(failures).toHaveLength(3);
  });

  it("should reset failure history on reset", async () => {
    const soft = new SoftAssert({ id: "soft1" });
    soft.setChild(new FailureNode({ id: "child" }));

    await soft.tick(context);
    await soft.tick(context);
    expect(soft.hasFailures()).toBe(true);

    soft.reset();
    expect(soft.hasFailures()).toBe(false);
    expect(soft.getFailures()).toHaveLength(0);
  });

  it("should provide hasFailures helper", async () => {
    const soft = new SoftAssert({ id: "soft1" });
    soft.setChild(new FailureNode({ id: "child" }));

    expect(soft.hasFailures()).toBe(false);
    await soft.tick(context);
    expect(soft.hasFailures()).toBe(true);
  });

  it("should propagate ConfigurationError if no child", async () => {
    const soft = new SoftAssert({ id: "soft1" });

    try {
      await soft.tick(context);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).message).toContain(
        "SoftAssert requires a child",
      );
    }
  });
});
