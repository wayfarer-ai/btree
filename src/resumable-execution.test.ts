/**
 * Tests for resumable execution functionality
 * Tests the ability to resume execution from a specific node
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "./blackboard.js";
import { Selector } from "./composites/selector.js";
import { Sequence } from "./composites/sequence.js";
import { Step } from "./composites/step.js";
import { ActionNode, type NodeConfiguration } from "./index.js";
import { Registry } from "./registry.js";
import { TickEngine } from "./tick-engine.js";
import { type EffectTickContext, NodeStatus } from "./types.js";

// Test action that tracks execution
class TrackableAction extends ActionNode {
  static executions = new Map<string, number>();

  executeTick(
    _context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    return Effect.sync(() => {
      const count = (TrackableAction.executions.get(this.id) || 0) + 1;
      TrackableAction.executions.set(this.id, count);
      this.log(`Execution #${count}`);
      this._status = NodeStatus.SUCCESS;
      return NodeStatus.SUCCESS;
    });
  }

  static getCount(id: string): number {
    return TrackableAction.executions.get(id) || 0;
  }

  static reset(): void {
    TrackableAction.executions.clear();
  }
}

describe("Resumable Execution", () => {
  let blackboard: ScopedBlackboard;

  beforeEach(() => {
    blackboard = new ScopedBlackboard("root");
    TrackableAction.reset();
  });

  describe("Basic Resume from Node", () => {
    it.effect("should skip nodes before resume point", () =>
      Effect.gen(function* (_) {
        const sequence = new Sequence({ id: "seq" });
        const node1 = new TrackableAction({ id: "node1" });
        const node2 = new TrackableAction({ id: "node2" });
        const node3 = new TrackableAction({ id: "node3" });

        sequence.addChildren([node1, node2, node3]);

        // Resume from node2 - should skip node1
        const context: EffectTickContext = {
          blackboard,
          timestamp: Date.now(),
          resumeFromNodeId: "node2",
          hasReachedResumePoint: false,
          sessionId: "test-1",
          runningOps: new Map(),
        };

        yield* _(sequence.tick(context));

        // node1 should be skipped (0 executions, status SKIPPED)
        expect(TrackableAction.getCount("node1")).toBe(0);
        expect(node1.status()).toBe(NodeStatus.SKIPPED);

        // node2 should execute (1 execution, reached resume point)
        expect(TrackableAction.getCount("node2")).toBe(1);
        expect(node2.status()).toBe(NodeStatus.SUCCESS);

        // node3 should execute (1 execution, after resume point)
        expect(TrackableAction.getCount("node3")).toBe(1);
        expect(node3.status()).toBe(NodeStatus.SUCCESS);

        // Sequence should succeed
        expect(sequence.status()).toBe(NodeStatus.SUCCESS);
      }),
    );

    it.effect("should mark skipped nodes with SKIPPED status", () =>
      Effect.gen(function* (_) {
        const sequence = new Sequence({ id: "seq" });
        const node1 = new TrackableAction({ id: "node1" });
        const node2 = new TrackableAction({ id: "node2" });
        const node3 = new TrackableAction({ id: "node3" });

        sequence.addChildren([node1, node2, node3]);

        const context: EffectTickContext = {
          blackboard,
          timestamp: Date.now(),
          resumeFromNodeId: "node3",
          hasReachedResumePoint: false,
          runningOps: new Map(),
        };

        yield* _(sequence.tick(context));

        expect(node1.status()).toBe(NodeStatus.SKIPPED);
        expect(node2.status()).toBe(NodeStatus.SKIPPED);
        expect(node3.status()).toBe(NodeStatus.SUCCESS);
      }),
    );

    it.effect("should propagate RUNNING status from resume point to root", () =>
      Effect.gen(function* (_) {
        const sequence = new Sequence({ id: "seq" });

        class RunningAction extends ActionNode {
          executeTick(): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              this._status = NodeStatus.RUNNING;
              return NodeStatus.RUNNING;
            });
          }
        }

        const node1 = new TrackableAction({ id: "node1" });
        const node2 = new RunningAction({ id: "node2" });
        const node3 = new TrackableAction({ id: "node3" });

        sequence.addChildren([node1, node2, node3]);

        const context: EffectTickContext = {
          blackboard,
          timestamp: Date.now(),
          resumeFromNodeId: "node2",
          hasReachedResumePoint: false,
          runningOps: new Map(),
        };

        const result = yield* _(sequence.tick(context));

        // node1 skipped
        expect(node1.status()).toBe(NodeStatus.SKIPPED);

        // node2 returns RUNNING
        expect(node2.status()).toBe(NodeStatus.RUNNING);

        // node3 never reached (stays IDLE)
        expect(node3.status()).toBe(NodeStatus.IDLE);

        // Sequence propagates RUNNING to root
        expect(sequence.status()).toBe(NodeStatus.RUNNING);
        expect(result).toBe(NodeStatus.RUNNING);
      }),
    );

    it.effect(
      "should keep nodes after resume point as IDLE if not reached",
      () =>
        Effect.gen(function* (_) {
          const sequence = new Sequence({ id: "seq" });

          class FailingAction extends ActionNode {
            executeTick(): Effect.Effect<NodeStatus, never, never> {
              return Effect.sync(() => {
                this._status = NodeStatus.FAILURE;
                return NodeStatus.FAILURE;
              });
            }
          }

          const node1 = new TrackableAction({ id: "node1" });
          const node2 = new FailingAction({ id: "node2" });
          const node3 = new TrackableAction({ id: "node3" });

          sequence.addChildren([node1, node2, node3]);

          const context: EffectTickContext = {
            blackboard,
            timestamp: Date.now(),
            resumeFromNodeId: "node2",
            hasReachedResumePoint: false,
            runningOps: new Map(),
          };

          yield* _(sequence.tick(context));

          expect(node1.status()).toBe(NodeStatus.SKIPPED);
          expect(node2.status()).toBe(NodeStatus.FAILURE);
          expect(node3.status()).toBe(NodeStatus.IDLE); // Never reached due to failure
        }),
    );
  });

  describe("Resume with Different Node Types", () => {
    it.effect("should work with Step nodes", () =>
      Effect.gen(function* (_) {
        const mainSeq = new Sequence({ id: "main" });

        const step1 = new Step({ id: "step1", name: "Step 1" });
        step1.addChild(new TrackableAction({ id: "step1-action" }));

        const step2 = new Step({ id: "step2", name: "Step 2" });
        step2.addChild(new TrackableAction({ id: "step2-action" }));

        const step3 = new Step({ id: "step3", name: "Step 3" });
        step3.addChild(new TrackableAction({ id: "step3-action" }));

        mainSeq.addChildren([step1, step2, step3]);

        // Resume from step2
        const context: EffectTickContext = {
          blackboard,
          timestamp: Date.now(),
          resumeFromNodeId: "step2",
          hasReachedResumePoint: false,
          runningOps: new Map(),
        };

        yield* _(mainSeq.tick(context));

        // Step is a composite, shows SUCCESS after traversal with skipped children
        expect(step1.status()).toBe(NodeStatus.SUCCESS);
        expect(TrackableAction.getCount("step1-action")).toBe(0);

        expect(step2.status()).toBe(NodeStatus.SUCCESS);
        expect(TrackableAction.getCount("step2-action")).toBe(1);

        expect(step3.status()).toBe(NodeStatus.SUCCESS);
        expect(TrackableAction.getCount("step3-action")).toBe(1);
      }),
    );

    it.effect("should work with Selector nodes", () =>
      Effect.gen(function* (_) {
        const selector = new Selector({ id: "selector" });

        class FailureAction extends ActionNode {
          executeTick(): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              this._status = NodeStatus.FAILURE;
              return NodeStatus.FAILURE;
            });
          }
        }

        const fail1 = new FailureAction({ id: "fail1" });
        const fail2 = new FailureAction({ id: "fail2" });
        const success = new TrackableAction({ id: "success" });

        selector.addChildren([fail1, fail2, success]);

        // Resume from success node
        const context: EffectTickContext = {
          blackboard,
          timestamp: Date.now(),
          resumeFromNodeId: "success",
          hasReachedResumePoint: false,
          runningOps: new Map(),
        };

        yield* _(selector.tick(context));

        // Leaf nodes before resume point are SKIPPED
        expect(fail1.status()).toBe(NodeStatus.SKIPPED);
        expect(fail2.status()).toBe(NodeStatus.SKIPPED);
        // success node is the resume point and executes
        expect(success.status()).toBe(NodeStatus.SUCCESS);
        // Selector succeeds when it hits success node
        expect(selector.status()).toBe(NodeStatus.SUCCESS);
      }),
    );

    it.effect("should work with nested sequences", () =>
      Effect.gen(function* (_) {
        const root = new Sequence({ id: "root" });
        const inner1 = new Sequence({ id: "inner1" });
        const inner2 = new Sequence({ id: "inner2" });

        inner1.addChildren([
          new TrackableAction({ id: "inner1-a" }),
          new TrackableAction({ id: "inner1-b" }),
        ]);

        inner2.addChildren([
          new TrackableAction({ id: "inner2-a" }),
          new TrackableAction({ id: "inner2-b" }),
        ]);

        root.addChildren([inner1, inner2]);

        // Resume from inner2-a
        const context: EffectTickContext = {
          blackboard,
          timestamp: Date.now(),
          resumeFromNodeId: "inner2-a",
          hasReachedResumePoint: false,
          runningOps: new Map(),
        };

        yield* _(root.tick(context));

        // All of inner1's children should be skipped
        // Composite (inner1) shows SUCCESS since it completed traversal
        expect(inner1.status()).toBe(NodeStatus.SUCCESS);
        expect(TrackableAction.getCount("inner1-a")).toBe(0);
        expect(TrackableAction.getCount("inner1-b")).toBe(0);

        // inner2 sequence should skip everything before inner2-a
        expect(inner2.status()).toBe(NodeStatus.SUCCESS);
        expect(TrackableAction.getCount("inner2-a")).toBe(1); // Resume point
        expect(TrackableAction.getCount("inner2-b")).toBe(1); // After resume
      }),
    );
  });

  describe("TickEngine Integration", () => {
    it("should provide createResumeContext helper", () => {
      const root = new Sequence({ id: "root" });
      const treeRegistry = new Registry();
      const engine = new TickEngine(root, { treeRegistry });

      const resumeContext = engine.createResumeContext(
        "node2",
        "session-123",
        blackboard,
      );

      expect(resumeContext.resumeFromNodeId).toBe("node2");
      expect(resumeContext.hasReachedResumePoint).toBe(false);
      expect(resumeContext.sessionId).toBe("session-123");
      expect(resumeContext.blackboard).toBe(blackboard);
      expect(resumeContext.timestamp).toBeGreaterThan(0);
    });

    it.effect("should work with TickEngine helper method", () =>
      Effect.gen(function* (_) {
        const sequence = new Sequence({ id: "root" });
        sequence.addChildren([
          new TrackableAction({ id: "expensive1" }),
          new TrackableAction({ id: "expensive2" }),
          new TrackableAction({ id: "quick" }),
        ]);

        const treeRegistry = new Registry();
        const engine = new TickEngine(sequence, { treeRegistry });

        // Create resume context to skip expensive operations
        const resumeContext = engine.createResumeContext(
          "quick",
          "repair-123",
          blackboard,
        );

        sequence.reset();
        yield* _(sequence.tick(resumeContext));

        expect(TrackableAction.getCount("expensive1")).toBe(0); // Skipped
        expect(TrackableAction.getCount("expensive2")).toBe(0); // Skipped
        expect(TrackableAction.getCount("quick")).toBe(1); // Executed
      }),
    );
  });

  describe("Blackboard State Preservation", () => {
    it.effect("should preserve blackboard values across resume", () =>
      Effect.gen(function* (_) {
        const sequence = new Sequence({ id: "seq" });

        class SetValueAction extends ActionNode {
          private key: string;
          private value: string;

          constructor(
            config: NodeConfiguration & { key: string; value: string },
          ) {
            super(config);
            this.key = config.key;
            this.value = config.value;
          }

          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, Error, never> {
            return Effect.sync(() => {
              context.blackboard.set(this.key, this.value);
              this._status = NodeStatus.SUCCESS;
              return NodeStatus.SUCCESS;
            });
          }
        }

        class CheckValueAction extends ActionNode {
          private key: string;
          private expectedValue: string;

          constructor(
            config: NodeConfiguration & { key: string; expectedValue: string },
          ) {
            super(config);
            this.key = config.key;
            this.expectedValue = config.expectedValue;
          }

          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, Error, never> {
            return Effect.sync(() => {
              const value = context.blackboard.get(this.key);
              expect(value).toBe(this.expectedValue);
              this._status = NodeStatus.SUCCESS;
              return NodeStatus.SUCCESS;
            });
          }
        }

        // Set value in skipped node
        blackboard.set("testKey", "setValue");

        sequence.addChildren([
          new SetValueAction({
            id: "setter",
            key: "testKey",
            value: "setValue",
          }),
          new CheckValueAction({
            id: "checker",
            key: "testKey",
            expectedValue: "setValue",
          }),
        ]);

        // Resume from checker - should still see the value in blackboard
        const context: EffectTickContext = {
          blackboard,
          timestamp: Date.now(),
          resumeFromNodeId: "checker",
          hasReachedResumePoint: false,
          runningOps: new Map(),
        };

        yield* _(sequence.tick(context));

        expect(blackboard.get("testKey")).toBe("setValue");
      }),
    );
  });

  describe("Edge Cases", () => {
    it.effect("should execute normally if resumeFromNodeId is not set", () =>
      Effect.gen(function* (_) {
        const sequence = new Sequence({ id: "seq" });
        sequence.addChildren([
          new TrackableAction({ id: "node1" }),
          new TrackableAction({ id: "node2" }),
        ]);

        const context: EffectTickContext = {
          blackboard,
          timestamp: Date.now(),
          runningOps: new Map(),
          // No resumeFromNodeId
        };

        yield* _(sequence.tick(context));

        expect(TrackableAction.getCount("node1")).toBe(1);
        expect(TrackableAction.getCount("node2")).toBe(1);
      }),
    );

    it.effect(
      "should execute all nodes if resumeFromNodeId is the first node",
      () =>
        Effect.gen(function* (_) {
          const sequence = new Sequence({ id: "seq" });
          sequence.addChildren([
            new TrackableAction({ id: "node1" }),
            new TrackableAction({ id: "node2" }),
          ]);

          const context: EffectTickContext = {
            blackboard,
            timestamp: Date.now(),
            resumeFromNodeId: "node1",
            hasReachedResumePoint: false,
            runningOps: new Map(),
          };

          yield* _(sequence.tick(context));

          expect(TrackableAction.getCount("node1")).toBe(1);
          expect(TrackableAction.getCount("node2")).toBe(1);
        }),
    );

    it.effect("should handle resumeFromNodeId that does not exist", () =>
      Effect.gen(function* (_) {
        const sequence = new Sequence({ id: "seq" });
        sequence.addChildren([
          new TrackableAction({ id: "node1" }),
          new TrackableAction({ id: "node2" }),
        ]);

        const context: EffectTickContext = {
          blackboard,
          timestamp: Date.now(),
          resumeFromNodeId: "nonexistent",
          hasReachedResumePoint: false,
          runningOps: new Map(),
        };

        yield* _(sequence.tick(context));

        // All nodes are skipped since resume point never reached
        expect(TrackableAction.getCount("node1")).toBe(0);
        expect(TrackableAction.getCount("node2")).toBe(0);
        expect(sequence.status()).toBe(NodeStatus.SUCCESS); // Empty success
      }),
    );
  });
});
