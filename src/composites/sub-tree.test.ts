/**
 * Tests for SubTree node
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { BehaviorTree } from "../behavior-tree.js";
import { ScopedBlackboard } from "../blackboard.js";
import { Registry } from "../registry.js";
import { FailureNode, RunningNode, SuccessNode } from "../test-nodes.js";
import type { TreeNode } from "../types.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { Sequence } from "./sequence.js";
import { SubTree } from "./sub-tree.js";

describe("SubTree", () => {
  let blackboard: ScopedBlackboard;
  let treeRegistry: Registry;
  let context: EffectTickContext;

  // Helper to register a tree with BehaviorTree wrapper (uses test-scoped registry)
  const registerTree = (id: string, rootNode: TreeNode): void => {
    const tree = new BehaviorTree(rootNode);
    treeRegistry.registerTree(id, tree, "test-source");
  };

  beforeEach(() => {
    blackboard = new ScopedBlackboard("root");
    treeRegistry = new Registry();
    context = {
      blackboard,
      treeRegistry,
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };
  });

  describe("Basic Functionality", () => {
    it.effect("should reference and execute a registered behavior tree", () =>
      Effect.gen(function* (_) {
        // Register a simple tree
        const reusableTree = new Sequence({
          id: "reusable",
          name: "Reusable Steps",
        });
        reusableTree.addChildren([
          new SuccessNode({ id: "child1" }),
          new SuccessNode({ id: "child2" }),
        ]);
        registerTree("login-steps", reusableTree);

        // Create SubTree that references the tree
        const subTree = new SubTree({
          id: "sg1",
          name: "Login",
          treeId: "login-steps",
        });

        const result = yield* _(subTree.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
      }),
    );

    it.effect("should fail when tree completes with failure", () =>
      Effect.gen(function* (_) {
        // Register a tree that fails
        const failingTree = new Sequence({
          id: "failing",
          name: "Failing Steps",
        });
        failingTree.addChildren([
          new SuccessNode({ id: "child1" }),
          new FailureNode({ id: "child2" }),
        ]);
        registerTree("failing-steps", failingTree);

        const subTree = new SubTree({
          id: "sg1",
          name: "Failing Group",
          treeId: "failing-steps",
        });

        const result = yield* _(subTree.tick(context));
        expect(result).toBe(NodeStatus.FAILURE);
      }),
    );

    it.effect("should return running when tree is running", () =>
      Effect.gen(function* (_) {
        // Register a tree that stays running
        const runningTree = new Sequence({
          id: "running",
          name: "Running Steps",
        });
        runningTree.addChildren([
          new SuccessNode({ id: "child1" }),
          new RunningNode({ id: "child2" }),
        ]);
        registerTree("running-steps", runningTree);

        const subTree = new SubTree({
          id: "sg1",
          name: "Running Group",
          treeId: "running-steps",
        });

        const result = yield* _(subTree.tick(context));
        expect(result).toBe(NodeStatus.RUNNING);
      }),
    );

    it.effect("should throw error when tree ID is not found", () =>
      Effect.gen(function* (_) {
        const subTree = new SubTree({
          id: "sg1",
          name: "Invalid Group",
          treeId: "nonexistent-tree",
        });

        const status = yield* _(subTree.tick(context));
        expect(status).toBe(NodeStatus.FAILURE);
      }),
    );

    it.effect("should include available trees in error message", () =>
      Effect.gen(function* (_) {
        // Register some trees
        registerTree("tree1", new SuccessNode({ id: "t1" }));
        registerTree("tree2", new SuccessNode({ id: "t2" }));

        const subTree = new SubTree({
          id: "sg1",
          name: "Invalid Group",
          treeId: "nonexistent-tree",
        });

        const status = yield* _(subTree.tick(context));
        expect(status).toBe(NodeStatus.FAILURE);
      }),
    );
  });

  describe("Scoped Blackboard", () => {
    it.effect("should create scoped blackboard for subTree", () =>
      Effect.gen(function* (_) {
        // Create a custom node that checks its blackboard scope
        let capturedScopePath: string = "";
        class CheckScopeNode extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              capturedScopePath = context.blackboard.getFullScopePath();
              return yield* _(superTick(context));
            });
          }
        }

        const tree = new Sequence({ id: "scoped", name: "Scoped Tree" });
        tree.addChild(new CheckScopeNode({ id: "child1" }));
        registerTree("scoped-steps", tree);

        const subTree = new SubTree({
          id: "sg1",
          name: "Scoped Group",
          treeId: "scoped-steps",
        });

        yield* _(subTree.tick(context));

        // Should have created a scope
        expect(capturedScopePath).toContain("subtree_sg1");
      }),
    );

    it.effect("should isolate variables between subTrees", () =>
      Effect.gen(function* (_) {
        // First tree sets a value
        class SetValueNode extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              context.blackboard.set("localValue", "from-sg1");
              return yield* _(superTick(context));
            });
          }
        }

        // Second tree tries to read the value
        let capturedValue: unknown = "not-set";
        class ReadValueNode extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              capturedValue = context.blackboard.get("localValue");
              return yield* _(superTick(context));
            });
          }
        }

        const tree1 = new Sequence({ id: "tree1", name: "Tree 1" });
        tree1.addChild(new SetValueNode({ id: "child1" }));
        registerTree("steps1", tree1);

        const tree2 = new Sequence({ id: "tree2", name: "Tree 2" });
        tree2.addChild(new ReadValueNode({ id: "child2" }));
        registerTree("steps2", tree2);

        const sg1 = new SubTree({
          id: "sg1",
          name: "Group 1",
          treeId: "steps1",
        });
        const sg2 = new SubTree({
          id: "sg2",
          name: "Group 2",
          treeId: "steps2",
        });

        // Execute sg1 - sets localValue in its scope
        yield* _(sg1.tick(context));

        // Execute sg2 - should NOT see sg1's value
        yield* _(sg2.tick(context));

        // sg2 should not have access to sg1's scoped value
        expect(capturedValue).toBeUndefined();
      }),
    );

    it.effect("should inherit parent blackboard values", () =>
      Effect.gen(function* (_) {
        // Create a node that reads from parent scope
        let parentValue: unknown = "not-set";
        class ReadParentNode extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              parentValue = context.blackboard.get("inheritedValue");
              return yield* _(superTick(context));
            });
          }
        }

        const tree = new Sequence({ id: "tree", name: "Tree" });
        tree.addChild(new ReadParentNode({ id: "child1" }));
        registerTree("read-parent", tree);

        // Set value in parent blackboard
        blackboard.set("inheritedValue", "from-parent");

        const subTree = new SubTree({
          id: "sg1",
          name: "Reading Group",
          treeId: "read-parent",
        });

        yield* _(subTree.tick(context));

        // Should be able to read parent value
        expect(parentValue).toBe("from-parent");
      }),
    );

    it.effect("should not leak subTree-scoped values to parent", () =>
      Effect.gen(function* (_) {
        // Create a node that sets a value in its context
        class SetValueNode extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              context.blackboard.set("groupLocalValue", "group-value");
              return yield* _(superTick(context));
            });
          }
        }

        const tree = new Sequence({ id: "tree", name: "Tree" });
        tree.addChild(new SetValueNode({ id: "child1" }));
        registerTree("set-local", tree);

        const subTree = new SubTree({
          id: "sg1",
          name: "Setting Group",
          treeId: "set-local",
        });

        yield* _(subTree.tick(context));

        // Group-local value should NOT exist in parent blackboard
        expect(blackboard.has("groupLocalValue")).toBe(false);
      }),
    );
  });

  describe("Lazy Tree Cloning", () => {
    it.effect("should clone tree only on first tick", () =>
      Effect.gen(function* (_) {
        const tree = new SuccessNode({ id: "tree" });
        registerTree("lazy-tree", tree);

        const subTree = new SubTree({
          id: "sg1",
          name: "Lazy Group",
          treeId: "lazy-tree",
        });

        // First tick should clone the tree
        yield* _(subTree.tick(context));
        expect(subTree.clonedTree).toBeDefined();

        // Store reference to cloned tree
        const clonedTree = subTree.clonedTree;

        // Second tick should reuse the same cloned tree
        yield* _(subTree.tick(context));
        expect(subTree.clonedTree).toBe(clonedTree);
      }),
    );

    it.effect("should clone separate instances for different subTrees", () =>
      Effect.gen(function* (_) {
        const tree = new SuccessNode({ id: "tree" });
        registerTree("shared-tree", tree);

        const sg1 = new SubTree({
          id: "sg1",
          name: "Group 1",
          treeId: "shared-tree",
        });
        const sg2 = new SubTree({
          id: "sg2",
          name: "Group 2",
          treeId: "shared-tree",
        });

        yield* _(sg1.tick(context));
        yield* _(sg2.tick(context));

        // Each should have its own cloned instance
        expect(sg1.clonedTree).toBeDefined();
        expect(sg2.clonedTree).toBeDefined();
        expect(sg1.clonedTree).not.toBe(sg2.clonedTree);
      }),
    );
  });

  describe("Reset and Halt", () => {
    it.effect("should reset the referenced tree", () =>
      Effect.gen(function* (_) {
        const tree = new RunningNode({ id: "tree" });
        registerTree("reset-tree", tree);

        const subTree = new SubTree({
          id: "sg1",
          name: "Reset Group",
          treeId: "reset-tree",
        });

        yield* _(subTree.tick(context));
        expect(subTree.status()).toBe(NodeStatus.RUNNING);

        subTree.reset();
        expect(subTree.status()).toBe(NodeStatus.IDLE);
        expect(subTree.clonedTree?.status()).toBe(NodeStatus.IDLE);
      }),
    );

    it.effect("should halt the referenced tree", () =>
      Effect.gen(function* (_) {
        const tree = new RunningNode({ id: "tree" });
        registerTree("halt-tree", tree);

        const subTree = new SubTree({
          id: "sg1",
          name: "Halt Group",
          treeId: "halt-tree",
        });

        yield* _(subTree.tick(context));
        expect(subTree.status()).toBe(NodeStatus.RUNNING);
        expect(subTree.clonedTree?.status()).toBe(NodeStatus.RUNNING);

        subTree.halt();
        expect(subTree.status()).toBe(NodeStatus.IDLE);
        expect(subTree.clonedTree?.status()).toBe(NodeStatus.IDLE);
      }),
    );
  });

  describe("Clone", () => {
    it("should clone the subTree without cloning the cached tree", () => {
      const subTree = new SubTree({
        id: "sg1",
        name: "Original SubTree",
        treeId: "some-tree",
      });

      const cloned = subTree.clone() as SubTree;

      expect(cloned.id).toBe("sg1");
      expect(cloned.name).toBe("Original SubTree");
      expect(cloned.treeId).toBe("some-tree");
      expect(cloned.clonedTree).toBeUndefined();
    });

    it.effect("should allow cloned subTree to lazy-load its own tree", () =>
      Effect.gen(function* (_) {
        const tree = new SuccessNode({ id: "tree" });
        registerTree("clone-tree", tree);

        const original = new SubTree({
          id: "sg1",
          name: "Original",
          treeId: "clone-tree",
        });

        // Tick original to trigger lazy loading
        yield* _(original.tick(context));
        expect(original.clonedTree).toBeDefined();

        // Clone should not have a cached tree yet
        const cloned = original.clone() as SubTree;
        expect(cloned.clonedTree).toBeUndefined();

        // Tick clone to trigger its own lazy loading
        yield* _(cloned.tick(context));
        expect(cloned.clonedTree).toBeDefined();

        // Should be different instances
        expect(cloned.clonedTree).not.toBe(original.clonedTree);
      }),
    );
  });
});
