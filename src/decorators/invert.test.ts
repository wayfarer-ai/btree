import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { MockAction } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { Invert } from "./invert.js";

describe("Invert", () => {
  let context: TemporalContext;
  let invert: Invert;

  beforeEach(() => {
    context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
    };
    invert = new Invert({ id: "test-invert" });
  });

  it("should propagate ConfigurationError if no child is set", async () => {
    try {
      await invert.tick(context);
      throw new Error("Expected tick to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).message).toContain(
        "Decorator must have a child",
      );
    }
  });

  it("should invert SUCCESS to FAILURE", async () => {
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
    });

    invert.setChild(child);

    const status = await invert.tick(context);
    expect(status).toBe(NodeStatus.FAILURE);
    expect(invert.status()).toBe(NodeStatus.FAILURE);
  });

  it("should invert FAILURE to SUCCESS", async () => {
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.FAILURE,
    });

    invert.setChild(child);

    const status = await invert.tick(context);
    expect(status).toBe(NodeStatus.SUCCESS);
    expect(invert.status()).toBe(NodeStatus.SUCCESS);
  });

  it("should pass through RUNNING status", async () => {
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.RUNNING,
    });

    invert.setChild(child);

    const status = await invert.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);
    expect(invert.status()).toBe(NodeStatus.RUNNING);
  });

  it("should pass through other statuses unchanged", async () => {
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.IDLE,
    });

    invert.setChild(child);

    const status = await invert.tick(context);
    expect(status).toBe(NodeStatus.IDLE);
  });

  it("should properly propagate halt to child", () => {
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.RUNNING,
    });

    invert.setChild(child);

    // Set child to RUNNING state
    (child as unknown)._status = NodeStatus.RUNNING;

    // Halt the invert decorator
    invert.halt();

    expect(child.status()).toBe(NodeStatus.IDLE);
  });

  it("should properly propagate reset to child", () => {
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
    });

    invert.setChild(child);

    // Set child to SUCCESS state
    (child as unknown)._status = NodeStatus.SUCCESS;

    // Reset the invert decorator
    invert.reset();

    expect(child.status()).toBe(NodeStatus.IDLE);
  });

  it("should work with async children", async () => {
    const child = new MockAction({
      id: "child",
      returnStatus: NodeStatus.SUCCESS,
      ticksBeforeComplete: 2, // Will return RUNNING first
    });

    invert.setChild(child);

    // First tick - child returns RUNNING
    let status = await invert.tick(context);
    expect(status).toBe(NodeStatus.RUNNING);

    // Second tick - child returns SUCCESS, inverted to FAILURE
    status = await invert.tick(context);
    expect(status).toBe(NodeStatus.FAILURE);
  });
});
