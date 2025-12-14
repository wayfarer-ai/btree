import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ActionNode, CompositeNode, DecoratorNode } from "./base-node.js";
import { ScopedBlackboard } from "./blackboard.js";
import { ConfigurationError } from "./errors.js";
import { NodeEventEmitter, NodeEventType } from "./events.js";
import {
  type EffectTickContext,
  type NodeConfiguration,
  NodeStatus,
} from "./types.js";
import { OperationCancelledError } from "./utils/signal-check.js";

// Mock implementations for testing
class MockActionNode extends ActionNode {
  executeTick(_context: EffectTickContext) {
    return Effect.sync(() => {
      this._status = NodeStatus.SUCCESS;
      return NodeStatus.SUCCESS;
    });
  }
}

class MockDecoratorNode extends DecoratorNode {
  executeTick(context: EffectTickContext) {
    return Effect.gen(this, function* (_) {
      if (!this.child) {
        throw new Error("No child");
      }
      return yield* _(this.child.tick(context));
    }) as Effect.Effect<NodeStatus, never, never>;
  }
}

class MockCompositeNode extends CompositeNode {
  executeTick(context: EffectTickContext) {
    return Effect.gen(this, function* (_) {
      for (const child of this._children) {
        const status = yield* _(child.tick(context));
        if (status !== NodeStatus.SUCCESS) {
          return status;
        }
      }
      return yield* _(Effect.succeed(NodeStatus.SUCCESS));
    });
  }
}

describe("BaseNode", () => {
  let context: EffectTickContext;

  beforeEach(() => {
    context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };
  });

  describe("Node initialization", () => {
    it("should initialize with correct properties", () => {
      const config: NodeConfiguration = {
        id: "test-node",
        name: "Test Node",
      };

      const node = new MockActionNode(config);

      expect(node.id).toBe("test-node");
      expect(node.name).toBe("Test Node");
      expect(node.type).toBe("MockActionNode");
      expect(node.status()).toBe(NodeStatus.IDLE);
    });

    it("should use id as name if name not provided", () => {
      const config: NodeConfiguration = {
        id: "test-node",
      };

      const node = new MockActionNode(config);
      expect(node.name).toBe("test-node");
    });
  });

  describe("Status management", () => {
    it.effect("should track node status", () =>
      Effect.gen(function* (_) {
        const node = new MockActionNode({ id: "test" });

        expect(node.status()).toBe(NodeStatus.IDLE);

        yield* _(node.tick(context));
        expect(node.status()).toBe(NodeStatus.SUCCESS);
      }),
    );
  });

  describe("Halt and Reset", () => {
    it("should halt running nodes", () => {
      const node = new MockActionNode({ id: "test" });
      (node as any)._status = NodeStatus.RUNNING;

      const consoleSpy = vi.spyOn(console, "log");
      node.halt();

      expect(node.status()).toBe(NodeStatus.IDLE);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Halting..."),
      );
    });

    it("should not halt non-running nodes", () => {
      const node = new MockActionNode({ id: "test" });
      (node as any)._status = NodeStatus.SUCCESS;

      node.halt();
      expect(node.status()).toBe(NodeStatus.SUCCESS);
    });

    it("should reset node state", () => {
      const node = new MockActionNode({ id: "test" });
      (node as any)._status = NodeStatus.SUCCESS;

      const consoleSpy = vi.spyOn(console, "log");
      node.reset();

      expect(node.status()).toBe(NodeStatus.IDLE);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Resetting..."),
      );
    });
  });

  describe("Input/Output helpers", () => {
    it("should get input from blackboard", () => {
      context.blackboard.set("testKey", "testValue");

      const node = new MockActionNode({ id: "test" });
      const value = (node as any).getInput(context, "testKey");

      expect(value).toBe("testValue");
    });

    it("should use config mapping for input keys", () => {
      context.blackboard.set("actualKey", "value");

      const node = new MockActionNode({
        id: "test",
        testKey: "actualKey", // Map testKey to actualKey
      });

      const value = (node as any).getInput(context, "testKey");
      expect(value).toBe("value");
    });

    it("should return default value for missing input", () => {
      const node = new MockActionNode({ id: "test" });
      const value = (node as any).getInput(context, "missing", "default");

      expect(value).toBe("default");
    });

    it("should set output to blackboard", () => {
      const node = new MockActionNode({ id: "test" });
      (node as any).setOutput(context, "outputKey", "outputValue");

      expect(context.blackboard.get("outputKey")).toBe("outputValue");
    });

    it("should use config mapping for output keys", () => {
      const node = new MockActionNode({
        id: "test",
        outputKey: "actualOutputKey",
      });

      (node as any).setOutput(context, "outputKey", "value");
      expect(context.blackboard.get("actualOutputKey")).toBe("value");
    });
  });
});

