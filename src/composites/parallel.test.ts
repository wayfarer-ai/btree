import { beforeEach, describe, expect, it } from "vitest";
import { ActionNode } from "../base-node.js";
import { ScopedBlackboard } from "../blackboard.js";
import { MockAction } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { Parallel } from "./parallel.js";

/**
 * Helper: Creates an action that completes after N ticks
 */
class DelayedAction extends ActionNode {
  private ticksRemaining: number;
  private readonly totalTicks: number;
  private readonly finalStatus: NodeStatus;

  constructor(config: { id: string; ticks: number; finalStatus?: NodeStatus }) {
    super(config);
    this.totalTicks = config.ticks;
    this.ticksRemaining = config.ticks;
    this.finalStatus = config.finalStatus ?? NodeStatus.SUCCESS;
  }

  async executeTick(_context: TemporalContext): Promise<NodeStatus> {
    this.log(
      `Tick ${this.totalTicks - this.ticksRemaining + 1}/${this.totalTicks}`,
    );

    if (this.ticksRemaining > 0) {
      this.ticksRemaining--;

      if (this.ticksRemaining === 0) {
        this.log(`Completing with ${this.finalStatus}`);
        return this.finalStatus;
      }

      this.log("Still running");
      return NodeStatus.RUNNING;
    }

    return this.finalStatus;
  }

  reset(): void {
    super.reset();
    this.ticksRemaining = this.totalTicks;
  }
}

/**
 * Helper: Creates an action that tracks execution timestamps
 */
class TimestampedAction extends ActionNode {
  public startTime: number = 0;
  public completionTime: number = 0;
  private delay: number;
  private finalStatus: NodeStatus;

  constructor(config: { id: string; delay: number; finalStatus?: NodeStatus }) {
    super(config);
    this.delay = config.delay;
    this.finalStatus = config.finalStatus ?? NodeStatus.SUCCESS;
  }

  async executeTick(_context: TemporalContext): Promise<NodeStatus> {
    this.startTime = Date.now();

    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, this.delay));

    this.completionTime = Date.now();
    return this.finalStatus;
  }

  reset(): void {
    super.reset();
    this.startTime = 0;
    this.completionTime = 0;
  }
}

