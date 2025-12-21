/**
 * Tests for Precondition decorator
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { FailureNode, SuccessNode } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { Precondition } from "./precondition.js";

describe("Precondition", () => {
  let blackboard: ScopedBlackboard;
  let context: TemporalContext;

  beforeEach(() => {
    blackboard = new ScopedBlackboard("root");
    context = {
      blackboard,
      timestamp: Date.now(),
      deltaTime: 0,
    };
  });

  it("should execute child when precondition succeeds", async () => {
    const precond = new Precondition({ id: "precond1" });

    let childExecuted = false;
    class TrackedChild extends SuccessNode {
      tick(context: TemporalContext) {
        childExecuted = true;
        return super.tick(context);
      }
    }

    precond.setChild(new TrackedChild({ id: "child" }));
    precond.addPrecondition(new SuccessNode({ id: "condition" }));

    const result = await precond.tick(context);
    expect(result).toBe(NodeStatus.SUCCESS);
    expect(childExecuted).toBe(true);
  });

  it("should fail if required precondition not met", async () => {
    const precond = new Precondition({ id: "precond1" });

    precond.setChild(new SuccessNode({ id: "child" }));
    precond.addPrecondition(
      new FailureNode({ id: "condition" }),
      undefined,
      true,
    );

    const result = await precond.tick(context);
    expect(result).toBe(NodeStatus.FAILURE);
  });

  it("should run resolver on precondition failure", async () => {
    const precond = new Precondition({ id: "precond1" });

    let resolverExecuted = false;
    class TrackedResolver extends SuccessNode {
      tick(context: TemporalContext) {
        const superTick = super.tick.bind(this);
        return (async () => {
          resolverExecuted = true;
          // Fix the condition
          context.blackboard.set("conditionMet", true);
          return await superTick(context);
        })();
      }
    }

    // Condition checks blackboard
    class BlackboardCondition extends SuccessNode {
      tick(context: TemporalContext) {
        const self = this;
        return (async () => {
          const met = context.blackboard.get("conditionMet");
          self._status = met ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
          return self._status;
        })();
      }
    }

    precond.setChild(new SuccessNode({ id: "child" }));
    precond.addPrecondition(
      new BlackboardCondition({ id: "condition" }),
      new TrackedResolver({ id: "resolver" }),
      true,
    );

    const result = await precond.tick(context);
    expect(resolverExecuted).toBe(true);
    expect(result).toBe(NodeStatus.SUCCESS);
  });

  it("should skip optional preconditions", async () => {
    const precond = new Precondition({ id: "precond1" });

    let childExecuted = false;
    class TrackedChild extends SuccessNode {
      tick(context: TemporalContext) {
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

    const result = await precond.tick(context);
    expect(result).toBe(NodeStatus.SUCCESS);
    expect(childExecuted).toBe(true);
  });

  it("should check multiple preconditions", async () => {
    const precond = new Precondition({ id: "precond1" });

    precond.setChild(new SuccessNode({ id: "child" }));
    precond.addPrecondition(new SuccessNode({ id: "cond1" }));
    precond.addPrecondition(new SuccessNode({ id: "cond2" }));
    precond.addPrecondition(new SuccessNode({ id: "cond3" }));

    const result = await precond.tick(context);
    expect(result).toBe(NodeStatus.SUCCESS);
  });

  it("should fail on first failed required precondition", async () => {
    const precond = new Precondition({ id: "precond1" });

    let cond3Checked = false;
    class Cond3 extends SuccessNode {
      tick(context: TemporalContext) {
        const superTick = super.tick.bind(this);
        return (async () => {
          cond3Checked = true;
          return await superTick(context);
        })();
      }
    }

    precond.setChild(new SuccessNode({ id: "child" }));
    precond.addPrecondition(new SuccessNode({ id: "cond1" }));
    precond.addPrecondition(new FailureNode({ id: "cond2" })); // Fails here
    precond.addPrecondition(new Cond3({ id: "cond3" }));

    const result = await precond.tick(context);
    expect(result).toBe(NodeStatus.FAILURE);
    expect(cond3Checked).toBe(false); // Should not reach cond3
  });

  it("should propagate RUNNING from precondition", async () => {
    const precond = new Precondition({ id: "precond1" });

    let tickCount = 0;
    class RunningCondition extends SuccessNode {
      tick(_context: TemporalContext) {
        const self = this;
        return (async () => {
          tickCount++;
          self._status =
            tickCount < 2 ? NodeStatus.RUNNING : NodeStatus.SUCCESS;
          return self._status;
        })();
      }
    }

    precond.setChild(new SuccessNode({ id: "child" }));
    precond.addPrecondition(new RunningCondition({ id: "condition" }));

    let result = await precond.tick(context);
    expect(result).toBe(NodeStatus.RUNNING);

    result = await precond.tick(context);
    expect(result).toBe(NodeStatus.SUCCESS);
  });

  it("should propagate ConfigurationError if no child", async () => {
    const precond = new Precondition({ id: "precond1" });
    precond.addPrecondition(new SuccessNode({ id: "condition" }));

    try {
      await precond.tick(context);
      throw new Error("Expected tick to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).message).toContain(
        "Precondition requires a child",
      );
    }
  });

  describe("Multi-tick child execution - FIXED BEHAVIOR", () => {
    it(
      "should check precondition ONCE and not re-check while child is RUNNING",
      async () => {
        let conditionTickCount = 0;
        let childTickCount = 0;

        // Condition that counts how many times it's checked
        class CountingCondition extends SuccessNode {
          tick(_context: TemporalContext) {
            const self = this;
            return (async () => {
              conditionTickCount++;
              console.log(`[CountingCondition] Tick #${conditionTickCount}`);
              self._status = NodeStatus.SUCCESS;
              return NodeStatus.SUCCESS;
            })();
          }
        }

        // Child that returns RUNNING for first 2 ticks, then SUCCESS
        class MultiTickChild extends SuccessNode {
          tick(context: TemporalContext) {
            const self = this;
            const superTick = super.tick.bind(this);
            return (async () => {
              childTickCount++;
              console.log(`[MultiTickChild] Tick #${childTickCount}`);

              if (childTickCount < 3) {
                self._status = NodeStatus.RUNNING;
                return NodeStatus.RUNNING;
              }

              return await superTick(context); // SUCCESS on tick 3
            })();
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
        const status1 = await precondition.tick(context);
        expect(status1).toBe(NodeStatus.RUNNING);
        expect(conditionTickCount).toBe(1); // Condition checked once
        expect(childTickCount).toBe(1); // Child executed once

        // Tick 2: ✅ FIXED: Should NOT re-check condition, just execute child (returns RUNNING)
        const status2 = await precondition.tick(context);
        expect(status2).toBe(NodeStatus.RUNNING);
        expect(conditionTickCount).toBe(1); // ✅ Still 1! Not re-checked
        expect(childTickCount).toBe(2); // Child executed again

        // Tick 3: ✅ FIXED: Should NOT re-check condition, just execute child (returns SUCCESS)
        const status3 = await precondition.tick(context);
        expect(status3).toBe(NodeStatus.SUCCESS);
        expect(conditionTickCount).toBe(1); // ✅ Still 1! Not re-checked
        expect(childTickCount).toBe(3); // Child completes

        // Summary: Condition was checked only 1 time (on first tick)
        // This confirms the precondition is NOT re-evaluated on subsequent ticks
        console.log(
          "\n✅ FIXED: Precondition checked only 1 time, not re-checked during child execution",
        );
      },
    );

    it(
      "should NOT be affected if precondition changes while child is RUNNING (safe behavior)",
      async () => {
        let childTickCount = 0;
        let conditionShouldSucceed = true;

        // Condition that succeeds initially, then fails on subsequent ticks
        class ChangeableCondition extends SuccessNode {
          tick(_context: TemporalContext) {
            const self = this;
            return (async () => {
              const result = conditionShouldSucceed
                ? NodeStatus.SUCCESS
                : NodeStatus.FAILURE;
              console.log(`[ChangeableCondition] Returning: ${result}`);
              self._status = result;
              return result;
            })();
          }
        }

        // Child that takes 3 ticks to complete
        class SlowChild extends SuccessNode {
          tick(context: TemporalContext) {
            const self = this;
            const superTick = super.tick.bind(this);
            return (async () => {
              childTickCount++;
              console.log(`[SlowChild] Tick #${childTickCount}`);

              if (childTickCount < 3) {
                self._status = NodeStatus.RUNNING;
                return NodeStatus.RUNNING;
              }

              return await superTick(context); // SUCCESS on tick 3
            })();
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
        const status1 = await precondition.tick(context);
        expect(status1).toBe(NodeStatus.RUNNING);
        expect(childTickCount).toBe(1);

        // Change condition to fail
        conditionShouldSucceed = false;

        // Tick 2: ✅ FIXED: Precondition is NOT re-checked, child continues
        const status2 = await precondition.tick(context);
        expect(status2).toBe(NodeStatus.RUNNING); // ✅ Still RUNNING!
        expect(childTickCount).toBe(2); // ✅ Child continues executing

        // Tick 3: ✅ FIXED: Child completes successfully despite precondition now failing
        const status3 = await precondition.tick(context);
        expect(status3).toBe(NodeStatus.SUCCESS); // ✅ Child completes!
        expect(childTickCount).toBe(3); // Child executed all 3 ticks

        // This demonstrates the fix: child execution is NOT interrupted
        // even though the precondition would now fail if re-checked
        console.log(
          "\n✅ SAFE: Child execution continues uninterrupted despite precondition change",
        );
      },
    );
  });
});
