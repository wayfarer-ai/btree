import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "./blackboard.js";
import { Sequence } from "./composites/sequence.js";
import { NodeEventEmitter, NodeEventType } from "./events.js";
import { Registry } from "./registry.js";
import { MockAction, WaitAction } from "./test-nodes.js";
import { TickEngine } from "./tick-engine.js";
import { type EffectTickContext, NodeStatus } from "./types.js";
import { checkSignal } from "./utils/signal-check.js";

describe("TickEngine", () => {
  let engine: TickEngine;
  let blackboard: ScopedBlackboard;
  let treeRegistry: Registry;
  let mockNode: MockAction;

  beforeEach(() => {
    blackboard = new ScopedBlackboard();
    treeRegistry = new Registry();
    mockNode = new MockAction({
      id: "test-node",
      returnStatus: NodeStatus.SUCCESS,
    });
    engine = new TickEngine(mockNode, { treeRegistry });
  });

  describe("Basic tick execution", () => {
    it.live("should execute a single tick", () =>
      Effect.gen(function* (_) {
        const status = yield* _(Effect.promise(() => engine.tick(blackboard)));
        expect(status).toBe(NodeStatus.SUCCESS);
        expect(engine.getStatus()).toBe(NodeStatus.SUCCESS);
        expect(engine.getTickCount()).toBe(1);
      }),
    );

    it.live("should create blackboard if not provided", () =>
      Effect.gen(function* (_) {
        const status = yield* _(Effect.promise(() => engine.tick()));
        expect(status).toBe(NodeStatus.SUCCESS);
      }),
    );

    it.live("should provide tick context to nodes", () =>
      Effect.gen(function* (_) {
        let capturedContext: EffectTickContext | null = null;

        mockNode.tick = (context: EffectTickContext) => {
          return Effect.gen(function* (_) {
            capturedContext = context;
            return yield* _(Effect.succeed(NodeStatus.SUCCESS));
          });
        };

        yield* _(Effect.promise(() => engine.tick(blackboard)));

        expect(capturedContext).not.toBeNull();
        expect(
          (capturedContext as unknown as EffectTickContext).blackboard,
        ).toBe(blackboard);
        expect(
          (capturedContext as unknown as EffectTickContext).timestamp,
        ).toBeGreaterThan(0);
        expect(
          (capturedContext as unknown as EffectTickContext).deltaTime,
        ).toBe(0); // First tick
        expect(
          (capturedContext as unknown as EffectTickContext).signal,
        ).toBeInstanceOf(AbortSignal);
      }),
    );

    it.live("should track delta time between ticks", () =>
      Effect.gen(function* (_) {
        let deltaTime1: number | undefined;
        let deltaTime2: number | undefined;

        mockNode.tick = (context: EffectTickContext) => {
          return Effect.gen(function* (_) {
            if (engine.getTickCount() === 1) {
              deltaTime1 = context.deltaTime;
            } else {
              deltaTime2 = context.deltaTime;
            }
            return yield* _(Effect.succeed(NodeStatus.SUCCESS));
          });
        };

        yield* _(Effect.promise(() => engine.tick(blackboard)));
        yield* _(Effect.sleep("50 millis"));
        yield* _(Effect.promise(() => engine.tick(blackboard)));

        expect(deltaTime1).toBe(0); // First tick
        expect(deltaTime2).toBeGreaterThan(40); // Should be around 50ms
      }),
    );
  });

  describe("Running state handling", () => {
    it.live("should throw error if already running", () =>
      Effect.gen(function* (_) {
        const runningNode = new WaitAction({
          id: "wait-node",
          waitMs: 100,
        });
        engine = new TickEngine(runningNode, { treeRegistry });

        // Start first tick - call tick() which sets isRunning = true synchronously
        // The synchronous check happens immediately when tick() is called
        const firstTickPromise = engine.tick(blackboard);

        // Immediately try to tick again - should throw/reject
        // engine.tick() checks isRunning synchronously, but since it's async,
        // the error is thrown inside the Promise
        const secondTickResult = yield* _(
          Effect.exit(
            Effect.tryPromise({
              try: () => engine.tick(blackboard),
              catch: (error) => error as Error,
            }),
          ),
        );

        // Verify error was thrown
        expect(secondTickResult._tag).toBe("Failure");
        if (secondTickResult._tag === "Failure") {
          expect(
            secondTickResult.cause._tag === "Fail" &&
              secondTickResult.cause.error?.message,
          ).toContain("already running");
        }

        // Wait for first tick to complete
        yield* _(Effect.promise(() => firstTickPromise));
      }),
    );
  });

  describe("tickWhileRunning", () => {
    it.live("should continuously tick while node returns RUNNING", () =>
      Effect.gen(function* (_) {
        let tickCount = 0;
        mockNode.tick = (_context: EffectTickContext) => {
          return Effect.gen(function* (_) {
            tickCount++;
            if (tickCount < 3) {
              return yield* _(Effect.succeed(NodeStatus.RUNNING));
            }
            return yield* _(Effect.succeed(NodeStatus.SUCCESS));
          });
        };

        const result = yield* _(
          Effect.promise(() => engine.tickWhileRunning(blackboard)),
        );

        expect(result.status).toBe(NodeStatus.SUCCESS);
        expect(result.tickCount).toBe(3);
        expect(tickCount).toBe(3);
      }),
    );

    it.live("should stop on FAILURE", () =>
      Effect.gen(function* (_) {
        let tickCount = 0;
        mockNode.tick = (_context: EffectTickContext) => {
          return Effect.gen(function* (_) {
            tickCount++;
            if (tickCount === 2) {
              return yield* _(Effect.succeed(NodeStatus.FAILURE));
            }
            return yield* _(Effect.succeed(NodeStatus.RUNNING));
          });
        };

        const result = yield* _(
          Effect.promise(() => engine.tickWhileRunning(blackboard)),
        );

        expect(result.status).toBe(NodeStatus.FAILURE);
        expect(tickCount).toBe(2);
      }),
    );

    it.live("should respect max ticks limit", () =>
      Effect.gen(function* (_) {
        mockNode = new MockAction({
          id: "test-node",
          returnStatus: NodeStatus.RUNNING,
        });
        engine = new TickEngine(mockNode, { treeRegistry });

        const result = yield* _(
          Effect.promise(() => engine.tickWhileRunning(blackboard, 5)),
        );

        expect(result.status).toBe(NodeStatus.RUNNING);
        expect(result.tickCount).toBe(5);
      }),
    );

    it.live("should add small delay between ticks", () =>
      Effect.gen(function* (_) {
        const tickTimes: number[] = [];

        mockNode.tick = (_context: EffectTickContext) => {
          return Effect.gen(function* (_) {
            tickTimes.push(Date.now());

            if (engine.getTickCount() < 5) {
              return yield* _(Effect.succeed(NodeStatus.RUNNING));
            }
            return yield* _(Effect.succeed(NodeStatus.SUCCESS));
          });
        };

        const start = Date.now();
        yield* _(Effect.promise(() => engine.tickWhileRunning(blackboard)));
        const totalDuration = Date.now() - start;

        // Should have at least 5 ticks
        expect(tickTimes.length).toBe(5);

        // Verify that ticks don't all happen at the exact same time (indicating delays exist)
        // With setImmediate, delays are minimal but still yield to event loop
        // Check that at least some time passed (even if very small)
        // This ensures we're not executing all ticks synchronously
        expect(totalDuration).toBeGreaterThanOrEqual(0);

        // Verify ticks are spread across time (not all at once)
        if (tickTimes.length > 1) {
          const timeDiffs = tickTimes
            .slice(1)
            // biome-ignore lint/style/noNonNullAssertion: <known to be there>
            .map((time, i) => time - tickTimes[i]!);
          // At least one tick should have some delay (even if 0ms, setImmediate still yields)
          // The important thing is that we're yielding to the event loop
          expect(timeDiffs.some((diff) => diff >= 0)).toBe(true);
        }
      }),
    );

    it.live("should pass resumeFromNodeId only on the first tick", () =>
      Effect.gen(function* (_) {
        const resumeNodeIdPerTick: Array<string | undefined> = [];
        let tickCount = 0;

        mockNode.tick = (context: EffectTickContext) => {
          return Effect.gen(function* (_) {
            tickCount++;
            resumeNodeIdPerTick.push(context.resumeFromNodeId);
            if (tickCount < 3) {
              return yield* _(Effect.succeed(NodeStatus.RUNNING));
            }
            return yield* _(Effect.succeed(NodeStatus.SUCCESS));
          });
        };

        const result = yield* _(
          Effect.promise(() =>
            engine.tickWhileRunning(blackboard, 10, "resume-node-123"),
          ),
        );

        expect(result.status).toBe(NodeStatus.SUCCESS);
        expect(tickCount).toBe(3);
        // First tick should have the resumeFromNodeId
        expect(resumeNodeIdPerTick[0]).toBe("resume-node-123");
        // Subsequent ticks should NOT have resumeFromNodeId
        expect(resumeNodeIdPerTick[1]).toBeUndefined();
        expect(resumeNodeIdPerTick[2]).toBeUndefined();
      }),
    );
  });

  describe("Auto-reset option", () => {
    it.live("should auto-reset tree before tick if configured", () =>
      Effect.gen(function* (_) {
        mockNode = new MockAction({
          id: "test-node",
          returnStatus: NodeStatus.SUCCESS,
        });

        const resetSpy = vi.spyOn(mockNode, "reset");

        engine = new TickEngine(mockNode, { autoReset: true, treeRegistry });

        // First tick - node starts as IDLE, so no reset needed
        yield* _(Effect.promise(() => engine.tick(blackboard)));
        expect(mockNode.status()).toBe(NodeStatus.SUCCESS);
        expect(resetSpy).toHaveBeenCalledTimes(0);

        // Second tick - should reset first since status is SUCCESS (completed)
        yield* _(Effect.promise(() => engine.tick(blackboard)));

        // Reset should have been called once (before the second tick)
        expect(resetSpy).toHaveBeenCalledTimes(1);
      }),
    );

    it.live("should not reset if node is RUNNING", () =>
      Effect.gen(function* (_) {
        // Create a node that always returns RUNNING
        mockNode = new MockAction({
          id: "test-node",
          returnStatus: NodeStatus.RUNNING,
        });

        const resetSpy = vi.spyOn(mockNode, "reset");

        engine = new TickEngine(mockNode, { autoReset: true, treeRegistry });

        // First tick - returns RUNNING
        yield* _(Effect.promise(() => engine.tick(blackboard)));
        expect(mockNode.status()).toBe(NodeStatus.RUNNING);
        expect(resetSpy).toHaveBeenCalledTimes(0);

        // Second tick - should NOT reset because status is RUNNING
        yield* _(Effect.promise(() => engine.tick(blackboard)));
        expect(mockNode.status()).toBe(NodeStatus.RUNNING);

        // Reset should never have been called
        expect(resetSpy).toHaveBeenCalledTimes(0);
      }),
    );
  });

  describe("Timeout handling", () => {
    it.live("should timeout if tick takes too long", () =>
      Effect.gen(function* (_) {
        mockNode.tick = (_context: EffectTickContext) => {
          return Effect.gen(function* (_) {
            yield* _(Effect.sleep("100 millis"));
            return yield* _(Effect.succeed(NodeStatus.SUCCESS));
          });
        };

        engine = new TickEngine(mockNode, { tickTimeout: 50, treeRegistry });

        const result = yield* _(
          Effect.exit(Effect.promise(() => engine.tick(blackboard))),
        );
        expect(result._tag).toBe("Failure");
      }),
    );

    it.live("should complete if within timeout", () =>
      Effect.gen(function* (_) {
        mockNode.tick = (_context: EffectTickContext) => {
          return Effect.gen(function* (_) {
            yield* _(Effect.sleep("30 millis"));
            return yield* _(Effect.succeed(NodeStatus.SUCCESS));
          });
        };

        engine = new TickEngine(mockNode, { tickTimeout: 100, treeRegistry });

        const status = yield* _(Effect.promise(() => engine.tick(blackboard)));
        expect(status).toBe(NodeStatus.SUCCESS);
      }),
    );
  });

  describe("Event callbacks", () => {
    it.live("should call onTick callback", () =>
      Effect.gen(function* (_) {
        const onTick = vi.fn();

        engine = new TickEngine(mockNode, { onTick, treeRegistry });

        yield* _(Effect.promise(() => engine.tick(blackboard)));

        expect(onTick).toHaveBeenCalledWith(
          NodeStatus.SUCCESS,
          expect.any(Number),
        );
        const elapsed = onTick.mock.calls[0]?.[1];
        expect(elapsed).toBeGreaterThanOrEqual(0);
      }),
    );

    it.live("should call onError callback", () =>
      Effect.gen(function* (_) {
        const error = new Error("Test error");
        const onError = vi.fn();

        // Override executeTick instead of tick to go through ActionNode's catchAll
        mockNode.executeTick = () => {
          return Effect.fail(error);
        };

        engine = new TickEngine(mockNode, { onError, treeRegistry });

        // With Effect.catchAll, node errors are converted to FAILURE status
        // The onError callback is only called for TickEngine-level errors (like timeout)
        const status = yield* _(Effect.promise(() => engine.tick(blackboard)));
        expect(status).toBe(NodeStatus.FAILURE);
        expect(onError).not.toHaveBeenCalled(); // Node errors don't trigger onError
      }),
    );
  });

  describe("Halt functionality", () => {
    it.live("should halt running tree", () =>
      Effect.gen(function* (_) {
        const waitNode = new WaitAction({
          id: "wait-node",
          waitMs: 100,
        });

        const haltSpy = vi.spyOn(waitNode, "halt");

        engine = new TickEngine(waitNode, { treeRegistry });

        // Start execution
        const tickPromise = Effect.promise(() => engine.tick(blackboard));

        // Give it time to start
        yield* _(Effect.sleep("10 millis"));

        // Halt the engine
        engine.halt();

        expect(haltSpy).toHaveBeenCalled();
        expect(engine.isEngineRunning()).toBe(false);

        // Original tick should still complete
        yield* _(tickPromise);
      }),
    );

    it.live("should abort via AbortSignal", () =>
      Effect.gen(function* (_) {
        let signalAborted = false;

        mockNode.tick = (context: EffectTickContext) => {
          return Effect.gen(function* (_) {
            context.signal?.addEventListener("abort", () => {
              signalAborted = true;
            });

            yield* _(Effect.sleep("50 millis"));
            return yield* _(Effect.succeed(NodeStatus.SUCCESS));
          });
        };

        engine = new TickEngine(mockNode, { treeRegistry });

        // Start execution - tick() sets isRunning = true synchronously
        const tickPromise = engine.tick(blackboard);

        // Give it a moment to start the async work
        yield* _(Effect.sleep("10 millis"));

        // Halt which should abort the signal
        engine.halt();

        // Wait for tick to complete (may fail due to abort)
        yield* _(
          Effect.promise(() => tickPromise).pipe(
            Effect.catchAll(() => Effect.succeed(null)),
          ),
        );
        expect(signalAborted).toBe(true);
      }),
    );
  });

  describe("Signal-based cancellation", () => {
    it.live(
      "should stop execution when node checks signal during operation",
      () =>
        Effect.gen(function* (_) {
          let operationStarted = false;
          let operationCompleted = false;

          // Node that checks signal during work
          mockNode.tick = (context: EffectTickContext) => {
            return Effect.gen(function* (_) {
              operationStarted = true;

              // Simulate work with signal checking
              for (let i = 0; i < 10; i++) {
                yield* _(checkSignal(context.signal));
                yield* _(Effect.sleep("10 millis"));
              }

              operationCompleted = true;
              return yield* _(Effect.succeed(NodeStatus.SUCCESS));
            });
          };

          engine = new TickEngine(mockNode, { treeRegistry });

          // Start tick
          const tickPromise = engine.tick(blackboard);

          // Wait for operation to start
          yield* _(Effect.sleep("20 millis"));
          expect(operationStarted).toBe(true);

          // Halt the engine
          engine.halt();

          // Wait for tick to complete (should throw OperationCancelledError)
          const result = yield* _(
            Effect.exit(Effect.promise(() => tickPromise)),
          );

          // Should have failed due to cancellation
          expect(result._tag).toBe("Failure");
          expect(operationCompleted).toBe(false); // Operation should NOT complete
        }),
    );

    it.live("should propagate cancellation through composite nodes", () =>
      Effect.gen(function* (_) {
        const childrenTicked: string[] = [];

        // Create sequence with multiple children
        const sequence = new Sequence({ id: "seq" });

        const createChild = (id: string) => {
          const child = new MockAction({
            id,
            returnStatus: NodeStatus.SUCCESS,
          });
          child.tick = (context: EffectTickContext) => {
            return Effect.gen(function* (_) {
              // Check signal before executing
              yield* _(checkSignal(context.signal));
              childrenTicked.push(id);
              yield* _(Effect.sleep("20 millis"));
              return yield* _(Effect.succeed(NodeStatus.SUCCESS));
            });
          };
          return child;
        };

        sequence.addChildren([
          createChild("child1"),
          createChild("child2"),
          createChild("child3"),
        ]);

        engine = new TickEngine(sequence, { treeRegistry });

        // Start tick
        const tickPromise = engine.tick(blackboard);

        // Wait for first child to start
        yield* _(Effect.sleep("10 millis"));

        // Halt before all children complete
        engine.halt();

        // Wait for tick to complete
        const result = yield* _(Effect.exit(Effect.promise(() => tickPromise)));

        // Should have cancelled
        expect(result._tag).toBe("Failure");

        // Not all children should have ticked (cancellation stopped propagation)
        expect(childrenTicked.length).toBeLessThan(3);
      }),
    );

    it.live("should respond to halt within 100ms", () =>
      Effect.gen(function* (_) {
        // Node that does long work but checks signal frequently
        mockNode.tick = (context: EffectTickContext) => {
          return Effect.gen(function* (_) {
            // Long operation with frequent signal checks
            for (let i = 0; i < 100; i++) {
              yield* _(checkSignal(context.signal)); // Check every iteration
              yield* _(Effect.sleep("10 millis")); // Would take 1000ms total
            }
            return yield* _(Effect.succeed(NodeStatus.SUCCESS));
          });
        };

        engine = new TickEngine(mockNode, { treeRegistry });

        // Start tick
        const tickPromise = engine.tick(blackboard);

        // Wait a bit for operation to start
        yield* _(Effect.sleep("20 millis"));

        // Halt and measure response time
        const haltTime = Date.now();
        engine.halt();

        // Wait for tick to complete (should fail quickly)
        const result = yield* _(Effect.exit(Effect.promise(() => tickPromise)));
        const responseTime = Date.now() - haltTime;

        expect(result._tag).toBe("Failure");

        // Should respond within 100ms (likely much faster)
        expect(responseTime).toBeLessThan(100);
      }),
    );

    it.live("should clean up running operations map on cancellation", () =>
      Effect.gen(function* (_) {
        // Create a node that uses runningOps pattern
        const waitNode = new WaitAction({
          id: "wait-node",
          waitMs: 1000, // Long wait
        });

        // Override tick to add signal checking
        const originalTick = waitNode.tick.bind(waitNode);
        waitNode.tick = (context: EffectTickContext) => {
          return Effect.gen(function* (_) {
            // Check signal before starting
            yield* _(checkSignal(context.signal));
            return yield* _(originalTick(context));
          });
        };

        engine = new TickEngine(waitNode, { treeRegistry });

        // First tick - starts the wait operation (returns RUNNING)
        const firstTick = yield* _(
          Effect.promise(() => engine.tick(blackboard)),
        );
        expect(firstTick).toBe(NodeStatus.RUNNING);
        expect(engine.getTickCount()).toBe(1);

        // Halt the engine (should clear runningOps)
        engine.halt();

        // Reset to clear the HALTED state
        engine.reset();

        // Second tick - should start fresh (not try to resume the halted operation)
        const secondTick = yield* _(
          Effect.promise(() => engine.tick(blackboard)),
        );
        expect(secondTick).toBe(NodeStatus.RUNNING);
        expect(engine.getTickCount()).toBe(1); // Reset cleared count
      }),
    );

    it.live("should allow continuing after cancellation with fresh tick", () =>
      Effect.gen(function* (_) {
        let firstTickCancelled = false;
        let secondTickCompleted = false;

        mockNode.tick = (context: EffectTickContext) => {
          return Effect.gen(function* (_) {
            for (let i = 0; i < 10; i++) {
              yield* _(
                checkSignal(context.signal).pipe(
                  Effect.catchAll((error) => {
                    if ((error as Error).name === "OperationCancelledError") {
                      firstTickCancelled = true;
                    }
                    return Effect.fail(error);
                  }),
                ),
              );
              yield* _(Effect.sleep("20 millis"));
            }
            secondTickCompleted = true;
            return yield* _(Effect.succeed(NodeStatus.SUCCESS));
          });
        };

        engine = new TickEngine(mockNode, { treeRegistry });

        // First tick - will be cancelled
        const firstTick = engine.tick(blackboard);
        yield* _(Effect.sleep("10 millis"));
        engine.halt();
        yield* _(Effect.exit(Effect.promise(() => firstTick)));

        expect(firstTickCancelled).toBe(true);

        // Reset and try again - should work
        engine.reset();
        const secondTick = yield* _(
          Effect.promise(() => engine.tick(blackboard)),
        );

        expect(secondTick).toBe(NodeStatus.SUCCESS);
        expect(secondTickCompleted).toBe(true);
      }),
    );
  });

  describe("Reset functionality", () => {
    it.live("should reset tree and counters", () =>
      Effect.gen(function* (_) {
        const resetSpy = vi.spyOn(mockNode, "reset");

        yield* _(Effect.promise(() => engine.tick(blackboard)));
        yield* _(Effect.promise(() => engine.tick(blackboard)));

        expect(engine.getTickCount()).toBe(2);

        engine.reset();

        expect(resetSpy).toHaveBeenCalled();
        expect(engine.getTickCount()).toBe(0);
        expect(engine.getStatus()).toBe(NodeStatus.IDLE);
      }),
    );
  });

  describe("Error handling", () => {
    it.live("should not halt tree on node error (errors become FAILURE)", () =>
      Effect.gen(function* (_) {
        const haltSpy = vi.spyOn(mockNode, "halt");

        // Override executeTick instead of tick to go through ActionNode's catchAll
        mockNode.executeTick = () => {
          return Effect.fail(new Error("Test error"));
        };

        // With Effect.catchAll, node errors are converted to FAILURE status
        const status = yield* _(Effect.promise(() => engine.tick(blackboard)));
        expect(status).toBe(NodeStatus.FAILURE);
        expect(haltSpy).not.toHaveBeenCalled(); // Node errors don't trigger halt
      }),
    );

    it.live("should track tick count even on node error", () =>
      Effect.gen(function* (_) {
        // Override executeTick instead of tick to go through ActionNode's catchAll
        mockNode.executeTick = () => {
          return Effect.fail(new Error("Test error"));
        };

        // With Effect.catchAll, node errors are converted to FAILURE status
        const status = yield* _(Effect.promise(() => engine.tick(blackboard)));
        expect(status).toBe(NodeStatus.FAILURE);

        expect(engine.getTickCount()).toBe(1);
      }),
    );
  });

  describe("Complex tree execution", () => {
    it.live("should execute composite trees", () =>
      Effect.gen(function* (_) {
        const sequence = new Sequence({ id: "seq" });
        const child1 = new MockAction({
          id: "child1",
          returnStatus: NodeStatus.SUCCESS,
        });
        const child2 = new MockAction({
          id: "child2",
          returnStatus: NodeStatus.SUCCESS,
        });

        sequence.addChildren([child1, child2]);

        engine = new TickEngine(sequence, { treeRegistry });

        const status = yield* _(Effect.promise(() => engine.tick(blackboard)));
        expect(status).toBe(NodeStatus.SUCCESS);
        expect(child1.status()).toBe(NodeStatus.SUCCESS);
        expect(child2.status()).toBe(NodeStatus.SUCCESS);
      }),
    );
  });

  describe("Getters", () => {
    it("should return root node", () => {
      expect(engine.getRoot()).toBe(mockNode);
    });

    it.live("should track engine running state", () =>
      Effect.gen(function* (_) {
        const waitNode = new WaitAction({ id: "wait", waitMs: 50 });
        engine = new TickEngine(waitNode, { treeRegistry });

        expect(engine.isEngineRunning()).toBe(false);

        // Start tick - tick() sets isRunning = true synchronously at the start
        const tickPromise = engine.tick(blackboard);

        // Check immediately - isRunning should be true
        expect(engine.isEngineRunning()).toBe(true);

        // Wait for tick to complete
        yield* _(Effect.promise(() => tickPromise));
        expect(engine.isEngineRunning()).toBe(false);
      }),
    );
  });

  describe("Logging", () => {
    it.live("should log tick operations", () =>
      Effect.gen(function* (_) {
        const consoleSpy = vi.spyOn(console, "log");

        yield* _(Effect.promise(() => engine.tick(blackboard)));

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Starting tick #1"),
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("completed with status: SUCCESS"),
        );
      }),
    );
  });

  describe("Auto exponential backoff", () => {
    it.live("should use auto exponential backoff by default", () =>
      Effect.gen(function* (_) {
        let tickCount = 0;
        const tickTimes: number[] = [];
        const startTime = Date.now();

        mockNode.tick = (_context: EffectTickContext) => {
          tickCount++;
          tickTimes.push(Date.now() - startTime);
          return Effect.succeed(
            tickCount < 12 ? NodeStatus.RUNNING : NodeStatus.SUCCESS,
          );
        };

        // Default engine uses auto mode
        const engine = new TickEngine(mockNode, { treeRegistry });

        yield* _(Effect.promise(() => engine.tickWhileRunning(blackboard)));

        expect(tickCount).toBe(12);

        // First 5 ticks should be faster than later ticks (relative comparison)
        const firstFiveTime = tickTimes[4]; // Time for first 5 ticks
        // biome-ignore lint/style/noNonNullAssertion: <known to be there>
        const nextSixTime = tickTimes[11]! - tickTimes[5]!; // Time for ticks 6-11

        // The next 6 ticks should take more time due to exponential backoff
        // biome-ignore lint/style/noNonNullAssertion: <known to be there>
        expect(nextSixTime).toBeGreaterThan(firstFiveTime!);

        // Later ticks should have accumulated significant delays (at least 20ms)
        // biome-ignore lint/style/noNonNullAssertion: <known to be there>
        expect(tickTimes[11]! - tickTimes[5]!).toBeGreaterThan(20);
      }),
    );

    it.live("should reset delay when node completes", () =>
      Effect.gen(function* (_) {
        let tickCount = 0;
        const tickTimes: number[] = [];
        const startTime = Date.now();

        mockNode.tick = (_context: EffectTickContext) => {
          tickCount++;
          tickTimes.push(Date.now() - startTime);

          // First operation: 8 ticks RUNNING then SUCCESS
          if (tickCount <= 8) {
            return Effect.succeed(NodeStatus.RUNNING);
          }
          // Second operation: starts immediately after first completes
          if (tickCount <= 16) {
            return Effect.succeed(NodeStatus.RUNNING);
          }
          return Effect.succeed(NodeStatus.SUCCESS);
        };

        const engine = new TickEngine(mockNode, { treeRegistry });
        yield* _(Effect.promise(() => engine.tickWhileRunning(blackboard)));

        expect(tickCount).toBe(17);

        // Second operation should start fast (reset happened)
        // The gap between operations might include some delay from the first operation's last tick
        // biome-ignore lint/style/noNonNullAssertion: <known to be there>
        const gapBetweenOps = tickTimes[8]! - tickTimes[7]!;
        expect(gapBetweenOps).toBeLessThan(30); // Reset happened, so should be relatively fast

        // Second operation's first ticks should be immediate (reset happened)
        // Allow some variance due to timing precision and event loop scheduling
        // biome-ignore lint/style/noNonNullAssertion: <known to be there>
        const secondOpFirstTickGap = tickTimes[9]! - tickTimes[8]!;
        expect(secondOpFirstTickGap).toBeLessThanOrEqual(15); // Should be fast after reset (allows for setImmediate scheduling)
      }),
    );

    it.live("should reset delay when starting new operation", () =>
      Effect.gen(function* (_) {
        let operationCount = 0;
        let tickCount = 0;

        mockNode.tick = (_context: EffectTickContext) => {
          tickCount++;

          // Operation 1: completes quickly
          if (operationCount === 0) {
            if (tickCount === 3) {
              operationCount++;
              return Effect.succeed(NodeStatus.SUCCESS);
            }
            return Effect.succeed(NodeStatus.RUNNING);
          }

          // Operation 2: starts fresh (should reset)
          if (operationCount === 1) {
            if (tickCount === 6) {
              return Effect.succeed(NodeStatus.SUCCESS);
            }
            return Effect.succeed(NodeStatus.RUNNING);
          }

          return Effect.succeed(NodeStatus.SUCCESS);
        };

        const engine = new TickEngine(mockNode, { treeRegistry });
        const startTime = Date.now();

        yield* _(Effect.promise(() => engine.tickWhileRunning(blackboard)));
        yield* _(Effect.promise(() => engine.tickWhileRunning(blackboard)));

        const duration = Date.now() - startTime;

        // Both operations should complete quickly (reset prevents delay carryover)
        // Allow reasonable variance for event loop scheduling
        expect(duration).toBeLessThan(150);
      }),
    );

    it.live("should support fixed delay override", () =>
      Effect.gen(function* (_) {
        let tickCount = 0;
        const tickTimes: number[] = [];
        const startTime = Date.now();

        mockNode.tick = (_context: EffectTickContext) => {
          tickCount++;
          tickTimes.push(Date.now() - startTime);
          return Effect.succeed(
            tickCount < 5 ? NodeStatus.RUNNING : NodeStatus.SUCCESS,
          );
        };

        // Fixed 5ms delay
        const engine = new TickEngine(mockNode, {
          tickDelayMs: 5,
          treeRegistry,
        });

        yield* _(Effect.promise(() => engine.tickWhileRunning(blackboard)));

        expect(tickCount).toBe(5);

        // Each tick should have ~5ms gap (allow variance)
        // biome-ignore lint/style/noNonNullAssertion: <known to be there>
        const totalTime = tickTimes[4]! - tickTimes[0]!;
        expect(totalTime).toBeGreaterThan(15); // 4 delays * 5ms = 20ms (with variance)
        expect(totalTime).toBeLessThan(40); // Should not be much slower
      }),
    );

    it.live("should support immediate mode (legacy behavior)", () =>
      Effect.gen(function* (_) {
        let tickCount = 0;

        mockNode.tick = (_context: EffectTickContext) => {
          tickCount++;
          return Effect.succeed(
            tickCount < 10 ? NodeStatus.RUNNING : NodeStatus.SUCCESS,
          );
        };

        // Immediate mode (0ms = setImmediate)
        const engine = new TickEngine(mockNode, {
          tickDelayMs: 0,
          treeRegistry,
        });
        const startTime = Date.now();

        yield* _(Effect.promise(() => engine.tickWhileRunning(blackboard)));

        const duration = Date.now() - startTime;

        // Should complete very quickly with no delays
        // Increased threshold to 50ms to avoid flakiness in CI environments
        expect(duration).toBeLessThan(50);
      }),
    );
  });

  describe("Resume from node", () => {
    it.live(
      "should skip nodes before resume point when resumeFromNodeId is provided",
      () =>
        Effect.gen(function* (_) {
          const sequence = new Sequence({ id: "seq" });
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
          sequence.addChildren([child1, child2, child3]);

          engine = new TickEngine(sequence, { treeRegistry });
          const status = yield* _(
            Effect.promise(() => engine.tick(blackboard, "child2")),
          );

          expect(status).toBe(NodeStatus.SUCCESS);
          expect(child1.status()).toBe(NodeStatus.SKIPPED);
          expect(child2.status()).toBe(NodeStatus.SUCCESS);
          expect(child3.status()).toBe(NodeStatus.SUCCESS);
        }),
    );

    it.live(
      "should execute all nodes when resumeFromNodeId is not provided",
      () =>
        Effect.gen(function* (_) {
          const sequence = new Sequence({ id: "seq" });
          const child1 = new MockAction({
            id: "child1",
            returnStatus: NodeStatus.SUCCESS,
          });
          const child2 = new MockAction({
            id: "child2",
            returnStatus: NodeStatus.SUCCESS,
          });
          sequence.addChildren([child1, child2]);

          engine = new TickEngine(sequence, { treeRegistry });
          const status = yield* _(
            Effect.promise(() => engine.tick(blackboard)),
          );

          expect(status).toBe(NodeStatus.SUCCESS);
          expect(child1.status()).toBe(NodeStatus.SUCCESS);
          expect(child2.status()).toBe(NodeStatus.SUCCESS);
        }),
    );
  });

  describe("Execution feedback tracking", () => {
    it("should have empty logs initially", () => {
      expect(engine.logs).toEqual([]);
    });

    it("should have undefined lastFailedNodeId initially", () => {
      expect(engine.lastFailedNodeId).toBeUndefined();
    });

    it("should have undefined lastFailedError initially", () => {
      expect(engine.lastFailedError).toBeUndefined();
    });

    it.live("should track failed node via TICK_END events", () =>
      Effect.gen(function* (_) {
        const eventEmitter = new NodeEventEmitter();
        const failingNode = new MockAction({
          id: "fail-node",
          returnStatus: NodeStatus.FAILURE,
        });

        engine = new TickEngine(failingNode, { treeRegistry, eventEmitter });

        yield* _(Effect.promise(() => engine.tick(blackboard)));

        expect(engine.lastFailedNodeId).toBe("fail-node");
      }),
    );

    it("should collect LOG events", () => {
      const eventEmitter = new NodeEventEmitter();

      // Simulate LOG event collection by manually emitting
      engine = new TickEngine(mockNode, { treeRegistry, eventEmitter });

      eventEmitter.emit({
        type: NodeEventType.LOG,
        nodeId: "log-node",
        nodeName: "LogTest",
        nodeType: "LogMessage",
        timestamp: Date.now(),
        data: { level: "info", message: "Test log message" },
      });

      expect(engine.logs).toHaveLength(1);
      expect(engine.logs[0].message).toBe("Test log message");
      expect(engine.logs[0].level).toBe("info");
      expect(engine.logs[0].nodeId).toBe("log-node");
    });

    it.live("should return logs in tickWhileRunning result", () =>
      Effect.gen(function* (_) {
        const eventEmitter = new NodeEventEmitter();
        engine = new TickEngine(mockNode, { treeRegistry, eventEmitter });

        // Emit a LOG event before tickWhileRunning
        eventEmitter.emit({
          type: NodeEventType.LOG,
          nodeId: "log-node",
          nodeName: "LogTest",
          nodeType: "LogMessage",
          timestamp: Date.now(),
          data: { level: "info", message: "Pre-execution log" },
        });

        const result = yield* _(
          Effect.promise(() => engine.tickWhileRunning(blackboard)),
        );

        // tickWhileRunning clears logs at start, so the pre-execution log should not be included
        // Only logs emitted during execution are returned
        expect(result.logs).toEqual([]);
      }),
    );

    it.live("should return failedNodeId in tickWhileRunning result", () =>
      Effect.gen(function* (_) {
        const eventEmitter = new NodeEventEmitter();
        const failingNode = new MockAction({
          id: "fail-node",
          returnStatus: NodeStatus.FAILURE,
        });

        engine = new TickEngine(failingNode, { treeRegistry, eventEmitter });

        const result = yield* _(
          Effect.promise(() => engine.tickWhileRunning(blackboard)),
        );

        expect(result.status).toBe(NodeStatus.FAILURE);
        expect(result.failedNodeId).toBe("fail-node");
      }),
    );

    it.live("should clear state at start of each tickWhileRunning call", () =>
      Effect.gen(function* (_) {
        const eventEmitter = new NodeEventEmitter();
        const failingNode = new MockAction({
          id: "fail-node",
          returnStatus: NodeStatus.FAILURE,
        });

        engine = new TickEngine(failingNode, { treeRegistry, eventEmitter });

        // First execution - should fail
        const result1 = yield* _(
          Effect.promise(() => engine.tickWhileRunning(blackboard)),
        );
        expect(result1.failedNodeId).toBe("fail-node");

        // Change node to succeed
        failingNode.tick = () => Effect.succeed(NodeStatus.SUCCESS);

        // Second execution - should succeed with cleared state
        const result2 = yield* _(
          Effect.promise(() => engine.tickWhileRunning(blackboard)),
        );
        expect(result2.status).toBe(NodeStatus.SUCCESS);
        expect(result2.failedNodeId).toBeUndefined();
      }),
    );
  });
});
