import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { MockAction, WaitAction } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { Timeout } from "./timeout.js";

describe("Timeout", () => {
  let context: TemporalContext;

  beforeEach(() => {
    context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
    };
  });

  it("should throw error if timeoutMs is not positive", () => {
    expect(() => new Timeout({ id: "test", timeoutMs: 0 })).toThrow(
      "test: Timeout must be positive (got 0)",
    );

    expect(() => new Timeout({ id: "test", timeoutMs: -100 })).toThrow(
      "test: Timeout must be positive (got -100)",
    );
  });

  it("should propagate ConfigurationError if no child is set", async () => {
    const timeout = new Timeout({ id: "test-timeout", timeoutMs: 1000 });
    try {
      await timeout.tick(context);
      throw new Error("Expected tick to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).message).toContain(
        "Decorator must have a child",
      );
    }
  });

  it("should pass through immediate SUCCESS", async () => {
    const timeout = new Timeout({ id: "test-timeout", timeoutMs: 1000 });
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
    });

    timeout.setChild(child);

    const status = await timeout.tick(context);
    expect(status).toBe(NodeStatus.SUCCESS);
    expect(timeout.status()).toBe(NodeStatus.SUCCESS);
  });

  it("should pass through immediate FAILURE", async () => {
    const timeout = new Timeout({ id: "test-timeout", timeoutMs: 1000 });
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.FAILURE,
    });

    timeout.setChild(child);

    const status = await timeout.tick(context);
    expect(status).toBe(NodeStatus.FAILURE);
    expect(timeout.status()).toBe(NodeStatus.FAILURE);
  });

  it("should fail if child takes too long", async () => {
    const timeout = new Timeout({ id: "test-timeout", timeoutMs: 50 });
    const child = new WaitAction({
      id: "child",
      waitMs: 200, // Will take longer than timeout
    });

    timeout.setChild(child);

    // First tick - child starts running
    let status = await timeout.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);

    // Wait for timeout to elapse
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Next tick should fail due to timeout
    status = await timeout.tick(context);
    expect(status).toBe(NodeStatus.FAILURE);
    expect(child.status()).toBe(NodeStatus.IDLE); // Child should be halted
  });

  it("should succeed if child completes before timeout", async () => {
    const timeout = new Timeout({ id: "test-timeout", timeoutMs: 100 });
    const child = new WaitAction({
      id: "child",
      waitMs: 30, // Will complete before timeout
    });

    timeout.setChild(child);

    // First tick - child starts running
    let status = await timeout.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);

    // Wait for child to complete
    await new Promise((resolve) => setTimeout(resolve, 40));

    // Next tick should succeed
    status = await timeout.tick(context);
    expect(status).toBe(NodeStatus.SUCCESS);
    expect(timeout.status()).toBe(NodeStatus.SUCCESS);
  });

  it("should halt child when timeout is reached", async () => {
    const timeout = new Timeout({ id: "test-timeout", timeoutMs: 50 });
    const child = new WaitAction({
      id: "child",
      waitMs: 200,
    });

    const haltSpy = vi.spyOn(child, "halt");

    timeout.setChild(child);

    // Start execution
    await timeout.tick(context);

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Next tick should halt the child
    await timeout.tick(context);

    expect(haltSpy).toHaveBeenCalled();
  });

  it("should cleanup timeout on completion", async () => {
    const timeout = new Timeout({ id: "test-timeout", timeoutMs: 1000 });
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
    });

    timeout.setChild(child);

    await timeout.tick(context);

    // Check internal state is cleaned up
    expect((timeout as unknown).startTime).toBeNull();
  });

  it("should handle halt correctly", async () => {
    const timeout = new Timeout({ id: "test-timeout", timeoutMs: 1000 });
    const child = new WaitAction({
      id: "child",
      waitMs: 100,
    });

    timeout.setChild(child);

    // Start execution but don't await
    const tickPromise = timeout.tick(context);

    // Give it a moment to start
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Halt while running
    timeout.halt();

    // Status should be IDLE immediately after halt
    expect(timeout.status()).toBe(NodeStatus.IDLE);
    expect((timeout as unknown).startTime).toBeNull();

    // Wait for tick to complete or fail (may complete with error)
    try {
      await tickPromise;
    } catch (_e) {
      // Expected if halt interrupts execution
    }
  });

  it("should handle reset correctly", async () => {
    const timeout = new Timeout({ id: "test-timeout", timeoutMs: 1000 });
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
    });

    timeout.setChild(child);

    // Execute
    await timeout.tick(context);

    // Reset
    timeout.reset();

    expect(timeout.status()).toBe(NodeStatus.IDLE);
    expect((timeout as unknown).startTime).toBeNull();
  });

  it("should handle multiple ticks while waiting", async () => {
    const timeout = new Timeout({ id: "test-timeout", timeoutMs: 100 });
    const child = new WaitAction({
      id: "child",
      waitMs: 50,
    });

    timeout.setChild(child);

    // Multiple ticks while child is running
    let status = await timeout.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);

    status = await timeout.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);

    // Wait for child to complete
    await new Promise((resolve) => setTimeout(resolve, 60));

    status = await timeout.tick(context);
    expect(status).toBe(NodeStatus.SUCCESS);
  });

  it("should fail immediately if already timed out", async () => {
    const timeout = new Timeout({ id: "test-timeout", timeoutMs: 50 });
    const child = new WaitAction({
      id: "child",
      waitMs: 200,
    });

    timeout.setChild(child);

    // Start and wait for timeout
    await timeout.tick(context);
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Second tick after timeout elapsed - should fail immediately
    const status = await timeout.tick(context);
    expect(status).toBe(NodeStatus.FAILURE);
  });

  it("should handle timeout during child execution", async () => {
    const timeout = new Timeout({ id: "test-timeout", timeoutMs: 20 });

    // Child that will definitely take longer than timeout
    const child = new WaitAction({
      id: "child",
      waitMs: 100, // Much longer than timeout
    });

    timeout.setChild(child);

    // First tick: should start timeout and return RUNNING
    const startTime = Date.now();
    let status = await timeout.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);
    expect(timeout.status()).toBe(NodeStatus.RUNNING);

    // Wait for timeout to occur
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Second tick: should detect timeout and return FAILURE
    status = await timeout.tick(context);
    const elapsed = Date.now() - startTime;

    // Should timeout after ~20ms, not wait for full 100ms
    expect(elapsed).toBeLessThan(50); // Give some buffer for test environment
    expect(status).toBe(NodeStatus.FAILURE);
    expect(timeout.status()).toBe(NodeStatus.FAILURE);

    // Child should have been halted
    expect(child.status()).toBe(NodeStatus.IDLE);
  });
});
