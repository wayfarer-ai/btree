/**
 * Tests for Recovery node
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { FailureNode, SuccessNode } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { Recovery } from "./recovery.js";

describe("Recovery", () => {
  let blackboard: ScopedBlackboard;
  let context: EffectTickContext;

  beforeEach(() => {
    blackboard = new ScopedBlackboard("root");
    context = {
      blackboard,
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };
  });

  describe("Try-Catch Logic", () => {
    it.effect("should return try result on success", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });
        recovery.addChild(new SuccessNode({ id: "try" }));
        recovery.addChild(new FailureNode({ id: "catch" }));

        const result = yield* _(recovery.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
      }),
    );

    it.effect("should execute catch on try failure", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });

        let catchExecuted = false;
        class CatchTracker extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              catchExecuted = true;
              return yield* _(superTick(context));
            });
          }
        }

        recovery.addChild(new FailureNode({ id: "try" }));
        recovery.addChild(new CatchTracker({ id: "catch" }));

        const result = yield* _(recovery.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(catchExecuted).toBe(true);
      }),
    );

    it.effect("should propagate catch result on try failure", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });
        recovery.addChild(new FailureNode({ id: "try" }));
        recovery.addChild(new FailureNode({ id: "catch" }));

        const result = yield* _(recovery.tick(context));
        expect(result).toBe(NodeStatus.FAILURE);
      }),
    );

    it.effect("should handle thrown errors with catch", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });

        class ThrowingNode extends SuccessNode {
          executeTick(_context: EffectTickContext) {
            return Effect.fail(new Error("Test error"));
          }
        }

        recovery.addChild(new ThrowingNode({ id: "try" }));
        recovery.addChild(new SuccessNode({ id: "catch" }));

        // With Effect.catchAll, errors are converted to FAILURE status
        // Recovery executes catch branch when try fails, and catch succeeds
        const status = yield* _(recovery.tick(context));
        expect(status).toBe(NodeStatus.SUCCESS); // Catch branch succeeds
      }),
    );

    it.effect("should return FAILURE on thrown error without catch", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });

        class ThrowingNode extends SuccessNode {
          executeTick(_context: EffectTickContext) {
            return Effect.fail(new Error("Test error"));
          }
        }

        recovery.addChild(new ThrowingNode({ id: "try" }));

        // With our changes, errors are caught and converted to FAILURE status
        // So recovery will complete with FAILURE status (no catch branch)
        const status = yield* _(recovery.tick(context));
        expect(status).toBe(NodeStatus.FAILURE);
      }),
    );
  });

  describe("Try-Finally Logic", () => {
    it.effect("should execute finally after successful try", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });

        let finallyExecuted = false;
        class FinallyTracker extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              finallyExecuted = true;
              return yield* _(superTick(context));
            });
          }
        }

        // Structure: try, catch (pass-through), finally
        recovery.addChild(new SuccessNode({ id: "try" }));
        recovery.addChild(new SuccessNode({ id: "catch" })); // No-op catch
        recovery.addChild(new FinallyTracker({ id: "finally" }));

        yield* _(recovery.tick(context));
        expect(finallyExecuted).toBe(true);
      }),
    );

    it.effect("should execute finally after failed try", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });

        let finallyExecuted = false;
        class FinallyTracker extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              finallyExecuted = true;
              return yield* _(superTick(context));
            });
          }
        }

        // Structure: try, catch, finally
        recovery.addChild(new FailureNode({ id: "try" }));
        recovery.addChild(new SuccessNode({ id: "catch" })); // Catch recovers
        recovery.addChild(new FinallyTracker({ id: "finally" }));

        yield* _(recovery.tick(context));
        expect(finallyExecuted).toBe(true);
      }),
    );

    it.effect("should not change result if finally fails", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });

        recovery.addChild(new SuccessNode({ id: "try" }));
        recovery.addChild(new SuccessNode({ id: "catch" })); // No-op catch
        recovery.addChild(new FailureNode({ id: "finally" }));

        const result = yield* _(recovery.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS); // Try result, not finally
      }),
    );
  });

  describe("Try-Catch-Finally Logic", () => {
    it.effect("should execute all branches in order", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });

        const executionOrder: string[] = [];

        class TryTracker extends FailureNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              executionOrder.push("try");
              return yield* _(superTick(context));
            });
          }
        }

        class CatchTracker extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              executionOrder.push("catch");
              return yield* _(superTick(context));
            });
          }
        }

        class FinallyTracker extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              executionOrder.push("finally");
              return yield* _(superTick(context));
            });
          }
        }

        recovery.addChild(new TryTracker({ id: "try" }));
        recovery.addChild(new CatchTracker({ id: "catch" }));
        recovery.addChild(new FinallyTracker({ id: "finally" }));

        yield* _(recovery.tick(context));
        expect(executionOrder).toEqual(["try", "catch", "finally"]);
      }),
    );

    it.effect("should execute finally even if catch fails", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });

        let finallyExecuted = false;
        class FinallyTracker extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              finallyExecuted = true;
              return yield* _(superTick(context));
            });
          }
        }

        recovery.addChild(new FailureNode({ id: "try" }));
        recovery.addChild(new FailureNode({ id: "catch" }));
        recovery.addChild(new FinallyTracker({ id: "finally" }));

        yield* _(recovery.tick(context));
        expect(finallyExecuted).toBe(true);
      }),
    );

    it.effect("should execute finally even on thrown errors", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });

        let _finallyExecuted = false;

        class ThrowingNode extends SuccessNode {
          executeTick(_context: EffectTickContext) {
            return Effect.fail(new Error("Test error"));
          }
        }

        class FinallyTracker extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              _finallyExecuted = true;
              return yield* _(superTick(context));
            });
          }
        }

        recovery.addChild(new ThrowingNode({ id: "try" }));
        recovery.addChild(new SuccessNode({ id: "catch" }));
        recovery.addChild(new FinallyTracker({ id: "finally" }));

        // With our changes, errors are caught and converted to FAILURE status
        // Recovery executes catch branch when try fails, catch succeeds, so recovery returns SUCCESS
        const status = yield* _(recovery.tick(context));
        expect(status).toBe(NodeStatus.SUCCESS); // Catch branch succeeds
        // Finally should execute even when try branch fails
        expect(_finallyExecuted).toBe(true);
      }),
    );
  });

  describe("Edge Cases", () => {
    it("should enforce maximum 3 children", () => {
      const recovery = new Recovery({ id: "recovery1" });
      recovery.addChild(new SuccessNode({ id: "try" }));
      recovery.addChild(new SuccessNode({ id: "catch" }));
      recovery.addChild(new SuccessNode({ id: "finally" }));

      expect(() => {
        recovery.addChild(new SuccessNode({ id: "extra" }));
      }).toThrow("Recovery can have maximum 3 children");
    });

    it.effect("should propagate ConfigurationError without try branch", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });

        const result = yield* _(Effect.exit(recovery.tick(context)));
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure" && result.cause._tag === "Fail") {
          expect(result.cause.error).toBeInstanceOf(ConfigurationError);
          expect(result.cause.error.message).toContain(
            "Recovery requires at least a try branch",
          );
        }
      }),
    );

    it.effect("should work with only try branch", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });
        recovery.addChild(new SuccessNode({ id: "try" }));

        const result = yield* _(recovery.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
      }),
    );

    it.effect(
      "should propagate ConfigurationError from try branch immediately",
      () =>
        Effect.gen(function* (_) {
          const recovery = new Recovery({ id: "recovery1" });

          class ConfigErrorNode extends SuccessNode {
            executeTick(_context: EffectTickContext) {
              return Effect.fail(new ConfigurationError("Test config error"));
            }
          }

          recovery.addChild(new ConfigErrorNode({ id: "try" }));
          recovery.addChild(new SuccessNode({ id: "catch" }));

          const result = yield* _(Effect.exit(recovery.tick(context)));
          expect(result._tag).toBe("Failure");
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(result.cause.error).toBeInstanceOf(ConfigurationError);
            expect(result.cause.error.message).toContain("Test config error");
          }
        }),
    );

    it.effect("should propagate ConfigurationError from finally branch", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });

        class ConfigErrorNode extends SuccessNode {
          executeTick(_context: EffectTickContext) {
            return Effect.fail(new ConfigurationError("Finally config error"));
          }
        }

        recovery.addChild(new SuccessNode({ id: "try" }));
        recovery.addChild(new SuccessNode({ id: "catch" }));
        recovery.addChild(new ConfigErrorNode({ id: "finally" }));

        const result = yield* _(Effect.exit(recovery.tick(context)));
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure" && result.cause._tag === "Fail") {
          expect(result.cause.error).toBeInstanceOf(ConfigurationError);
          expect(result.cause.error.message).toContain("Finally config error");
        }
      }),
    );

    it.effect(
      "should NOT execute finally when try has ConfigurationError (immediate propagation)",
      () =>
        Effect.gen(function* (_) {
          const recovery = new Recovery({ id: "recovery1" });

          let finallyExecuted = false;

          class ConfigErrorNode extends SuccessNode {
            executeTick(_context: EffectTickContext) {
              return Effect.fail(new ConfigurationError("Try config error"));
            }
          }

          class FinallyTracker extends SuccessNode {
            tick(context: EffectTickContext) {
              const superTick = super.tick.bind(this);
              return Effect.gen(function* (_) {
                finallyExecuted = true;
                return yield* _(superTick(context));
              });
            }
          }

          recovery.addChild(new ConfigErrorNode({ id: "try" }));
          recovery.addChild(new SuccessNode({ id: "catch" }));
          recovery.addChild(new FinallyTracker({ id: "finally" }));

          // ConfigurationError should propagate immediately without executing finally
          // This differs from traditional finally semantics but is intentional:
          // ConfigurationError means the test is broken, so we stop immediately
          const result = yield* _(Effect.exit(recovery.tick(context)));
          expect(result._tag).toBe("Failure");
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(result.cause.error).toBeInstanceOf(ConfigurationError);
          }
          expect(finallyExecuted).toBe(false);
        }),
    );

    it.effect("should return try result when finally returns RUNNING", () =>
      Effect.gen(function* (_) {
        const recovery = new Recovery({ id: "recovery1" });

        class RunningNode extends SuccessNode {
          tick(_context: EffectTickContext) {
            return Effect.succeed(NodeStatus.RUNNING);
          }
        }

        recovery.addChild(new SuccessNode({ id: "try" }));
        recovery.addChild(new SuccessNode({ id: "catch" }));
        recovery.addChild(new RunningNode({ id: "finally" }));

        const result = yield* _(recovery.tick(context));
        // Should return try result (SUCCESS), not finally result (RUNNING)
        expect(result).toBe(NodeStatus.SUCCESS);
      }),
    );
  });
});
