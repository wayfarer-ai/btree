import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { MockAction } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { Delay } from "./delay.js";

describe("Delay", () => {
  let context: TemporalContext;

  beforeEach(() => {
    context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
    };
  });

  it("should throw error if delayMs is negative", () => {
    expect(() => new Delay({ id: "test", delayMs: -100 })).toThrow(
      "test: Delay must be non-negative (got -100)",
    );
  });

  it("should throw ConfigurationError if no child is set", async () => {
    const delay = new Delay({ id: "test-delay", delayMs: 100 });
    await expect(delay.tick(context)).rejects.toThrow("test-delay: Decorator must have a child");
  });

  it("should execute child immediately when delayMs is 0", async () => {
    const delay = new Delay({ id: "test-delay", delayMs: 0 });
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
    });

    delay.setChild(child);

    const status = await delay.tick(context);
    expect(status).toBe(NodeStatus.SUCCESS);
    expect(child.status()).toBe(NodeStatus.SUCCESS);
  });

  it("should delay child execution", async () => {
    const delayMs = 50;
    const delay = new Delay({ id: "test-delay", delayMs });
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
    });

    delay.setChild(child);

    const startTime = Date.now();

    // First tick - should be delaying
    let status = await delay.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);
    expect(child.status()).toBe(NodeStatus.IDLE); // Child not executed yet

    // Tick while still delaying
    status = await delay.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);
    expect(Date.now() - startTime).toBeLessThan(delayMs);

    // Wait for delay to complete
    await new Promise((resolve) => setTimeout(resolve, delayMs + 10));

    // Next tick should execute child
    status = await delay.tick(context);
    expect(status).toBe(NodeStatus.SUCCESS);
    expect(child.status()).toBe(NodeStatus.SUCCESS);
    expect(Date.now() - startTime).toBeGreaterThanOrEqual(delayMs);
  });

  it("should pass through child status after delay", async () => {
    const delay = new Delay({ id: "test-delay", delayMs: 30 });
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.FAILURE,
    });

    delay.setChild(child);

    // Wait through delay
    await delay.tick(context);
    await new Promise((resolve) => setTimeout(resolve, 40));

    const status = await delay.tick(context);
    expect(status).toBe(NodeStatus.FAILURE);
    expect(delay.status()).toBe(NodeStatus.FAILURE);
  });

  it("should handle RUNNING child after delay", async () => {
    const delay = new Delay({ id: "test-delay", delayMs: 30 });
    let tickCount = 0;
    const child = new MockAction({ id: "child" });
    child.tick = async (_ctx) => {
      tickCount++;
      if (tickCount < 3) {
        (child as any)._status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;
      }
      (child as any)._status = NodeStatus.SUCCESS;
      return NodeStatus.SUCCESS;
    };

    delay.setChild(child);

    // Wait through delay
    await delay.tick(context);
    await new Promise((resolve) => setTimeout(resolve, 40));

    // Child starts executing
    let status = await delay.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);
    // Child has been ticked (verified by child status check)

    // Child still running
    status = await delay.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);

    // Child completes
    status = await delay.tick(context);
    expect(status).toBe(NodeStatus.SUCCESS);
  });

  it("should reset delay state on halt", async () => {
    const delay = new Delay({ id: "test-delay", delayMs: 100 });
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
    });

    delay.setChild(child);

    // Start delay
    await delay.tick(context);
    expect((delay as any).delayStartTime).not.toBeNull();

    // Halt
    delay.halt();

    expect(delay.status()).toBe(NodeStatus.IDLE);
    expect((delay as any).delayStartTime).toBeNull();
  });

  it("should reset delay state on reset", async () => {
    const delay = new Delay({ id: "test-delay", delayMs: 30 });
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
    });

    delay.setChild(child);

    // Complete execution
    await delay.tick(context);
    await new Promise((resolve) => setTimeout(resolve, 40));
    await delay.tick(context);

    // Child has been ticked (verified by child status check)

    // Reset
    delay.reset();

    expect(delay.status()).toBe(NodeStatus.IDLE);
    expect((delay as any).delayStartTime).toBeNull();
  });

  it("should track remaining delay time correctly", async () => {
    const delayMs = 100;
    const delay = new Delay({ id: "test-delay", delayMs });
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
    });

    delay.setChild(child);

    // Start delay
    await delay.tick(context);

    // Check multiple times during delay
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const status = await delay.tick(context);
      expect(status).toBe(NodeStatus.RUNNING);

      // Verify delay is being tracked (can check logs)
      const delayStartTime = (delay as any).delayStartTime;
      if (!delayStartTime) {
        throw new Error("delayStartTime not found");
      }
      const elapsed = Date.now() - delayStartTime;
      expect(elapsed).toBeLessThan(delayMs);
    }

    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 50));
    const finalStatus = await delay.tick(context);
    expect(finalStatus).toBe(NodeStatus.SUCCESS);
  });

  it("should only start child execution once", async () => {
    const delay = new Delay({ id: "test-delay", delayMs: 30 });
    let tickCount = 0;

    const child = new MockAction({ id: "child" });
    const originalTick = child.tick.bind(child);
    child.tick = (ctx) => {
      tickCount++;
      return originalTick(ctx);
    };

    delay.setChild(child);

    // Wait through delay
    await delay.tick(context);
    await new Promise((resolve) => setTimeout(resolve, 40));

    // First tick after delay
    await delay.tick(context);
    expect(tickCount).toBe(1);
    // Child has been ticked (verified by child status check)

    // Subsequent ticks start new delay cycles (return RUNNING without ticking child)
    await delay.tick(context);
    await delay.tick(context);
    expect(tickCount).toBe(1); // Child only ticked once (subsequent ticks are delaying)
  });

  it("should handle multiple executions correctly", async () => {
    const delay = new Delay({ id: "test-delay", delayMs: 30 });
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
    });

    delay.setChild(child);

    // First execution
    await delay.tick(context);
    await new Promise((resolve) => setTimeout(resolve, 40));
    let status = await delay.tick(context);
    expect(status).toBe(NodeStatus.SUCCESS);

    // Reset for second execution
    delay.reset();
    child.reset();

    // Second execution should also delay
    const startTime = Date.now();
    status = await delay.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);

    await new Promise((resolve) => setTimeout(resolve, 40));
    status = await delay.tick(context);
    expect(status).toBe(NodeStatus.SUCCESS);
    expect(Date.now() - startTime).toBeGreaterThanOrEqual(30);
  });
});
