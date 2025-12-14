import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ActionNode } from "../base-node.js";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { MockAction } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";
import { Fallback, Selector } from "./selector.js";

describe("Selector", () => {
  let context: EffectTickContext;
  let selector: Selector;

  beforeEach(() => {
    context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };
    selector = new Selector({ id: "test-selector" });
  });

  it.effect("should return FAILURE when empty", () =>
    Effect.gen(function* (_) {
      const status = yield* _(selector.tick(context));
      expect(status).toBe(NodeStatus.FAILURE);
    }),
  );

  it.effect("should return SUCCESS on first successful child", () =>
    Effect.gen(function* (_) {
      const executionOrder: string[] = [];

      const child1 = new MockAction({
        id: "child1",
        returnStatus: NodeStatus.FAILURE,
      });
      const child2 = new MockAction({
        id: "child2",
        returnStatus: NodeStatus.SUCCESS,
      });
      const child3 = new MockAction({
        id: "child3",
        returnStatus: NodeStatus.SUCCESS,
      });

      // Track execution order
      const originalTick1 = child1.tick.bind(child1);
      const originalTick2 = child2.tick.bind(child2);
      const originalTick3 = child3.tick.bind(child3);

      child1.tick = (ctx) => {
        executionOrder.push("child1");
        return originalTick1(ctx);
      };
      child2.tick = (ctx) => {
        executionOrder.push("child2");
        return originalTick2(ctx);
      };
      child3.tick = (ctx) => {
        executionOrder.push("child3");
        return originalTick3(ctx);
      };

      selector.addChildren([child1, child2, child3]);

      const status = yield* _(selector.tick(context));

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(executionOrder).toEqual(["child1", "child2"]); // child3 should not execute
      expect(selector.status()).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should return FAILURE when all children fail", () =>
    Effect.gen(function* (_) {
      const child1 = new MockAction({
        id: "child1",
        returnStatus: NodeStatus.FAILURE,
      });
      const child2 = new MockAction({
        id: "child2",
        returnStatus: NodeStatus.FAILURE,
      });
      const child3 = new MockAction({
        id: "child3",
        returnStatus: NodeStatus.FAILURE,
      });

      selector.addChildren([child1, child2, child3]);

      const status = yield* _(selector.tick(context));

      expect(status).toBe(NodeStatus.FAILURE);
      expect(selector.status()).toBe(NodeStatus.FAILURE);
    }),
  );

  it.effect("should handle RUNNING status correctly", () =>
    Effect.gen(function* (_) {
      const child1 = new MockAction({
        id: "child1",
        returnStatus: NodeStatus.FAILURE,
      });
      let child2 = new MockAction({
        id: "child2",
        returnStatus: NodeStatus.RUNNING,
        ticksBeforeComplete: 2,
      });
      const child3 = new MockAction({
        id: "child3",
        returnStatus: NodeStatus.SUCCESS,
      });

      selector.addChildren([child1, child2, child3]);

      // First tick - child2 returns RUNNING
      let status = yield* _(selector.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);
      expect(child1.status()).toBe(NodeStatus.FAILURE);
      expect(child2.status()).toBe(NodeStatus.RUNNING);

      // Second tick - child2 still RUNNING
      status = yield* _(selector.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);

      // Replace child2 to simulate completion
      child2 = new MockAction({
        id: "child2",
        returnStatus: NodeStatus.SUCCESS,
      });
      selector._children[1] = child2;

      status = yield* _(selector.tick(context));
      expect(status).toBe(NodeStatus.SUCCESS);
      expect(child3.status()).toBe(NodeStatus.IDLE); // Should not have been executed
    }),
  );

  it.effect("should continue after RUNNING child fails", () =>
    Effect.gen(function* (_) {
      let tickCount = 0;
      const child1 = new MockAction({
        id: "child1",
        returnStatus: NodeStatus.FAILURE,
      });

      // Custom child that returns RUNNING first, then FAILURE
      const child2 = new MockAction({ id: "child2" });
      child2.tick = (_ctx) =>
        Effect.gen(function* (_) {
          tickCount++;
          if (tickCount === 1) {
            (child2 as unknown)._status = NodeStatus.RUNNING;
            return yield* _(Effect.succeed(NodeStatus.RUNNING));
          }
          (child2 as unknown)._status = NodeStatus.FAILURE;
          return yield* _(Effect.succeed(NodeStatus.FAILURE));
        });

      const child3 = new MockAction({
        id: "child3",
        returnStatus: NodeStatus.SUCCESS,
      });

      selector.addChildren([child1, child2, child3]);

      // First tick - child2 returns RUNNING
      let status = yield* _(selector.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);

      // Second tick - child2 fails, moves to child3
      status = yield* _(selector.tick(context));
      expect(status).toBe(NodeStatus.SUCCESS);
      expect(child3.status()).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should reset child index on completion", () =>
    Effect.gen(function* (_) {
      const child1 = new MockAction({
        id: "child1",
        returnStatus: NodeStatus.SUCCESS,
      });
      const child2 = new MockAction({
        id: "child2",
        returnStatus: NodeStatus.SUCCESS,
      });

      selector.addChildren([child1, child2]);

      // First execution
      yield* _(selector.tick(context));
      expect((selector as unknown).currentChildIndex).toBe(0);

      // Reset children status for second execution
      child1.reset();

      // Second execution should start from beginning
      yield* _(selector.tick(context));
      expect(child1.status()).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should halt running children when halted", () =>
    Effect.gen(function* (_) {
      const child1 = new MockAction({
        id: "child1",
        returnStatus: NodeStatus.FAILURE,
      });
      const child2 = new MockAction({
        id: "child2",
        returnStatus: NodeStatus.RUNNING,
      });

      selector.addChildren([child1, child2]);

      // Start execution
      yield* _(selector.tick(context));
      expect(selector.status()).toBe(NodeStatus.RUNNING);

      // Halt the selector
      selector.halt();

      expect(selector.status()).toBe(NodeStatus.IDLE);
      expect((selector as unknown).currentChildIndex).toBe(0);
    }),
  );

  it("should throw error if child is undefined", () => {
    expect(() => selector.addChild(undefined as unknown)).toThrow(
      "Cannot add undefined child to composite node",
    );
  });

  describe("Signal-based cancellation", () => {
    it.effect("should stop executing children when signal is aborted", () =>
      Effect.gen(function* (_) {
        const executionOrder: string[] = [];
        const controller = new AbortController();

        context.signal = controller.signal;

        const child1 = new MockAction({
          id: "child1",
          returnStatus: NodeStatus.FAILURE,
        });
        const child2 = new MockAction({
          id: "child2",
          returnStatus: NodeStatus.SUCCESS,
        });
        const child3 = new MockAction({
          id: "child3",
          returnStatus: NodeStatus.SUCCESS,
        });

        const originalTick1 = child1.tick.bind(child1);
        const originalTick2 = child2.tick.bind(child2);
        const originalTick3 = child3.tick.bind(child3);

        child1.tick = (ctx: EffectTickContext) => {
          executionOrder.push("child1");
          return originalTick1(ctx);
        };
        child2.tick = (ctx: EffectTickContext) => {
          executionOrder.push("child2");
          return originalTick2(ctx);
        };
        child3.tick = (ctx: EffectTickContext) => {
          executionOrder.push("child3");
          return originalTick3(ctx);
        };

        selector.addChildren([child1, child2, child3]);

        // Abort signal before ticking
        controller.abort();

        const status = yield* _(
          selector.tick(context).pipe(
            Effect.catchAll((error) => {
              expect(error).toBeInstanceOf(Error);
              expect((error as Error).name).toBe("OperationCancelledError");
              return Effect.succeed(NodeStatus.FAILURE);
            }),
          ),
        );

        expect(status).toBe(NodeStatus.FAILURE);
        expect(executionOrder.length).toBe(0);
      }),
    );

    it.effect("should respect abort signal in child iteration loop", () =>
      Effect.gen(function* (_) {
        const controller = new AbortController();
        const childrenExecuted: string[] = [];

        context.signal = controller.signal;

        const children = Array.from({ length: 5 }, (_, i) => {
          const child = new MockAction({
            id: `child${i}`,
            returnStatus: NodeStatus.FAILURE,
          });
          child.tick = (ctx: EffectTickContext) => {
            return Effect.gen(function* (_) {
              yield* _(checkSignal(ctx.signal));
              childrenExecuted.push(`child${i}`);
              return yield* _(Effect.succeed(NodeStatus.FAILURE));
            });
          };
          return child;
        });

        selector.addChildren(children);

        // Abort after 2 children
        let execCount = 0;
        children.forEach((child) => {
          const orig = child.tick;
          child.tick = (ctx: EffectTickContext) => {
            return Effect.gen(function* (_) {
              execCount++;
              if (execCount === 2) {
                controller.abort();
              }
              return yield* _(orig(ctx));
            });
          };
        });

        const status = yield* _(
          selector.tick(context).pipe(
            Effect.catchAll((error) => {
              expect(error).toBeInstanceOf(Error);
              expect((error as Error).name).toBe("OperationCancelledError");
              return Effect.succeed(NodeStatus.FAILURE);
            }),
          ),
        );

        expect(status).toBe(NodeStatus.FAILURE);
        expect(childrenExecuted.length).toBeLessThanOrEqual(2);
      }),
    );
  });

  describe("ConfigurationError handling", () => {
    it.effect(
      "should NOT catch ConfigurationError from child - it propagates up",
      () =>
        Effect.gen(function* (_) {
          class MisconfiguredNode extends ActionNode {
            executeTick(_context: EffectTickContext) {
              return Effect.fail(
                new ConfigurationError("Element not found in blackboard"),
              );
            }
          }

          const misconfiguredChild = new MisconfiguredNode({ id: "broken" });
          const validChild = new MockAction({
            id: "valid",
            returnStatus: NodeStatus.SUCCESS,
          });

          selector.addChildren([misconfiguredChild, validChild]);

          // ConfigurationError should propagate as Effect failure
          // Selector should NOT try the next child
          const result = yield* _(Effect.exit(selector.tick(context)));
          expect(result._tag).toBe("Failure");
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(result.cause.error).toBeInstanceOf(ConfigurationError);
            expect(result.cause.error.message).toContain(
              "Element not found in blackboard",
            );
          }

          // Verify second child was NOT executed
          expect(validChild.status()).toBe(NodeStatus.IDLE);
        }),
    );
  });
});

describe("Fallback", () => {
  it("should be an alias for Selector", () => {
    const fallback = new Fallback({ id: "test-fallback" });
    expect(fallback).toBeInstanceOf(Selector);
    expect(fallback.type).toBe("Fallback");
  });

  it.effect("should behave like Selector", () =>
    Effect.gen(function* (_) {
      const context: EffectTickContext = {
        blackboard: new ScopedBlackboard(),
        timestamp: Date.now(),
        deltaTime: 0,
        runningOps: new Map(),
      };

      const fallback = new Fallback({ id: "test-fallback" });

      const child1 = new MockAction({
        id: "child1",
        returnStatus: NodeStatus.FAILURE,
      });
      const child2 = new MockAction({
        id: "child2",
        returnStatus: NodeStatus.SUCCESS,
      });

      fallback.addChildren([child1, child2]);

      const status = yield* _(fallback.tick(context));
      expect(status).toBe(NodeStatus.SUCCESS);
    }),
  );
});
