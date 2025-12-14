import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { MockAction } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";
import { Sequence } from "./sequence.js";

describe("Sequence", () => {
  let context: EffectTickContext;
  let sequence: Sequence;

  beforeEach(() => {
    context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };
    sequence = new Sequence({ id: "test-sequence" });
  });

  it.effect("should return SUCCESS when empty", () =>
    Effect.gen(function* (_) {
      const status = yield* _(sequence.tick(context));
      expect(status).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should execute all children in order when all succeed", () =>
    Effect.gen(function* (_) {
      const executionOrder: string[] = [];

      const child1 = new MockAction({
        id: "child1",
        returnStatus: NodeStatus.SUCCESS,
      });
      const child2 = new MockAction({
        id: "child2",
        returnStatus: NodeStatus.SUCCESS,
      });
      const child3 = new MockAction({
        id: "child3",
        returnStatus: NodeStatus.SUCCESS,
      });

      // Spy on tick to track execution order
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

      sequence.addChildren([child1, child2, child3]);

      const status = yield* _(sequence.tick(context));

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(executionOrder).toEqual(["child1", "child2", "child3"]);
    }),
  );

  it.effect("should stop and return FAILURE when a child fails", () =>
    Effect.gen(function* (_) {
      const executionOrder: string[] = [];

      const child1 = new MockAction({
        id: "child1",
        returnStatus: NodeStatus.SUCCESS,
      });
      const child2 = new MockAction({
        id: "child2",
        returnStatus: NodeStatus.FAILURE,
      });
      const child3 = new MockAction({
        id: "child3",
        returnStatus: NodeStatus.SUCCESS,
      });

      // Track execution
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

      sequence.addChildren([child1, child2, child3]);

      const status = yield* _(sequence.tick(context));

      expect(status).toBe(NodeStatus.FAILURE);
      expect(executionOrder).toEqual(["child1", "child2"]); // child3 should not execute
      expect(sequence.status()).toBe(NodeStatus.FAILURE);
    }),
  );

  it.effect("should handle RUNNING status correctly", () =>
    Effect.gen(function* (_) {
      const child1 = new MockAction({
        id: "child1",
        returnStatus: NodeStatus.SUCCESS,
      });
      let child2 = new MockAction({
        id: "child2",
        returnStatus: NodeStatus.RUNNING,
        ticksBeforeComplete: 3,
      });
      const child3 = new MockAction({
        id: "child3",
        returnStatus: NodeStatus.SUCCESS,
      });

      sequence.addChildren([child1, child2, child3]);

      // First tick - child2 returns RUNNING
      let status = yield* _(sequence.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);
      expect(child1.status()).toBe(NodeStatus.SUCCESS);
      expect(child2.status()).toBe(NodeStatus.RUNNING);

      // Second tick - child2 still RUNNING
      status = yield* _(sequence.tick(context));
      expect(status).toBe(NodeStatus.RUNNING);

      // Third tick - child2 completes
      child2 = new MockAction({
        id: "child2",
        returnStatus: NodeStatus.SUCCESS,
      });
      sequence._children[1] = child2; // Replace the child

      status = yield* _(sequence.tick(context));
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

      sequence.addChildren([child1, child2]);

      // First execution
      yield* _(sequence.tick(context));
      expect((sequence as unknown).currentChildIndex).toBe(0);

      // Second execution should start from beginning
      yield* _(sequence.tick(context));
      expect(child1.status()).toBe(NodeStatus.SUCCESS);
      expect(child2.status()).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should halt running children when halted", () =>
    Effect.gen(function* (_) {
      const child1 = new MockAction({
        id: "child1",
        returnStatus: NodeStatus.SUCCESS,
      });
      const child2 = new MockAction({
        id: "child2",
        returnStatus: NodeStatus.RUNNING,
      });
      const child3 = new MockAction({
        id: "child3",
        returnStatus: NodeStatus.SUCCESS,
      });

      sequence.addChildren([child1, child2, child3]);

      // Start execution
      yield* _(sequence.tick(context));
      expect(sequence.status()).toBe(NodeStatus.RUNNING);

      // Halt the sequence
      sequence.halt();

      expect(sequence.status()).toBe(NodeStatus.IDLE);
      expect((sequence as unknown).currentChildIndex).toBe(0);
    }),
  );

  it("should throw error if child is undefined", () => {
    expect(() => sequence.addChild(undefined as unknown)).toThrow(
      "Cannot add undefined child to composite node",
    );
  });

  it.effect("should handle mixed sync and async children", () =>
    Effect.gen(function* (_) {
      const syncChild = {
        id: "sync",
        name: "sync",
        type: "SyncNode",
        status: () => NodeStatus.SUCCESS,
        tick: (_ctx: EffectTickContext) => Effect.succeed(NodeStatus.SUCCESS), // Sync tick
        halt: () => {},
        reset: () => {},
        parent: undefined,
      };

      const asyncChild = new MockAction({
        id: "async",
        returnStatus: NodeStatus.SUCCESS,
      });

      sequence.addChildren([syncChild as unknown, asyncChild]);

      const status = yield* _(sequence.tick(context));
      expect(status).toBe(NodeStatus.SUCCESS);
    }),
  );

  describe("Signal-based cancellation", () => {
    it.effect("should stop executing children when signal is aborted", () =>
      Effect.gen(function* (_) {
        const executionOrder: string[] = [];
        const controller = new AbortController();

        // Add signal to context
        context.signal = controller.signal;

        // Create children
        const child1 = new MockAction({
          id: "child1",
          returnStatus: NodeStatus.SUCCESS,
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

        sequence.addChildren([child1, child2, child3]);

        // Abort signal BEFORE ticking - Sequence should check signal immediately
        controller.abort();

        // Tick should fail with OperationCancelledError before any children execute
        const status = yield* _(
          sequence.tick(context).pipe(
            Effect.catchAll((error) => {
              expect(error).toBeInstanceOf(Error);
              expect((error as Error).name).toBe("OperationCancelledError");
              return Effect.succeed(NodeStatus.FAILURE);
            }),
          ),
        );

        expect(status).toBe(NodeStatus.FAILURE);
        // No children should execute because signal was already aborted
        expect(executionOrder.length).toBe(0);
      }),
    );

    it.effect("should respect abort signal in child iteration loop", () =>
      Effect.gen(function* (_) {
        const controller = new AbortController();
        const childrenExecuted: string[] = [];

        // Add signal to context
        context.signal = controller.signal;

        // Create 5 children
        const children = Array.from({ length: 5 }, (_, i) => {
          const child = new MockAction({
            id: `child${i}`,
            returnStatus: NodeStatus.SUCCESS,
          });
          child.tick = (ctx: EffectTickContext) => {
            return Effect.gen(function* (_) {
              yield* _(checkSignal(ctx.signal));
              childrenExecuted.push(`child${i}`);
              return yield* _(Effect.succeed(NodeStatus.SUCCESS));
            });
          };
          return child;
        });

        sequence.addChildren(children);

        // Abort after 2 children have executed
        let execCount = 0;
        const _originalTick = children[0].tick;
        children.forEach((child, _idx) => {
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
          sequence.tick(context).pipe(
            Effect.catchAll((error) => {
              expect(error).toBeInstanceOf(Error);
              expect((error as Error).name).toBe("OperationCancelledError");
              return Effect.succeed(NodeStatus.FAILURE);
            }),
          ),
        );

        expect(status).toBe(NodeStatus.FAILURE);
        // Should stop after detecting abort
        expect(childrenExecuted.length).toBeLessThanOrEqual(2);
      }),
    );
  });
});