describe("Parallel - Concurrent Execution", () => {
  let context: TemporalContext;

  beforeEach(() => {
    context = {
      blackboard: new ScopedBlackboard(),
      timestamp: Date.now(),
      deltaTime: 0,
    };
  });

  describe("Basic Behavior", () => {
    it("should return SUCCESS when empty", async () => {
      const parallel = new Parallel({ id: "test-parallel" });
      const status = await parallel.tick(context);
      expect(status).toBe(NodeStatus.SUCCESS);
    });

    it("should execute all children concurrently (not sequentially)", async () => {
      const parallel = new Parallel({ id: "test-parallel" });

      // Create 3 children with 50ms delay each
      const child1 = new TimestampedAction({ id: "child1", delay: 50 });
      const child2 = new TimestampedAction({ id: "child2", delay: 50 });
      const child3 = new TimestampedAction({ id: "child3", delay: 50 });

      parallel.addChildren([child1, child2, child3]);

      const overallStart = Date.now();
      const status = await parallel.tick(context);
      const overallEnd = Date.now();
      const totalTime = overallEnd - overallStart;

      // If sequential: would take ~150ms (50 * 3)
      // If concurrent: should take ~50ms (max of all)
      expect(totalTime).toBeLessThan(100); // Generous margin for CI
      expect(status).toBe(NodeStatus.SUCCESS);

      // All should start at roughly the same time
      const startTimes = [
        child1.startTime,
        child2.startTime,
        child3.startTime,
      ];
      const maxStartDiff = Math.max(...startTimes) - Math.min(...startTimes);
      expect(maxStartDiff).toBeLessThan(20); // All start within 20ms
    });
  });

  describe("Multi-Tick Support (RUNNING status)", () => {
    it(
      "should return RUNNING on first tick if children are not done",
      async () => {
        const parallel = new Parallel({ id: "test-parallel" });

        // Child needs 3 ticks to complete
        const child1 = new DelayedAction({ id: "child1", ticks: 3 });
        const child2 = new MockAction({
          id: "child2",
          returnStatus: NodeStatus.SUCCESS,
        });

        parallel.addChildren([child1, child2]);

        // Tick 1: child1 returns RUNNING, child2 returns SUCCESS
        const status1 = await parallel.tick(context);
        expect(status1).toBe(NodeStatus.RUNNING);
      },
    );

    it("should continue tracking state across multiple ticks", async () => {
      const parallel = new Parallel({ id: "test-parallel" });

      const child1 = new DelayedAction({ id: "child1", ticks: 3 });
      const child2 = new DelayedAction({ id: "child2", ticks: 2 });

      parallel.addChildren([child1, child2]);

      // Tick 1: Both running
      const status1 = await parallel.tick(context);
      expect(status1).toBe(NodeStatus.RUNNING);

      // Tick 2: child2 done, child1 still running
      const status2 = await parallel.tick(context);
      expect(status2).toBe(NodeStatus.RUNNING);

      // Tick 3: Both done
      const status3 = await parallel.tick(context);
      expect(status3).toBe(NodeStatus.SUCCESS);
    });

    it("should retick children that return RUNNING", async () => {
      const parallel = new Parallel({ id: "test-parallel" });

      let child1ExecutionCount = 0;
      const child1 = new DelayedAction({ id: "child1", ticks: 2 });
      const originalTick = child1.tick.bind(child1);
      child1.tick = (ctx: TemporalContext) => {
        child1ExecutionCount++;
        return originalTick(ctx);
      };

      parallel.addChildren([child1]);

      await parallel.tick(context); // Tick 1: Launch child (returns RUNNING)
      expect(child1ExecutionCount).toBe(1);

      await parallel.tick(context); // Tick 2: Retick child (completes)
      expect(child1ExecutionCount).toBe(2);
    });
  });

  describe("Strategy: strict (all must succeed)", () => {
    it("should succeed when all children succeed", async () => {
      const parallel = new Parallel({
        id: "test-parallel",
        strategy: "strict",
      });

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

      parallel.addChildren([child1, child2, child3]);

      const status = await parallel.tick(context);
      expect(status).toBe(NodeStatus.SUCCESS);
    });

    it("should fail if any child fails", async () => {
      const parallel = new Parallel({
        id: "test-parallel",
        strategy: "strict",
      });

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

      parallel.addChildren([child1, child2, child3]);

      const status = await parallel.tick(context);
      expect(status).toBe(NodeStatus.FAILURE);
    });

    it("should use strict strategy by default", async () => {
      const parallel = new Parallel({ id: "test-parallel" }); // No strategy specified

      const child1 = new MockAction({
        id: "child1",
        returnStatus: NodeStatus.SUCCESS,
      });
      const child2 = new MockAction({
        id: "child2",
        returnStatus: NodeStatus.FAILURE,
      });

      parallel.addChildren([child1, child2]);

      const status = await parallel.tick(context);
      expect(status).toBe(NodeStatus.FAILURE); // Should fail because default is strict
    });

    it("should wait for all children to complete before returning", async () => {
      const parallel = new Parallel({
        id: "test-parallel",
        strategy: "strict",
      });

      const child1 = new DelayedAction({ id: "child1", ticks: 1 });
      const child2 = new DelayedAction({ id: "child2", ticks: 3 });

      parallel.addChildren([child1, child2]);

      // Tick 1: child1 done, child2 still running
      const status1 = await parallel.tick(context);
      expect(status1).toBe(NodeStatus.RUNNING);

      // Tick 2: child2 still running
      const status2 = await parallel.tick(context);
      expect(status2).toBe(NodeStatus.RUNNING);

      // Tick 3: Both done
      const status3 = await parallel.tick(context);
      expect(status3).toBe(NodeStatus.SUCCESS);
    });
  });

  describe("Strategy: unknown (at least one must succeed)", () => {
    it("should succeed if at least one child succeeds", async () => {
      const parallel = new Parallel({
        id: "test-parallel",
        strategy: "any",
      });

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
        returnStatus: NodeStatus.FAILURE,
      });

      parallel.addChildren([child1, child2, child3]);

      const status = await parallel.tick(context);
      expect(status).toBe(NodeStatus.SUCCESS);
    });

    it("should fail if all children fail", async () => {
      const parallel = new Parallel({
        id: "test-parallel",
        strategy: "any",
      });

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

      parallel.addChildren([child1, child2, child3]);

      const status = await parallel.tick(context);
      expect(status).toBe(NodeStatus.FAILURE);
    });

    it("should still wait for all children to complete", async () => {
      const parallel = new Parallel({
        id: "test-parallel",
        strategy: "any",
      });

      const child1 = new DelayedAction({
        id: "child1",
        ticks: 1,
        finalStatus: NodeStatus.SUCCESS,
      });
      const child2 = new DelayedAction({
        id: "child2",
        ticks: 3,
        finalStatus: NodeStatus.FAILURE,
      });

      parallel.addChildren([child1, child2]);

      // Even though child1 succeeded on tick 1, we wait for child2
      const status1 = await parallel.tick(context);
      expect(status1).toBe(NodeStatus.RUNNING);

      const status2 = await parallel.tick(context);
      expect(status2).toBe(NodeStatus.RUNNING);

      const status3 = await parallel.tick(context);
      expect(status3).toBe(NodeStatus.SUCCESS); // child1 succeeded
    });
  });

  describe("Error Handling", () => {
    it("should treat thrown errors as FAILURE", async () => {
      const parallel = new Parallel({
        id: "test-parallel",
        strategy: "strict",
      });

      class ErrorAction extends ActionNode {
        executeTick(_context: TemporalContext) {
          throw new Error("Test error");
        }
      }

      const child1 = new MockAction({
        id: "child1",
        returnStatus: NodeStatus.SUCCESS,
      });
      const child2 = new ErrorAction({ id: "child2" });

      parallel.addChildren([child1, child2]);

      const status = await parallel.tick(context);
      expect(status).toBe(NodeStatus.FAILURE);
    });

    it("should continue executing other children when one throws", async () => {
      const parallel = new Parallel({
        id: "test-parallel",
        strategy: "any",
      });

      class ErrorAction extends ActionNode {
        executeTick(_context: TemporalContext) {
          throw new Error("Test error");
        }
      }

      let _child1Executed = false;
      class TrackingAction extends ActionNode {
        async executeTick(_context: TemporalContext): Promise<NodeStatus> {
          _child1Executed = true;
          return NodeStatus.SUCCESS;
        }
      }

      const child1 = new TrackingAction({ id: "child1" });
      const child2 = new ErrorAction({ id: "child2" });

      parallel.addChildren([child1, child2]);

      const status = await parallel.tick(context);

      // With "any" strategy: succeeds if ANY child succeeds, fails only if ALL fail
      // Since child1 succeeds, parallel should return SUCCESS
      expect(status).toBe(NodeStatus.SUCCESS);
      // Both children should have executed (errors are caught, not propagated)
      expect(_child1Executed).toBe(true);
    });
  });

  describe("State Management", () => {
    it("should reset state on halt", async () => {
      const parallel = new Parallel({ id: "test-parallel" });

      const child1 = new DelayedAction({ id: "child1", ticks: 3 });
      parallel.addChildren([child1]);

      // Start execution
      const status1 = await parallel.tick(context);
      expect(status1).toBe(NodeStatus.RUNNING);

      // Halt - this clears internal state
      parallel.halt();

      // Child needs to be reset too for fresh start
      child1.reset();

      // Should be able to start fresh
      const status2 = await parallel.tick(context);
      expect(status2).toBe(NodeStatus.RUNNING);
    });

    it("should reset state on reset", async () => {
      const parallel = new Parallel({ id: "test-parallel" });

      const child1 = new DelayedAction({ id: "child1", ticks: 2 });
      parallel.addChildren([child1]);

      // Complete execution
      await parallel.tick(context);
      await parallel.tick(context);

      // Reset
      parallel.reset();
      child1.reset();

      // Should be able to run again
      const status1 = await parallel.tick(context);
      expect(status1).toBe(NodeStatus.RUNNING);
    });
  });

  describe("Real-World Scenario: WaitForNewPage + Click", () => {
    it("should handle Playwright pattern correctly", async () => {
      const parallel = new Parallel({
        id: "wait-and-click",
        strategy: "strict",
      });

      // Simulate WaitForNewPage: takes 2 ticks (waits for event)
      const waitForPage = new DelayedAction({
        id: "wait-for-page",
        ticks: 2,
        finalStatus: NodeStatus.SUCCESS,
      });

      // Simulate Click: completes immediately
      const click = new MockAction({
        id: "click",
        returnStatus: NodeStatus.SUCCESS,
      });

      parallel.addChildren([waitForPage, click]);

      // Tick 1: Click completes, WaitForPage still waiting
      const status1 = await parallel.tick(context);
      expect(status1).toBe(NodeStatus.RUNNING);

      // Tick 2: WaitForPage completes
      const status2 = await parallel.tick(context);
      expect(status2).toBe(NodeStatus.SUCCESS);
    });
  });
});
