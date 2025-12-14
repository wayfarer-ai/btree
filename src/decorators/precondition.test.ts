/**
 * Tests for Precondition decorator
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { FailureNode, SuccessNode } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { Precondition } from "./precondition.js";

describe("Precondition", () => {
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

  it.effect("should execute child when precondition succeeds", () =>
    Effect.gen(function* (_) {
      const precond = new Precondition({ id: "precond1" });

      let childExecuted = false;
      class TrackedChild extends SuccessNode {
        tick(context: EffectTickContext) {
          childExecuted = true;
          return super.tick(context);
        }
      }

      precond.setChild(new TrackedChild({ id: "child" }));
      precond.addPrecondition(new SuccessNode({ id: "condition" }));

      const result = yield* _(precond.tick(context));
      expect(result).toBe(NodeStatus.SUCCESS);
      expect(childExecuted).toBe(true);
    }),
  );

  it.effect("should fail if required precondition not met", () =>
    Effect.gen(function* (_) {
      const precond = new Precondition({ id: "precond1" });

      precond.setChild(new SuccessNode({ id: "child" }));
      precond.addPrecondition(
        new FailureNode({ id: "condition" }),
        undefined,
        true,
      );

      const result = yield* _(precond.tick(context));
      expect(result).toBe(NodeStatus.FAILURE);
    }),
  );

  it.effect("should run resolver on precondition failure", () =>
    Effect.gen(function* (_) {
      const precond = new Precondition({ id: "precond1" });

      let resolverExecuted = false;
      class TrackedResolver extends SuccessNode {
        tick(context: EffectTickContext) {
          const superTick = super.tick.bind(this);
          return Effect.gen(function* (_) {
            resolverExecuted = true;
            // Fix the condition
            context.blackboard.set("conditionMet", true);
            return yield* _(superTick(context));
          });
        }
      }

      // Condition checks blackboard
      class BlackboardCondition extends SuccessNode {
        tick(context: EffectTickContext) {
          const self = this;
          return Effect.gen(function* (_) {
            const met = context.blackboard.get("conditionMet");
            self._status = met ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
            return yield* _(Effect.succeed(self._status));
          });
        }
      }

      precond.setChild(new SuccessNode({ id: "child" }));
      precond.addPrecondition(
        new BlackboardCondition({ id: "condition" }),
        new TrackedResolver({ id: "resolver" }),
        true,
      );

      const result = yield* _(precond.tick(context));
      expect(resolverExecuted).toBe(true);
      expect(result).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should skip optional preconditions", () =>
    Effect.gen(function* (_) {
      const precond = new Precondition({ id: "precond1" });

      let childExecuted = false;
      class TrackedChild extends SuccessNode {
        tick(context: EffectTickContext) {
          childExecuted = true;
          return super.tick(context);
        }
      }

      precond.setChild(new TrackedChild({ id: "child" }));
      precond.addPrecondition(
        new FailureNode({ id: "condition" }),
        undefined,
        false,
      ); // Optional

      const result = yield* _(precond.tick(context));
      expect(result).toBe(NodeStatus.SUCCESS);
      expect(childExecuted).toBe(true);
    }),
  );

  it.effect("should check multiple preconditions", () =>
    Effect.gen(function* (_) {
      const precond = new Precondition({ id: "precond1" });

      precond.setChild(new SuccessNode({ id: "child" }));
      precond.addPrecondition(new SuccessNode({ id: "cond1" }));
      precond.addPrecondition(new SuccessNode({ id: "cond2" }));
      precond.addPrecondition(new SuccessNode({ id: "cond3" }));

      const result = yield* _(precond.tick(context));
      expect(result).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should fail on first failed required precondition", () =>
    Effect.gen(function* (_) {
      const precond = new Precondition({ id: "precond1" });

      let cond3Checked = false;
      class Cond3 extends SuccessNode {
        tick(context: EffectTickContext) {
          const superTick = super.tick.bind(this);
          return Effect.gen(function* (_) {
            cond3Checked = true;
            return yield* _(superTick(context));
          });
        }
      }

      precond.setChild(new SuccessNode({ id: "child" }));
      precond.addPrecondition(new SuccessNode({ id: "cond1" }));
      precond.addPrecondition(new FailureNode({ id: "cond2" })); // Fails here
      precond.addPrecondition(new Cond3({ id: "cond3" }));

      const result = yield* _(precond.tick(context));
      expect(result).toBe(NodeStatus.FAILURE);
      expect(cond3Checked).toBe(false); // Should not reach cond3
    }),
  );

  it.effect("should propagate RUNNING from precondition", () =>
    Effect.gen(function* (_) {
      const precond = new Precondition({ id: "precond1" });

      let tickCount = 0;
      class RunningCondition extends SuccessNode {
        tick(_context: EffectTickContext) {
          const self = this;
          return Effect.gen(function* (_) {
            tickCount++;
            self._status =
              tickCount < 2 ? NodeStatus.RUNNING : NodeStatus.SUCCESS;
            return yield* _(Effect.succeed(self._status));
          });
        }
      }

      precond.setChild(new SuccessNode({ id: "child" }));
      precond.addPrecondition(new RunningCondition({ id: "condition" }));

      let result = yield* _(precond.tick(context));
      expect(result).toBe(NodeStatus.RUNNING);

      result = yield* _(precond.tick(context));
      expect(result).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should propagate ConfigurationError if no child", () =>
    Effect.gen(function* (_) {
      const precond = new Precondition({ id: "precond1" });
      precond.addPrecondition(new SuccessNode({ id: "condition" }));

      const result = yield* _(Effect.exit(precond.tick(context)));
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure" && result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(ConfigurationError);
        expect(result.cause.error.message).toContain(
          "Precondition requires a child",
        );
      }
    }),
  );

  describe("Multi-tick child execution - FIXED BEHAVIOR", () => {
    it.effect(
      "should check precondition ONCE and not re-check while child is RUNNING",
      () =>
        Effect.gen(function* (_) {
          let conditionTickCount = 0;
          let childTickCount = 0;

          // Condition that counts how many times it's checked
          class CountingCondition extends SuccessNode {
            tick(_context: EffectTickContext) {
              const self = this;
              return Effect.gen(function* (_) {
                conditionTickCount++;
                console.log(`[CountingCondition] Tick #${conditionTickCount}`);
                self._status = NodeStatus.SUCCESS;
                return yield* _(Effect.succeed(NodeStatus.SUCCESS));
              });
            }
          }

          // Child that returns RUNNING for first 2 ticks, then SUCCESS
          class MultiTickChild extends SuccessNode {
            tick(context: EffectTickContext) {
              const self = this;
              const superTick = super.tick.bind(this);
              return Effect.gen(function* (_) {
                childTickCount++;
                console.log(`[MultiTickChild] Tick #${childTickCount}`);

                if (childTickCount < 3) {
                  self._status = NodeStatus.RUNNING;
                  return yield* _(Effect.succeed(NodeStatus.RUNNING));
                }

                return yield* _(superTick(context)); // SUCCESS on tick 3
              });
            }
          }

          const condition = new CountingCondition({ id: "counting-condition" });
          const child = new MultiTickChild({ id: "multi-tick-child" });
          const precondition = new Precondition({
            id: "test-precondition",
            name: "test-precondition",
          });

          precondition.setChild(child);
          precondition.addPrecondition(condition);

          // Tick 1: Should check condition, then execute child (returns RUNNING)
          const status1 = yield* _(precondition.tick(context));
          expect(status1).toBe(NodeStatus.RUNNING);
          expect(conditionTickCount).toBe(1); // Condition checked once
          expect(childTickCount).toBe(1); // Child executed once

          // Tick 2: ✅ FIXED: Should NOT re-check condition, just execute child (returns RUNNING)
          const status2 = yield* _(precondition.tick(context));
          expect(status2).toBe(NodeStatus.RUNNING);
          expect(conditionTickCount).toBe(1); // ✅ Still 1! Not re-checked
          expect(childTickCount).toBe(2); // Child executed again

          // Tick 3: ✅ FIXED: Should NOT re-check condition, just execute child (returns SUCCESS)
          const status3 = yield* _(precondition.tick(context));
          expect(status3).toBe(NodeStatus.SUCCESS);
          expect(conditionTickCount).toBe(1); // ✅ Still 1! Not re-checked
          expect(childTickCount).toBe(3); // Child completes

          // Summary: Condition was checked only 1 time (on first tick)
          // This confirms the precondition is NOT re-evaluated on subsequent ticks
          console.log(
            "\n✅ FIXED: Precondition checked only 1 time, not re-checked during child execution",
          );
        }),
    );

    it.effect(
      "should NOT be affected if precondition changes while child is RUNNING (safe behavior)",
      () =>
        Effect.gen(function* (_) {
          let childTickCount = 0;
          let conditionShouldSucceed = true;

          // Condition that succeeds initially, then fails on subsequent ticks
          class ChangeableCondition extends SuccessNode {
            tick(_context: EffectTickContext) {
              const self = this;
              return Effect.gen(function* (_) {
                const result = conditionShouldSucceed
                  ? NodeStatus.SUCCESS
                  : NodeStatus.FAILURE;
                console.log(`[ChangeableCondition] Returning: ${result}`);
                self._status = result;
                return yield* _(Effect.succeed(result));
              });
            }
          }

          // Child that takes 3 ticks to complete
          class SlowChild extends SuccessNode {
            tick(context: EffectTickContext) {
              const self = this;
              const superTick = super.tick.bind(this);
              return Effect.gen(function* (_) {
                childTickCount++;
                console.log(`[SlowChild] Tick #${childTickCount}`);

                if (childTickCount < 3) {
                  self._status = NodeStatus.RUNNING;
                  return yield* _(Effect.succeed(NodeStatus.RUNNING));
                }

                return yield* _(superTick(context)); // SUCCESS on tick 3
              });
            }
          }

          const condition = new ChangeableCondition({
            id: "changeable-condition",
          });
          const child = new SlowChild({ id: "slow-child" });
          const precondition = new Precondition({
            id: "test-precondition",
            name: "test-precondition",
          });

          precondition.setChild(child);
          precondition.addPrecondition(condition);

          // Tick 1: Precondition passes, child returns RUNNING
          const status1 = yield* _(precondition.tick(context));
          expect(status1).toBe(NodeStatus.RUNNING);
          expect(childTickCount).toBe(1);

          // Change condition to fail
          conditionShouldSucceed = false;

          // Tick 2: ✅ FIXED: Precondition is NOT re-checked, child continues
          const status2 = yield* _(precondition.tick(context));
          expect(status2).toBe(NodeStatus.RUNNING); // ✅ Still RUNNING!
          expect(childTickCount).toBe(2); // ✅ Child continues executing

          // Tick 3: ✅ FIXED: Child completes successfully despite precondition now failing
          const status3 = yield* _(precondition.tick(context));
          expect(status3).toBe(NodeStatus.SUCCESS); // ✅ Child completes!
          expect(childTickCount).toBe(3); // Child executed all 3 ticks

          // This demonstrates the fix: child execution is NOT interrupted
          // even though the precondition would now fail if re-checked
          console.log(
            "\n✅ SAFE: Child execution continues uninterrupted despite precondition change",
          );
        }),
    );
  });
});