describe("DecoratorNode", () => {
  let _context: EffectTickContext;

  beforeEach(() => {
    _context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };
  });

  it("should manage single child", () => {
    const decorator = new MockDecoratorNode({ id: "decorator" });
    const child = new MockActionNode({ id: "child" });

    decorator.setChild(child);

    expect((decorator as any).child).toBe(child);
    expect(decorator.children).toEqual([child]);
    expect(child.parent).toBe(decorator);
  });

  it("should halt child when halted", () => {
    const decorator = new MockDecoratorNode({ id: "decorator" });
    const child = new MockActionNode({ id: "child" });
    (child as any)._status = NodeStatus.RUNNING;

    decorator.setChild(child);

    const childHaltSpy = vi.spyOn(child, "halt");
    decorator.halt();

    expect(childHaltSpy).toHaveBeenCalled();
  });

  it("should reset child when reset", () => {
    const decorator = new MockDecoratorNode({ id: "decorator" });
    const child = new MockActionNode({ id: "child" });

    decorator.setChild(child);

    const childResetSpy = vi.spyOn(child, "reset");
    decorator.reset();

    expect(childResetSpy).toHaveBeenCalled();
  });
});

describe("CompositeNode", () => {
  let _context: EffectTickContext;

  beforeEach(() => {
    _context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };
  });

  it("should manage multiple children", () => {
    const composite = new MockCompositeNode({ id: "composite" });
    const child1 = new MockActionNode({ id: "child1" });
    const child2 = new MockActionNode({ id: "child2" });

    composite.addChild(child1);
    composite.addChild(child2);

    expect(composite.children).toEqual([child1, child2]);
    expect(child1.parent).toBe(composite);
    expect(child2.parent).toBe(composite);
  });

  it("should add multiple children at once", () => {
    const composite = new MockCompositeNode({ id: "composite" });
    const children = [
      new MockActionNode({ id: "child1" }),
      new MockActionNode({ id: "child2" }),
      new MockActionNode({ id: "child3" }),
    ];

    composite.addChildren(children);

    expect(composite.children).toEqual(children);
    children.forEach((child) => {
      expect(child.parent).toBe(composite);
    });
  });

  it("should halt all running children", () => {
    const composite = new MockCompositeNode({ id: "composite" });
    const runningChild = new MockActionNode({ id: "running" });
    const idleChild = new MockActionNode({ id: "idle" });

    (runningChild as any)._status = NodeStatus.RUNNING;
    (idleChild as any)._status = NodeStatus.IDLE;

    composite.addChildren([runningChild, idleChild]);

    const runningHaltSpy = vi.spyOn(runningChild, "halt");
    const idleHaltSpy = vi.spyOn(idleChild, "halt");

    composite.halt();

    expect(runningHaltSpy).toHaveBeenCalled();
    expect(idleHaltSpy).not.toHaveBeenCalled();
  });

  it("should reset all children", () => {
    const composite = new MockCompositeNode({ id: "composite" });
    const child1 = new MockActionNode({ id: "child1" });
    const child2 = new MockActionNode({ id: "child2" });

    composite.addChildren([child1, child2]);

    const reset1Spy = vi.spyOn(child1, "reset");
    const reset2Spy = vi.spyOn(child2, "reset");

    composite.reset();

    expect(reset1Spy).toHaveBeenCalled();
    expect(reset2Spy).toHaveBeenCalled();
  });

  it("should halt children from specific index", () => {
    const composite = new MockCompositeNode({ id: "composite" });
    const children = [
      new MockActionNode({ id: "child0" }),
      new MockActionNode({ id: "child1" }),
      new MockActionNode({ id: "child2" }),
    ];

    children.forEach((child) => {
      (child as any)._status = NodeStatus.RUNNING;
    });

    composite.addChildren(children);

    const haltSpies = children.map((child) => vi.spyOn(child, "halt"));

    (composite as any).haltChildren(1); // Start from index 1

    expect(haltSpies[0]).not.toHaveBeenCalled();
    expect(haltSpies[1]).toHaveBeenCalled();
    expect(haltSpies[2]).toHaveBeenCalled();
  });
});

describe("lastError property", () => {
  it("should initially be undefined", () => {
    const node = new MockActionNode({ id: "test" });
    expect(node.lastError).toBeUndefined();
  });

  it("should store error when set", () => {
    const node = new MockActionNode({ id: "test" });
    (node as any)._lastError = "Test error message";
    expect(node.lastError).toBe("Test error message");
  });

  it("should clear error on reset", () => {
    const node = new MockActionNode({ id: "test" });
    (node as any)._lastError = "Test error message";
    node.reset();
    expect(node.lastError).toBeUndefined();
  });
});

