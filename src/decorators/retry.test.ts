import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { MockAction } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { Retry, RetryUntilSuccessful } from "./retry.js";

describe("RetryUntilSuccessful", () => {
  let context: TemporalContext;
  let retry: RetryUntilSuccessful;

  beforeEach(() => {
    context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
    };
    retry = new RetryUntilSuccessful({ id: "test-retry" });
  });

  it("should propagate ConfigurationError if no child is set", async () => {
    try {
      await retry.tick(context);
      throw new Error("Expected tick to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).message).toContain(
        "Decorator must have a child",
      );
    }
  });

  it("should return SUCCESS immediately if child succeeds", async () => {
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
    });

    retry.setChild(child);

    const status = await retry.tick(context);
    expect(status).toBe(NodeStatus.SUCCESS);
    expect(retry.status()).toBe(NodeStatus.SUCCESS);
  });

  it("should retry on failure up to max attempts", async () => {
    retry = new RetryUntilSuccessful({
      id: "test-retry",
      maxAttempts: 3,
    });

    let attempts = 0;
    const child = new MockAction({ id: "child" });
    child.tick = async (_ctx) => {
      attempts++;
      if (attempts < 3) {
        (child as unknown)._status = NodeStatus.FAILURE;
        return NodeStatus.FAILURE;
      }
      (child as unknown)._status = NodeStatus.SUCCESS;
      return NodeStatus.SUCCESS;
    };

    retry.setChild(child);

    // First tick - child fails
    let status = await retry.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);
    expect(attempts).toBe(1);

    // Second tick - child fails again
    status = await retry.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);
    expect(attempts).toBe(2);

    // Third tick - child succeeds
    status = await retry.tick(context);
    expect(status).toBe(NodeStatus.SUCCESS);
    expect(attempts).toBe(3);
  });

  it("should fail after max attempts", async () => {
    retry = new RetryUntilSuccessful({
      id: "test-retry",
      maxAttempts: 2,
    });

    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.FAILURE,
    });

    retry.setChild(child);

    // First tick - child fails
    let status = await retry.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);

    // Second tick - child fails, max attempts reached
    status = await retry.tick(context);
    expect(status).toBe(NodeStatus.FAILURE);
    expect(retry.status()).toBe(NodeStatus.FAILURE);
  });

  it("should pass through RUNNING status", async () => {
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.RUNNING,
    });

    retry.setChild(child);

    const status = await retry.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);
    expect(retry.status()).toBe(NodeStatus.RUNNING);
  });

  it("should reset child between retry attempts", async () => {
    retry = new RetryUntilSuccessful({
      id: "test-retry",
      maxAttempts: 3,
    });

    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.FAILURE,
    });

    const resetSpy = vi.spyOn(child, "reset");

    retry.setChild(child);

    // First failure
    await retry.tick(context);

    // Second tick triggers reset
    await retry.tick(context);

    expect(resetSpy).toHaveBeenCalled();
  });

  describe("Retry delay", () => {
    it("should wait between retries when delay is configured", async () => {
      retry = new RetryUntilSuccessful({
        id: "test-retry",
        maxAttempts: 2,
        retryDelay: 50, // 50ms delay
      });

      const child = new MockAction({
        id: "child",
        returnStatus: NodeStatus.FAILURE,
      });

      retry.setChild(child);

      // First tick - child fails
      const startTime = Date.now();
      let status = await retry.tick(context);
      expect(status).toBe(NodeStatus.RUNNING);

      // Second tick - should be waiting
      status = await retry.tick(context);
      expect(status).toBe(NodeStatus.RUNNING);
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(50);

      // Wait for delay to complete
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Third tick - second attempt should fail, reaching max attempts
      status = await retry.tick(context);
      expect(status).toBe(NodeStatus.FAILURE); // Max attempts reached
    });

    it("should not delay when retryDelay is 0", async () => {
      retry = new RetryUntilSuccessful({
        id: "test-retry",
        maxAttempts: 2,
        retryDelay: 0,
      });

      let tickCount = 0;
      const child = new MockAction({ id: "child" });
      child.tick = async (_ctx) => {
        tickCount++;
        (child as unknown)._status = NodeStatus.FAILURE;
        return NodeStatus.FAILURE;
      };

      retry.setChild(child);

      // First tick - child fails, immediate retry
      const status = await retry.tick(context);
      expect(status).toBe(NodeStatus.RUNNING);
      expect(tickCount).toBe(1);

      // Second tick should trigger another attempt immediately
      await retry.tick(context);
      expect(tickCount).toBe(2);
    });
  });

  it("should reset attempt count on success", async () => {
    retry = new RetryUntilSuccessful({
      id: "test-retry",
      maxAttempts: 3,
    });

    let callCount = 0;
    const child = new MockAction({ id: "child" });
    child.tick = async (_ctx) => {
      callCount++;
      if (callCount === 2) {
        (child as unknown)._status = NodeStatus.SUCCESS;
        return NodeStatus.SUCCESS;
      }
      (child as unknown)._status = NodeStatus.FAILURE;
      return NodeStatus.FAILURE;
    };

    retry.setChild(child);

    // First execution - fails once, then succeeds
    await retry.tick(context);
    await retry.tick(context);
    expect(retry.status()).toBe(NodeStatus.SUCCESS);

    // Reset for second execution
    retry.reset();
    child.reset();
    callCount = 0;

    // Should start counting from 0 again
    await retry.tick(context);
    expect(callCount).toBe(1);
  });

  it("should handle halt correctly", async () => {
    retry = new RetryUntilSuccessful({
      id: "test-retry",
      maxAttempts: 3,
      retryDelay: 100,
    });

    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.FAILURE,
    });

    retry.setChild(child);

    // Start retry with delay
    await retry.tick(context);
    expect(retry.status()).toBe(NodeStatus.RUNNING);

    // Halt while waiting
    retry.halt();

    expect(retry.status()).toBe(NodeStatus.IDLE);
    expect((retry as unknown).currentAttempt).toBe(0);
    expect((retry as unknown).isWaiting).toBe(false);
  });
});

describe("Retry", () => {
  it("should be an alias for RetryUntilSuccessful", () => {
    const retry = new Retry({ id: "test-retry" });
    expect(retry).toBeInstanceOf(RetryUntilSuccessful);
    expect(retry.type).toBe("Retry");
  });
});
