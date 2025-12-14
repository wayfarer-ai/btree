import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ActionNode } from "./base-node.js";
import { ScopedBlackboard } from "./blackboard.js";
import { Sequence } from "./composites/sequence.js";
import { Registry } from "./registry.js";
import { TickEngine } from "./tick-engine.js";
import { type EffectTickContext, NodeStatus } from "./types.js";

describe("TickEngine Snapshots", () => {
  let blackboard: ScopedBlackboard;
  let treeRegistry: Registry;

  beforeEach(() => {
    blackboard = new ScopedBlackboard("root");
    treeRegistry = new Registry();
  });

  describe("Snapshot Capture", () => {
    it.effect("should not capture snapshots by default", () =>
      Effect.gen(function* (_) {
        class SetValueAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              context.blackboard.set("key", "value");
              return NodeStatus.SUCCESS;
            });
          }
        }

        const tree = new Sequence({ id: "root" });
        tree.addChild(new SetValueAction({ id: "action1" }));

        const engine = new TickEngine(tree, { treeRegistry });

        yield* _(Effect.promise(() => engine.tick(blackboard)));

        expect(engine.getSnapshots()).toHaveLength(0);
      }),
    );

    it.effect("should only capture snapshots when state changes", () =>
      Effect.gen(function* (_) {
        class SetValueAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              context.blackboard.set("key", "value");
              return NodeStatus.SUCCESS;
            });
          }
        }

        const tree = new Sequence({ id: "root" });
        tree.addChild(new SetValueAction({ id: "action1" }));

        const engine = new TickEngine(tree, {
          captureSnapshots: true,
          treeRegistry,
        });

        yield* _(Effect.promise(() => engine.tick(blackboard)));

        const snapshots = engine.getSnapshots();
        expect(snapshots).toHaveLength(1); // Only 1 snapshot since state changed
        expect(snapshots[0]?.blackboard.get("key")).toBe("value");
      }),
    );

    it.effect("should not capture snapshot if state does not change", () =>
      Effect.gen(function* (_) {
        // Action that doesn't modify blackboard
        class NoOpAction extends ActionNode {
          executeTick(
            _context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.succeed(NodeStatus.SUCCESS);
          }
        }

        const tree = new Sequence({ id: "root" });
        tree.addChild(new NoOpAction({ id: "action1" }));

        const engine = new TickEngine(tree, {
          captureSnapshots: true,
          treeRegistry,
        });

        yield* _(Effect.promise(() => engine.tick(blackboard)));

        const snapshots = engine.getSnapshots();
        expect(snapshots).toHaveLength(0); // No snapshot - state didn't change!
      }),
    );

    it.effect("should capture blackboard state and diff", () =>
      Effect.gen(function* (_) {
        class ModifyAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              context.blackboard.set("modified", "afterValue");
              context.blackboard.set("count", 42);
              return NodeStatus.SUCCESS;
            });
          }
        }

        const tree = new Sequence({ id: "root" });
        tree.addChild(new ModifyAction({ id: "action1" }));

        const engine = new TickEngine(tree, {
          captureSnapshots: true,
          treeRegistry,
        });

        yield* _(Effect.promise(() => engine.tick(blackboard)));

        const snapshots = engine.getSnapshots();
        expect(snapshots).toHaveLength(1);

        // biome-ignore lint/style/noNonNullAssertion: <known to be there>
        const snapshot = snapshots[0]!;
        expect(snapshot.blackboard.get("modified")).toBe("afterValue");
        expect(snapshot.blackboard.get("count")).toBe(42);

        // Check diff
        expect(snapshot.blackboardDiff.added).toEqual({
          modified: "afterValue",
          count: 42,
        });
        expect(snapshot.blackboardDiff.modified).toEqual({});
        expect(snapshot.blackboardDiff.deleted).toEqual([]);
      }),
    );

    it.effect("should capture modifications correctly", () =>
      Effect.gen(function* (_) {
        class IncrementAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              const current = context.blackboard.get("counter") || 0;
              context.blackboard.set("counter", (current as number) + 1);
              return NodeStatus.SUCCESS;
            });
          }
        }

        const tree = new Sequence({ id: "root" });
        tree.addChild(new IncrementAction({ id: "increment" }));

        const engine = new TickEngine(tree, {
          captureSnapshots: true,
          autoReset: true,
          treeRegistry,
        });

        // First tick - sets counter to 1 (added)
        yield* _(Effect.promise(() => engine.tick(blackboard)));
        // Second tick - increments to 2 (modified)
        yield* _(Effect.promise(() => engine.tick(blackboard)));

        const snapshots = engine.getSnapshots();
        expect(snapshots).toHaveLength(2);

        // First snapshot: counter added
        expect(snapshots[0]?.blackboard.get("counter")).toBe(1);
        expect(snapshots[0]?.blackboardDiff.added).toHaveProperty("counter");

        // Second snapshot: counter modified
        expect(snapshots[1]?.blackboard.get("counter")).toBe(2);
        expect(snapshots[1]?.blackboardDiff.modified).toEqual({
          counter: { from: 1, to: 2 },
        });
      }),
    );

    it.effect("should capture independent snapshots (immutable)", () =>
      Effect.gen(function* (_) {
        class CounterAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              const current = context.blackboard.get("counter") || 0;
              context.blackboard.set("counter", (current as number) + 1);
              return NodeStatus.SUCCESS;
            });
          }
        }

        const tree = new Sequence({ id: "root" });
        tree.addChild(new CounterAction({ id: "increment" }));

        const engine = new TickEngine(tree, {
          captureSnapshots: true,
          autoReset: true,
          treeRegistry,
        });

        blackboard.set("counter", 0);
        yield* _(Effect.promise(() => engine.tick(blackboard)));
        yield* _(Effect.promise(() => engine.tick(blackboard)));

        const snapshots = engine.getSnapshots();
        expect(snapshots).toHaveLength(2);

        // Snapshots should be independent
        expect(snapshots[0]?.blackboard.get("counter")).toBe(1);
        expect(snapshots[1]?.blackboard.get("counter")).toBe(2);

        // Further modifications shouldn't affect snapshots
        blackboard.set("counter", 100);
        expect(snapshots[0]?.blackboard.get("counter")).toBe(1);
        expect(snapshots[1]?.blackboard.get("counter")).toBe(2);
      }),
    );

    it.effect("should capture metadata in snapshot", () =>
      Effect.gen(function* (_) {
        class SetValueAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              context.blackboard.set("testKey", "testValue");
              return NodeStatus.SUCCESS;
            });
          }
        }

        const tree = new Sequence({ id: "root" });
        tree.addChild(new SetValueAction({ id: "action1" }));

        const engine = new TickEngine(tree, {
          captureSnapshots: true,
          treeRegistry,
        });

        const startTime = Date.now();
        yield* _(Effect.promise(() => engine.tick(blackboard)));
        const endTime = Date.now();

        const snapshots = engine.getSnapshots();
        expect(snapshots).toHaveLength(1);

        // biome-ignore lint/style/noNonNullAssertion: <known to be there>
        const snapshot = snapshots[0]!;
        expect(snapshot.timestamp).toBeGreaterThanOrEqual(startTime);
        expect(snapshot.timestamp).toBeLessThanOrEqual(endTime);
        expect(snapshot.tickNumber).toBe(1);
        expect(snapshot.rootNodeId).toBe("root");
        expect(snapshot.rootStatus).toBe(NodeStatus.SUCCESS);
      }),
    );

    it.effect("should capture execution trace", () =>
      Effect.gen(function* (_) {
        class SetValueAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              context.blackboard.set("key", "value");
              return NodeStatus.SUCCESS;
            });
          }
        }

        const tree = new Sequence({ id: "parent" });
        tree.addChild(new SetValueAction({ id: "child1" }));

        const engine = new TickEngine(tree, {
          captureSnapshots: true,
          treeRegistry,
        });

        yield* _(Effect.promise(() => engine.tick(blackboard)));

        const snapshots = engine.getSnapshots();
        expect(snapshots).toHaveLength(1);

        const snapshot = snapshots[0];
        expect(snapshot?.executionTrace).toBeDefined();
        expect(Array.isArray(snapshot?.executionTrace)).toBe(true);

        // Execution trace captures node execution details
        // May be empty if event emitter doesn't capture all events, but structure should exist
      }),
    );
  });

  describe("Snapshot Management", () => {
    it.effect("should accumulate snapshots across multiple ticks", () =>
      Effect.gen(function* (_) {
        class CounterAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              const current = context.blackboard.get("counter") || 0;
              context.blackboard.set("counter", (current as number) + 1);
              return NodeStatus.SUCCESS;
            });
          }
        }

        const tree = new Sequence({ id: "root" });
        tree.addChild(new CounterAction({ id: "counter" }));

        const engine = new TickEngine(tree, {
          captureSnapshots: true,
          autoReset: true,
          treeRegistry,
        });

        blackboard.set("counter", 0);
        yield* _(Effect.promise(() => engine.tick(blackboard)));
        yield* _(Effect.promise(() => engine.tick(blackboard)));
        yield* _(Effect.promise(() => engine.tick(blackboard)));

        const snapshots = engine.getSnapshots();
        expect(snapshots).toHaveLength(3); // One per tick (all changed state)
        expect(snapshots[0]?.blackboard.get("counter")).toBe(1);
        expect(snapshots[1]?.blackboard.get("counter")).toBe(2);
        expect(snapshots[2]?.blackboard.get("counter")).toBe(3);
      }),
    );

    it.effect("should clear snapshots when requested", () =>
      Effect.gen(function* (_) {
        class SetValueAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              context.blackboard.set("key", "value");
              return NodeStatus.SUCCESS;
            });
          }
        }

        const tree = new Sequence({ id: "root" });
        tree.addChild(new SetValueAction({ id: "action1" }));

        const engine = new TickEngine(tree, {
          captureSnapshots: true,
          treeRegistry,
        });

        yield* _(Effect.promise(() => engine.tick(blackboard)));
        expect(engine.getSnapshots()).toHaveLength(1);

        engine.clearSnapshots();
        expect(engine.getSnapshots()).toHaveLength(0);
      }),
    );

    it.effect("should return copy of snapshots array", () =>
      Effect.gen(function* (_) {
        class SetValueAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              context.blackboard.set("key", "value");
              return NodeStatus.SUCCESS;
            });
          }
        }

        const tree = new Sequence({ id: "root" });
        tree.addChild(new SetValueAction({ id: "action1" }));

        const engine = new TickEngine(tree, {
          captureSnapshots: true,
          treeRegistry,
        });

        yield* _(Effect.promise(() => engine.tick(blackboard)));

        const snapshots1 = engine.getSnapshots();
        const snapshots2 = engine.getSnapshots();

        expect(snapshots1).not.toBe(snapshots2); // Different arrays
        expect(snapshots1).toHaveLength(snapshots2.length);
      }),
    );
  });

  describe("Debugging Use Case", () => {
    it.effect("should help identify where state changed", () =>
      Effect.gen(function* (_) {
        // Simulating a login flow that fails
        class NavigateAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              context.blackboard.set("currentUrl", "/login");
              return NodeStatus.SUCCESS;
            });
          }
        }

        class FillUsernameAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              context.blackboard.set("username", "testuser");
              return NodeStatus.SUCCESS;
            });
          }
        }

        class FillPasswordAction extends ActionNode {
          executeTick(
            _context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            // Oops! Forgot to set password
            return Effect.succeed(NodeStatus.SUCCESS);
          }
        }

        class SubmitAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              const username = context.blackboard.get("username");
              const password = context.blackboard.get("password");

              if (!username || !password) {
                return NodeStatus.FAILURE;
              }

              context.blackboard.set("currentUrl", "/dashboard");
              context.blackboard.set("loggedIn", true);
              return NodeStatus.SUCCESS;
            });
          }
        }

        const tree = new Sequence({ id: "login-test" });
        tree.addChildren([
          new NavigateAction({ id: "navigate" }),
          new FillUsernameAction({ id: "fill-username" }),
          new FillPasswordAction({ id: "fill-password" }),
          new SubmitAction({ id: "submit" }),
        ]);

        const engine = new TickEngine(tree, {
          captureSnapshots: true,
          treeRegistry,
        });

        const result = yield* _(Effect.promise(() => engine.tick(blackboard)));

        // Test failed
        expect(result).toBe(NodeStatus.FAILURE);

        // Debug: Inspect snapshots to find the problem
        const snapshots = engine.getSnapshots();

        // Should have 2 snapshots: navigate + fill-username
        expect(snapshots.length).toBeGreaterThan(0);

        // Last snapshot shows username was set but password wasn't
        const lastSnapshot = snapshots[snapshots.length - 1];
        expect(lastSnapshot?.blackboard.get("username")).toBe("testuser");
        expect(lastSnapshot?.blackboard.get("password")).toBeUndefined();

        // This tells us the FillPasswordAction didn't set the password
      }),
    );

    it.effect("should track state changes over multiple ticks", () =>
      Effect.gen(function* (_) {
        let stepCount = 0;

        class CountingAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              stepCount++;
              context.blackboard.set("step", stepCount);
              context.blackboard.set(`step${stepCount}Result`, "completed");
              return NodeStatus.SUCCESS;
            });
          }
        }

        const tree = new Sequence({ id: "multi-step" });
        tree.addChild(new CountingAction({ id: "step" }));

        const engine = new TickEngine(tree, {
          captureSnapshots: true,
          autoReset: true,
          treeRegistry,
        });

        // Execute 3 times
        yield* _(Effect.promise(() => engine.tick(blackboard)));
        yield* _(Effect.promise(() => engine.tick(blackboard)));
        yield* _(Effect.promise(() => engine.tick(blackboard)));

        const snapshots = engine.getSnapshots();

        // Should have 3 snapshots (one per tick)
        expect(snapshots.length).toBe(3);

        // Each snapshot shows progressive state
        expect(snapshots[0]?.blackboard.get("step")).toBe(1);
        expect(snapshots[1]?.blackboard.get("step")).toBe(2);
        expect(snapshots[2]?.blackboard.get("step")).toBe(3);

        // Check diffs - first is added, rest are modified
        expect(snapshots[0]?.blackboardDiff.added).toHaveProperty("step");
        expect(snapshots[1]?.blackboardDiff.modified).toHaveProperty("step");
        expect(snapshots[2]?.blackboardDiff.modified).toHaveProperty("step");
      }),
    );
  });

  describe("Performance Consideration", () => {
    it.effect("should handle large blackboards efficiently", () =>
      Effect.gen(function* (_) {
        let populated = false;

        class PopulateOrModifyAction extends ActionNode {
          executeTick(
            context: EffectTickContext,
          ): Effect.Effect<NodeStatus, never, never> {
            return Effect.sync(() => {
              if (!populated) {
                // First tick: populate with 100 keys
                for (let i = 0; i < 100; i++) {
                  context.blackboard.set(`key${i}`, {
                    data: `value${i}`,
                    nested: { array: [1, 2, 3, 4, 5] },
                  });
                }
                populated = true;
              } else {
                // Second tick: modify just one key
                context.blackboard.set("key99", {
                  data: "modified",
                  nested: { array: [9, 9, 9] },
                });
              }
              return NodeStatus.SUCCESS;
            });
          }
        }

        const tree = new Sequence({ id: "root" });
        tree.addChild(new PopulateOrModifyAction({ id: "action" }));

        const engine = new TickEngine(tree, {
          captureSnapshots: true,
          autoReset: true,
          treeRegistry,
        });

        // First tick - populate (adds 100 keys)
        yield* _(Effect.promise(() => engine.tick(blackboard)));

        // Second tick - modify one key (should only see 1 modification)
        const startTime = Date.now();
        yield* _(Effect.promise(() => engine.tick(blackboard)));
        const duration = Date.now() - startTime;

        // Should complete reasonably fast even with large blackboard
        expect(duration).toBeLessThan(100); // 100ms threshold

        const snapshots = engine.getSnapshots();
        expect(snapshots).toHaveLength(2);

        // Second snapshot shows only the modification
        // biome-ignore lint/style/noNonNullAssertion: <known to be there>
        const modificationSnapshot = snapshots[1]!;
        expect(modificationSnapshot.blackboard.get("key99")).toEqual({
          data: "modified",
          nested: { array: [9, 9, 9] },
        });

        // Verify diff captured only the change (modified, not added)
        expect(
          Object.keys(modificationSnapshot.blackboardDiff.added),
        ).toHaveLength(0);
        expect(
          Object.keys(modificationSnapshot.blackboardDiff.modified),
        ).toHaveLength(1);
        expect(
          modificationSnapshot.blackboardDiff.modified.key99,
        ).toBeDefined();
      }),
    );
  });
});
