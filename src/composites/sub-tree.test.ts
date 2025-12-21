/**
 * Tests for SubTree node
 */

import { beforeEach, describe, expect, it } from "vitest";
import { BehaviorTree } from "../behavior-tree.js";
import { ScopedBlackboard } from "../blackboard.js";
import { Registry } from "../registry.js";
import { FailureNode, RunningNode, SuccessNode } from "../test-nodes.js";
import type { TreeNode } from "../types.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { Sequence } from "./sequence.js";
import { SubTree } from "./sub-tree.js";

describe("SubTree", () => {
  let blackboard: ScopedBlackboard;
  let treeRegistry: Registry;
  let context: TemporalContext;

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
    };
  });

  describe("Basic Functionality", () => {
    it("should reference and execute a registered behavior tree", async () => {
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

      const result = await subTree.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
    });

    it("should fail when tree completes with failure", async () => {
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

      const result = await subTree.tick(context);
      expect(result).toBe(NodeStatus.FAILURE);
    });

    it("should return running when tree is running", async () => {
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

      const result = await subTree.tick(context);
      expect(result).toBe(NodeStatus.RUNNING);
    });

    it("should throw error when tree ID is not found", async () => {
      const subTree = new SubTree({
        id: "sg1",
        name: "Invalid Group",
        treeId: "nonexistent-tree",
      });

      const status = await subTree.tick(context);
      expect(status).toBe(NodeStatus.FAILURE);
    });

    it("should include available trees in error message", async () => {
      // Register some trees
      registerTree("tree1", new SuccessNode({ id: "t1" }));
      registerTree("tree2", new SuccessNode({ id: "t2" }));

      const subTree = new SubTree({
        id: "sg1",
        name: "Invalid Group",
        treeId: "nonexistent-tree",
      });

      const status = await subTree.tick(context);
      expect(status).toBe(NodeStatus.FAILURE);
    });
  });

  describe("Scoped Blackboard", () => {
    it("should create scoped blackboard for subTree", async () => {
      // Create a custom node that checks its blackboard scope
      let capturedScopePath: string = "";
      class CheckScopeNode extends SuccessNode {
        async tick(context: TemporalContext) {
          capturedScopePath = context.blackboard.getFullScopePath();
          return await super.tick(context);
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

      await subTree.tick(context);

      // Should have created a scope
      expect(capturedScopePath).toContain("subtree_sg1");
    });

    it("should isolate variables between subTrees", async () => {
      // First tree sets a value
      class SetValueNode extends SuccessNode {
        async tick(context: TemporalContext) {
          context.blackboard.set("localValue", "from-sg1");
          return await super.tick(context);
        }
      }

      // Second tree tries to read the value
      let capturedValue: unknown = "not-set";
      class ReadValueNode extends SuccessNode {
        async tick(context: TemporalContext) {
          capturedValue = context.blackboard.get("localValue");
          return await super.tick(context);
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
      await sg1.tick(context);

      // Execute sg2 - should NOT see sg1's value
      await sg2.tick(context);

      // sg2 should not have access to sg1's scoped value
      expect(capturedValue).toBeUndefined();
    });

    it("should inherit parent blackboard values", async () => {
      // Create a node that reads from parent scope
      let parentValue: unknown = "not-set";
      class ReadParentNode extends SuccessNode {
        async tick(context: TemporalContext) {
          parentValue = context.blackboard.get("inheritedValue");
          return await super.tick(context);
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

      await subTree.tick(context);

      // Should be able to read parent value
      expect(parentValue).toBe("from-parent");
    });

    it("should not leak subTree-scoped values to parent", async () => {
      // Create a node that sets a value in its context
      class SetValueNode extends SuccessNode {
        async tick(context: TemporalContext) {
          context.blackboard.set("groupLocalValue", "group-value");
          return await super.tick(context);
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

      await subTree.tick(context);

      // Group-local value should NOT exist in parent blackboard
      expect(blackboard.has("groupLocalValue")).toBe(false);
    });
  });

  describe("Lazy Tree Cloning", () => {
    it("should clone tree only on first tick", async () => {
      const tree = new SuccessNode({ id: "tree" });
      registerTree("lazy-tree", tree);

      const subTree = new SubTree({
        id: "sg1",
        name: "Lazy Group",
        treeId: "lazy-tree",
      });

      // First tick should clone the tree
      await subTree.tick(context);
      expect(subTree.clonedTree).toBeDefined();

      // Store reference to cloned tree
      const clonedTree = subTree.clonedTree;

      // Second tick should reuse the same cloned tree
      await subTree.tick(context);
      expect(subTree.clonedTree).toBe(clonedTree);
    });

    it("should clone separate instances for different subTrees", async () => {
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

      await sg1.tick(context);
      await sg2.tick(context);

      // Each should have its own cloned instance
      expect(sg1.clonedTree).toBeDefined();
      expect(sg2.clonedTree).toBeDefined();
      expect(sg1.clonedTree).not.toBe(sg2.clonedTree);
    });
  });

  describe("Reset and Halt", () => {
    it("should reset the referenced tree", async () => {
      const tree = new RunningNode({ id: "tree" });
      registerTree("reset-tree", tree);

      const subTree = new SubTree({
        id: "sg1",
        name: "Reset Group",
        treeId: "reset-tree",
      });

      await subTree.tick(context);
      expect(subTree.status()).toBe(NodeStatus.RUNNING);

      subTree.reset();
      expect(subTree.status()).toBe(NodeStatus.IDLE);
      expect(subTree.clonedTree?.status()).toBe(NodeStatus.IDLE);
    });

    it("should halt the referenced tree", async () => {
      const tree = new RunningNode({ id: "tree" });
      registerTree("halt-tree", tree);

      const subTree = new SubTree({
        id: "sg1",
        name: "Halt Group",
        treeId: "halt-tree",
      });

      await subTree.tick(context);
      expect(subTree.status()).toBe(NodeStatus.RUNNING);
      expect(subTree.clonedTree?.status()).toBe(NodeStatus.RUNNING);

      subTree.halt();
      expect(subTree.status()).toBe(NodeStatus.IDLE);
      expect(subTree.clonedTree?.status()).toBe(NodeStatus.IDLE);
    });
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

    it("should allow cloned subTree to lazy-load its own tree", async () => {
      const tree = new SuccessNode({ id: "tree" });
      registerTree("clone-tree", tree);

      const original = new SubTree({
        id: "sg1",
        name: "Original",
        treeId: "clone-tree",
      });

      // Tick original to trigger lazy loading
      await original.tick(context);
      expect(original.clonedTree).toBeDefined();

      // Clone should not have a cached tree yet
      const cloned = original.clone() as SubTree;
      expect(cloned.clonedTree).toBeUndefined();

      // Tick clone to trigger its own lazy loading
      await cloned.tick(context);
      expect(cloned.clonedTree).toBeDefined();

      // Should be different instances
      expect(cloned.clonedTree).not.toBe(original.clonedTree);
    });
  });
});
