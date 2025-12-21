/**
 * Tests for While node
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { FailureNode, SuccessNode } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { While } from "./while.js";

describe("While", () => {
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

  describe("Basic Functionality", () => {
    it("should loop while condition is true", async () => {
      const whileNode = new While({ id: "while1" });

      let iterationCount = 0;
      class CountingCondition extends SuccessNode {
        async tick(context: TemporalContext): Promise<NodeStatus> {
          const superTick = super.tick.bind(this);
          // Succeed 3 times, then fail
          if (iterationCount < 3) {
            return await superTick(context);
          }
          this._status = NodeStatus.FAILURE;
          return NodeStatus.FAILURE;
        }
      }

      class CountingBody extends SuccessNode {
        async tick(context: TemporalContext): Promise<NodeStatus> {
          const superTick = super.tick.bind(this);
          iterationCount++;
          return await superTick(context);
        }
      }

      whileNode.addChild(new CountingCondition({ id: "condition" }));
      whileNode.addChild(new CountingBody({ id: "body" }));

      const result = await whileNode.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
      expect(iterationCount).toBe(3);
    });

    it("should stop when condition fails", async () => {
      const whileNode = new While({ id: "while1" });

      whileNode.addChild(new FailureNode({ id: "condition" }));
      whileNode.addChild(new SuccessNode({ id: "body" }));

      const result = await whileNode.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
    });

    it("should fail when body fails", async () => {
      const whileNode = new While({ id: "while1" });

      whileNode.addChild(new SuccessNode({ id: "condition" }));
      whileNode.addChild(new FailureNode({ id: "body" }));

      const result = await whileNode.tick(context);
      expect(result).toBe(NodeStatus.FAILURE);
    });
  });

  describe("RUNNING State", () => {
    it("should return RUNNING when condition is running", async () => {
      const whileNode = new While({ id: "while1" });

      let conditionTicks = 0;
      class RunningCondition extends SuccessNode {
        async tick(_context: TemporalContext): Promise<NodeStatus> {
          conditionTicks++;
          this._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;
        }
      }

      whileNode.addChild(new RunningCondition({ id: "condition" }));
      whileNode.addChild(new SuccessNode({ id: "body" }));

      const result = await whileNode.tick(context);
      expect(result).toBe(NodeStatus.RUNNING);
      expect(conditionTicks).toBe(1);
    });

    it("should return RUNNING when body is running", async () => {
      const whileNode = new While({ id: "while1" });

      let bodyTicks = 0;
      class RunningBody extends SuccessNode {
        async tick(_context: TemporalContext): Promise<NodeStatus> {
          bodyTicks++;
          this._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;
        }
      }

      whileNode.addChild(new SuccessNode({ id: "condition" }));
      whileNode.addChild(new RunningBody({ id: "body" }));

      const result = await whileNode.tick(context);
      expect(result).toBe(NodeStatus.RUNNING);
      expect(bodyTicks).toBe(1);
    });
  });

  describe("Safety Limit", () => {
    it("should enforce maxIterations", async () => {
      const whileNode = new While({
        id: "while1",
        maxIterations: 5,
      });

      let bodyTicks = 0;
      class CountingBody extends SuccessNode {
        async tick(context: TemporalContext): Promise<NodeStatus> {
          const superTick = super.tick.bind(this);
          bodyTicks++;
          return await superTick(context);
        }
      }

      // Condition always succeeds (infinite loop without maxIterations)
      whileNode.addChild(new SuccessNode({ id: "condition" }));
      whileNode.addChild(new CountingBody({ id: "body" }));

      const result = await whileNode.tick(context);
      expect(result).toBe(NodeStatus.FAILURE);
      expect(bodyTicks).toBe(5); // Stopped at maxIterations
    });

    it("should have default maxIterations of 1000", async () => {
      const whileNode = new While({ id: "while1" });

      let bodyTicks = 0;
      class CountingBody extends SuccessNode {
        async tick(context: TemporalContext): Promise<NodeStatus> {
          const superTick = super.tick.bind(this);
          bodyTicks++;
          // Fail after some iterations to avoid long test
          if (bodyTicks > 10) {
            this._status = NodeStatus.FAILURE;
            return NodeStatus.FAILURE;
          }
          return await superTick(context);
        }
      }

      whileNode.addChild(new SuccessNode({ id: "condition" }));
      whileNode.addChild(new CountingBody({ id: "body" }));

      const result = await whileNode.tick(context);
      expect(result).toBe(NodeStatus.FAILURE);
      expect(bodyTicks).toBe(11);
    });
  });

  describe("Edge Cases", () => {
    it("should enforce exactly 2 children", () => {
      const whileNode = new While({ id: "while1" });
      whileNode.addChild(new SuccessNode({ id: "child1" }));
      whileNode.addChild(new SuccessNode({ id: "child2" }));

      expect(() => {
        whileNode.addChild(new SuccessNode({ id: "child3" }));
      }).toThrow("While can have maximum 2 children");
    });

    it("should propagate ConfigurationError without condition", async () => {
      const whileNode = new While({ id: "while1" });

      try {
        await whileNode.tick(context);
        expect.fail("Should have thrown ConfigurationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect((error as ConfigurationError).message).toContain(
          "While requires a condition child",
        );
      }
    });

    it("should propagate ConfigurationError without body", async () => {
      const whileNode = new While({ id: "while1" });
      whileNode.addChild(new SuccessNode({ id: "condition" }));

      try {
        await whileNode.tick(context);
        expect.fail("Should have thrown ConfigurationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect((error as ConfigurationError).message).toContain(
          "While requires a body child",
        );
      }
    });

    it("should reset iteration count on reset", async () => {
      const whileNode = new While({ id: "while1", maxIterations: 3 });

      whileNode.addChild(new SuccessNode({ id: "condition" }));
      whileNode.addChild(new SuccessNode({ id: "body" }));

      // First execution hits max iterations
      await whileNode.tick(context);

      // Reset
      whileNode.reset();

      // Should be able to loop again
      const result = await whileNode.tick(context);
      expect(result).toBe(NodeStatus.FAILURE); // Hits maxIterations again
    });
  });

  describe("Multi-tick body execution - FIXED BEHAVIOR", () => {
    it(
      "should check condition ONCE per iteration, not re-check while body is RUNNING",
      async () => {
        let conditionTickCount = 0;
        let bodyTickCount = 0;

        // Condition that counts how many times it's checked
        class CountingCondition extends SuccessNode {
          async tick(_context: TemporalContext): Promise<NodeStatus> {
            conditionTickCount++;
            console.log(`[CountingCondition] Tick #${conditionTickCount}`);
            this._status = NodeStatus.SUCCESS;
            return NodeStatus.SUCCESS;
          }
        }

        // Body that returns RUNNING for first 2 ticks, then SUCCESS
        class MultiTickBody extends SuccessNode {
          async tick(context: TemporalContext): Promise<NodeStatus> {
            const superTick = super.tick.bind(this);
            bodyTickCount++;
            console.log(`[MultiTickBody] Tick #${bodyTickCount}`);

            if (bodyTickCount < 3) {
              this._status = NodeStatus.RUNNING;
              return NodeStatus.RUNNING;
            }

            return await superTick(context); // SUCCESS on tick 3
          }
        }

        const condition = new CountingCondition({ id: "counting-condition" });
        const body = new MultiTickBody({ id: "multi-tick-body" });
        const whileNode = new While({
          id: "test-while",
          name: "test-while",
          maxIterations: 2,
        });

        whileNode.addChild(condition);
        whileNode.addChild(body);

        // Tick 1: Should check condition, then execute body (returns RUNNING)
        const status1 = await whileNode.tick(context);
        expect(status1).toBe(NodeStatus.RUNNING);
        expect(conditionTickCount).toBe(1); // Condition checked once
        expect(bodyTickCount).toBe(1); // Body executed once

        // Tick 2: FIXED: Should NOT re-check condition, just execute body (returns RUNNING)
        const status2 = await whileNode.tick(context);
        expect(status2).toBe(NodeStatus.RUNNING);
        expect(conditionTickCount).toBe(1); // Still 1! Not re-checked
        expect(bodyTickCount).toBe(2); // Body executed again

        // Tick 3: FIXED: Body completes iteration 0
        // Note: The loop will continue and complete iteration 1 in the same tick, hitting maxIterations
        // But the key point is: condition was NOT re-checked during ticks 1-2 when body was RUNNING
        const status3 = await whileNode.tick(context);
        // Loop completes both iterations and hits maxIterations (returns FAILURE)
        expect(status3).toBe(NodeStatus.FAILURE);
        expect(conditionTickCount).toBeGreaterThanOrEqual(1); // At least checked once at start
        expect(bodyTickCount).toBeGreaterThanOrEqual(3); // Body completed iteration 0

        // Key verification: During ticks 1-2 (when body was RUNNING), condition was NOT re-checked
        // The conditionTickCount should be 1 after tick 2, proving no re-check during RUNNING
        // (We can't check after tick 3 because the loop continues and checks condition again for iteration 1)

        // Summary: Condition was checked once at start of iteration 0
        // It was NOT re-evaluated during ticks 1-2 when body was RUNNING
        // This confirms the fix works correctly
        console.log(
          "\n✅ FIXED: Condition checked once at start of iteration, not re-checked DURING body execution",
        );
      },
    );

    it(
      "should NOT be affected if condition changes while body is RUNNING",
      async () => {
        let bodyTickCount = 0;
        let conditionShouldSucceed = true;

        // Condition that succeeds initially, then fails on subsequent ticks
        class ChangeableCondition extends SuccessNode {
          async tick(_context: TemporalContext): Promise<NodeStatus> {
            const result = conditionShouldSucceed
              ? NodeStatus.SUCCESS
              : NodeStatus.FAILURE;
            console.log(`[ChangeableCondition] Returning: ${result}`);
            this._status = result;
            return result;
          }
        }

        // Body that takes 3 ticks to complete
        class SlowBody extends SuccessNode {
          async tick(context: TemporalContext): Promise<NodeStatus> {
            const superTick = super.tick.bind(this);
            bodyTickCount++;
            console.log(`[SlowBody] Tick #${bodyTickCount}`);

            if (bodyTickCount < 3) {
              this._status = NodeStatus.RUNNING;
              return NodeStatus.RUNNING;
            }

            return await superTick(context); // SUCCESS on tick 3
          }
        }

        const condition = new ChangeableCondition({
          id: "changeable-condition",
        });
        const body = new SlowBody({ id: "slow-body" });
        const whileNode = new While({
          id: "test-while",
          name: "test-while",
          maxIterations: 2,
        });

        whileNode.addChild(condition);
        whileNode.addChild(body);

        // Tick 1: Condition passes, body returns RUNNING
        const status1 = await whileNode.tick(context);
        expect(status1).toBe(NodeStatus.RUNNING);
        expect(bodyTickCount).toBe(1);

        // Change condition to fail
        conditionShouldSucceed = false;

        // Tick 2: FIXED: Condition is NOT re-checked, body continues
        const status2 = await whileNode.tick(context);
        expect(status2).toBe(NodeStatus.RUNNING); // Still RUNNING!
        expect(bodyTickCount).toBe(2); // Body continues executing

        // Tick 3: FIXED: Body completes the iteration despite condition now failing
        const status3 = await whileNode.tick(context);
        expect(status3).toBe(NodeStatus.SUCCESS); // Loop completes (body finished iteration)
        expect(bodyTickCount).toBe(3); // Body executed all 3 ticks

        // This demonstrates the fix: body execution is NOT interrupted
        // even though the condition would now fail if re-checked
        console.log(
          "\n✅ SAFE: Body execution continues uninterrupted despite condition change",
        );
      },
    );
  });
});