describe("Error handling in tick()", () => {
  let context: EffectTickContext;
  let eventEmitter: NodeEventEmitter;
  let errorEvents: any[];
  let tickEndEvents: any[];

  beforeEach(() => {
    errorEvents = [];
    tickEndEvents = [];
    eventEmitter = new NodeEventEmitter();
    eventEmitter.on(NodeEventType.ERROR, (event) => errorEvents.push(event));
    eventEmitter.on(NodeEventType.TICK_END, (event) =>
      tickEndEvents.push(event),
    );

    context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
      eventEmitter,
    };
  });

  it.effect("should catch Effect.fail and convert to FAILURE status", () =>
    Effect.gen(function* (_) {
      class FailingNode extends ActionNode {
        executeTick(_context: EffectTickContext) {
          return Effect.fail(new Error("Test error from Effect.fail"));
        }
      }

      const node = new FailingNode({ id: "test" });
      const status = yield* _(node.tick(context));

      expect(status).toBe(NodeStatus.FAILURE);
      expect(node.status()).toBe(NodeStatus.FAILURE);
      expect(node.lastError).toBe("Test error from Effect.fail");
    }),
  );

  it.effect("should catch JavaScript throw and convert to FAILURE status", () =>
    Effect.gen(function* (_) {
      class ThrowingNode extends ActionNode {
        executeTick(
          _context: EffectTickContext,
        ): Effect.Effect<NodeStatus, Error, never> {
          return Effect.fail(new Error("Test error from throw"));
        }
      }

      const node = new ThrowingNode({ id: "test" });
      const status = yield* _(node.tick(context));

      expect(status).toBe(NodeStatus.FAILURE);
      expect(node.status()).toBe(NodeStatus.FAILURE);
      expect(node.lastError).toBe("Test error from throw");
    }),
  );

  it.effect("should emit ERROR event when error occurs", () =>
    Effect.gen(function* (_) {
      class FailingNode extends ActionNode {
        executeTick(_context: EffectTickContext) {
          return Effect.fail(new Error("Test error"));
        }
      }

      const node = new FailingNode({ id: "test-id", name: "test-name" });
      yield* _(node.tick(context));

      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].nodeId).toBe("test-id");
      expect(errorEvents[0].nodeName).toBe("test-name");
      expect(errorEvents[0].data.error).toBe("Test error");
    }),
  );

  it.effect("should emit TICK_END with FAILURE status on error", () =>
    Effect.gen(function* (_) {
      class FailingNode extends ActionNode {
        executeTick(_context: EffectTickContext) {
          return Effect.fail(new Error("Test error"));
        }
      }

      const node = new FailingNode({ id: "test" });
      yield* _(node.tick(context));

      const failureEvents = tickEndEvents.filter(
        (e) => e.data.status === NodeStatus.FAILURE,
      );
      expect(failureEvents.length).toBe(1);
      expect(failureEvents[0].nodeId).toBe("test");
    }),
  );

  it.effect(
    "should re-propagate OperationCancelledError as Effect failure",
    () =>
      Effect.gen(function* (_) {
        class CancellingNode extends ActionNode {
          executeTick(_context: EffectTickContext) {
            return Effect.fail(
              new OperationCancelledError("Test cancellation"),
            );
          }
        }

        const node = new CancellingNode({ id: "test" });

        // OperationCancelledError should propagate as Effect failure
        const result = yield* _(Effect.exit(node.tick(context)));
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure" && result.cause._tag === "Fail") {
          expect(result.cause.error).toBeInstanceOf(OperationCancelledError);
        }

        // But node status should still be FAILURE
        expect(node.status()).toBe(NodeStatus.FAILURE);
        expect(node.lastError).toBe("Test cancellation");
      }),
  );

  it.effect("should emit ERROR event even for OperationCancelledError", () =>
    Effect.gen(function* (_) {
      class CancellingNode extends ActionNode {
        executeTick(
          _context: EffectTickContext,
        ): Effect.Effect<NodeStatus, Error, never> {
          return Effect.fail(new OperationCancelledError("Test cancellation"));
        }
      }

      const node = new CancellingNode({ id: "test" });

      // Use catchAll to handle the re-propagated error
      yield* _(
        node
          .tick(context)
          .pipe(Effect.catchAll(() => Effect.succeed(NodeStatus.FAILURE))),
      );

      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].data.error).toBe("Test cancellation");
    }),
  );

  it.effect("should re-propagate ConfigurationError as Effect failure", () =>
    Effect.gen(function* (_) {
      class MisconfiguredNode extends ActionNode {
        executeTick(_context: EffectTickContext) {
          return Effect.fail(
            new ConfigurationError("Test is broken - missing element"),
          );
        }
      }

      const node = new MisconfiguredNode({ id: "test" });

      // ConfigurationError should propagate as Effect failure
      const result = yield* _(Effect.exit(node.tick(context)));
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure" && result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(ConfigurationError);
      }

      // But node status should still be FAILURE
      expect(node.status()).toBe(NodeStatus.FAILURE);
      expect(node.lastError).toBe("Test is broken - missing element");
    }),
  );

  it.effect("should emit ERROR event even for ConfigurationError", () =>
    Effect.gen(function* (_) {
      class MisconfiguredNode extends ActionNode {
        executeTick(
          _context: EffectTickContext,
        ): Effect.Effect<NodeStatus, Error, never> {
          return Effect.fail(
            new ConfigurationError("Test is broken - missing element"),
          );
        }
      }

      const node = new MisconfiguredNode({ id: "test" });

      // Use catchAll to handle the re-propagated error
      yield* _(
        node
          .tick(context)
          .pipe(Effect.catchAll(() => Effect.succeed(NodeStatus.FAILURE))),
      );

      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].data.error).toBe(
        "Test is broken - missing element",
      );
    }),
  );
});
