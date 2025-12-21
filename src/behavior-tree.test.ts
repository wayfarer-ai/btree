/**
 * Tests for BehaviorTree with path-based indexing
 */

import { describe, expect, it } from "vitest";
import { BehaviorTree } from "./behavior-tree.js";
import { ScopedBlackboard } from "./blackboard.js";
import { Selector } from "./composites/selector.js";
import { Sequence } from "./composites/sequence.js";
import { ActionNode, type NodeConfiguration } from "./index.js";
import { Registry } from "./registry.js";
import { FailureNode, SuccessNode } from "./test-nodes.js";
import { type TemporalContext, NodeStatus } from "./types.js";

// Simple print action for testing
class PrintAction extends ActionNode {
  private message: string;

  constructor(config: NodeConfiguration & { message: string }) {
    super(config);
    this.message = config.message;
  }

  async executeTick(_context: TemporalContext): Promise<NodeStatus> {
    this.log(`Message: ${this.message}`);
    this._status = NodeStatus.SUCCESS;
    return NodeStatus.SUCCESS;
  }
}

describe("BehaviorTree", () => {
  describe("Construction and Path-based Indexing", () => {
    it("should index simple tree with paths", () => {
      const seq = new Sequence({ id: "seq" });
      const a1 = new PrintAction({ id: "a1", message: "First" });
      const a2 = new PrintAction({ id: "a2", message: "Second" });
      const a3 = new PrintAction({ id: "a3", message: "Third" });
      seq.addChildren([a1, a2, a3]);

      const tree = new BehaviorTree(seq);

      // Root at /
      expect(tree.findNodeByPath("/")).toBe(seq);

      // Children at /0, /1, /2
      expect(tree.findNodeByPath("/0")).toBe(a1);
      expect(tree.findNodeByPath("/1")).toBe(a2);
      expect(tree.findNodeByPath("/2")).toBe(a3);
    });

    it("should index nested tree structure", () => {
      const root = new Sequence({ id: "root" });
      const step = new Sequence({ id: "step", name: "step" });
      const innerSeq = new Sequence({ id: "inner" });
      const action = new PrintAction({ id: "action", message: "Deep" });

      innerSeq.addChild(action);
      step.addChild(innerSeq);
      root.addChild(step);

      const tree = new BehaviorTree(root);

      expect(tree.findNodeByPath("/")).toBe(root); // root
      expect(tree.findNodeByPath("/0")).toBe(step); // root → step
      expect(tree.findNodeByPath("/0/0")).toBe(innerSeq); // root → step → seq
      expect(tree.findNodeByPath("/0/0/0")).toBe(action); // root → step → seq → action
    });

    it("should return root node", () => {
      const seq = new Sequence({ id: "seq" });
      const tree = new BehaviorTree(seq);

      expect(tree.getRoot()).toBe(seq);
    });

    it("should handle empty tree (single root node)", () => {
      const root = new Sequence({ id: "root" });
      const tree = new BehaviorTree(root);

      expect(tree.findNodeByPath("/")).toBe(root);
      expect(tree.findNodeByPath("/0")).toBeNull();
    });
  });

  describe("Node Lookup by Path", () => {
    it("should find nodes by path", () => {
      const root = new Sequence({ id: "root" });
      const child1 = new PrintAction({ id: "c1", message: "Child 1" });
      const child2 = new PrintAction({ id: "c2", message: "Child 2" });
      root.addChildren([child1, child2]);

      const tree = new BehaviorTree(root);

      expect(tree.findNodeByPath("/")).toBe(root);
      expect(tree.findNodeByPath("/0")).toBe(child1);
      expect(tree.findNodeByPath("/1")).toBe(child2);
    });

    it("should return null for non-existent path", () => {
      const root = new Sequence({ id: "root" });
      const tree = new BehaviorTree(root);

      expect(tree.findNodeByPath("/0")).toBeNull();
      expect(tree.findNodeByPath("/99")).toBeNull();
      expect(tree.findNodeByPath("/invalid")).toBeNull();
    });
  });

  describe("Node Lookup by ID", () => {
    it("should allow lookup by ID when IDs are present", () => {
      const seq = new Sequence({ id: "my-seq" });
      const action = new PrintAction({ id: "my-action", message: "Test" });
      seq.addChild(action);

      const tree = new BehaviorTree(seq);

      expect(tree.findNodeById("my-seq")).toBe(seq);
      expect(tree.findNodeById("my-action")).toBe(action);
      expect(tree.findNodeById("nonexistent")).toBeNull();
    });

    it("should handle nodes without IDs", () => {
      const seq = new Sequence({ id: "seq" });
      const action1 = new PrintAction({ id: "a1", message: "Test 1" });
      const action2 = new PrintAction({ id: "a2", message: "Test 2" });
      seq.addChildren([action1, action2]);

      const tree = new BehaviorTree(seq);

      // Can still find by path even without IDs
      expect(tree.findNodeByPath("/0")).toBe(action1);
      expect(tree.findNodeByPath("/1")).toBe(action2);
    });
  });

  describe("getNodePath", () => {
    it("should return correct path for a node", () => {
      const root = new Sequence({ id: "root" });
      const step = new Sequence({ id: "step", name: "step" });
      const action = new PrintAction({ id: "action", message: "Test" });

      step.addChild(action);
      root.addChild(step);

      const tree = new BehaviorTree(root);

      expect(tree.getNodePath(root)).toBe("/");
      expect(tree.getNodePath(step)).toBe("/0");
      expect(tree.getNodePath(action)).toBe("/0/0");
    });

    it("should return null for node not in tree", () => {
      const root = new Sequence({ id: "root" });
      const tree = new BehaviorTree(root);

      const orphan = new PrintAction({ id: "orphan", message: "Not in tree" });
      expect(tree.getNodePath(orphan)).toBeNull();
    });
  });

  describe("getNodePathById", () => {
    it("should return path by node ID", () => {
      const root = new Sequence({ id: "root" });
      const step = new Sequence({ id: "step-1", name: "step" });
      const action = new PrintAction({ id: "action-1", message: "Test" });

      step.addChild(action);
      root.addChild(step);

      const tree = new BehaviorTree(root);

      expect(tree.getNodePathById("root")).toBe("/");
      expect(tree.getNodePathById("step-1")).toBe("/0");
      expect(tree.getNodePathById("action-1")).toBe("/0/0");
    });

    it("should return null for nonexistent node ID", () => {
      const root = new Sequence({ id: "root" });
      const tree = new BehaviorTree(root);

      expect(tree.getNodePathById("nonexistent")).toBeNull();
    });

    it("should handle multiple children with nested structure", () => {
      const root = new Sequence({ id: "root" });
      const child1 = new PrintAction({ id: "child-1", message: "First" });
      const child2 = new Sequence({ id: "child-2" });
      const grandchild = new PrintAction({
        id: "grandchild",
        message: "Nested",
      });

      child2.addChild(grandchild);
      root.addChildren([child1, child2]);

      const tree = new BehaviorTree(root);

      expect(tree.getNodePathById("root")).toBe("/");
      expect(tree.getNodePathById("child-1")).toBe("/0");
      expect(tree.getNodePathById("child-2")).toBe("/1");
      expect(tree.getNodePathById("grandchild")).toBe("/1/0");
    });
  });

  describe("replaceNodeAtPath - Basic Cases", () => {
    it("should replace node at path even without ID", () => {
      const seq = new Sequence({ id: "seq" });
      const a1 = new PrintAction({ id: "a1", message: "First" });
      const a2 = new PrintAction({ id: "a2", message: "Second" });
      seq.addChildren([a1, a2]);

      const tree = new BehaviorTree(seq);

      // Replace middle node using path
      const newAction = new PrintAction({ id: "new", message: "Replaced" });
      tree.replaceNodeAtPath("/1", newAction);

      // Verify replacement
      expect(tree.findNodeByPath("/1")).toBe(newAction);
      expect(seq.children?.[1]).toBe(newAction);
      expect(newAction.parent).toBe(seq);
    });

    it("should preserve sibling nodes when replacing", () => {
      const seq = new Sequence({ id: "seq" });
      const a1 = new PrintAction({ id: "a1", message: "First" });
      const a2 = new PrintAction({ id: "a2", message: "Second" });
      const a3 = new PrintAction({ id: "a3", message: "Third" });
      seq.addChildren([a1, a2, a3]);

      const tree = new BehaviorTree(seq);

      // Replace middle node
      const newAction = new PrintAction({ id: "new", message: "New" });
      tree.replaceNodeAtPath("/1", newAction);

      // Siblings unchanged
      expect(tree.findNodeByPath("/0")).toBe(a1);
      expect(tree.findNodeByPath("/2")).toBe(a3);
      expect(seq.children?.length).toBe(3);
    });

    it("should replace composite and reindex new children", () => {
      const root = new Sequence({ id: "root" });
      const step1 = new Sequence({ id: "step1", name: "step1" });
      const step2 = new Sequence({ id: "step2", name: "step2" });

      step1.addChild(new PrintAction({ id: "old-action", message: "Old" }));
      step2.addChild(new PrintAction({ id: "other-action", message: "Other" }));
      root.addChildren([step1, step2]);

      const tree = new BehaviorTree(root);

      // Replace step1 with new step
      const newStep = new Sequence({ id: "step1-new", name: "step1-new" });
      newStep.addChild(new PrintAction({ id: "new-action", message: "New" }));
      tree.replaceNodeAtPath("/0", newStep);

      // New children indexed
      expect(tree.findNodeByPath("/0/0")?.id).toBe("new-action");
      expect(tree.findNodeById("new-action")).toBeDefined();

      // Old children gone
      expect(tree.findNodeById("old-action")).toBeNull();

      // Sibling preserved
      expect(tree.findNodeByPath("/1")).toBe(step2);
      expect(tree.findNodeById("other-action")).toBeDefined();
    });

    it("should handle root replacement", () => {
      const oldRoot = new Sequence({ id: "old-root" });
      oldRoot.addChild(new PrintAction({ id: "child", message: "Test" }));

      const tree = new BehaviorTree(oldRoot);

      const newRoot = new Selector({ id: "new-root" });
      newRoot.addChild(new PrintAction({ id: "new-child", message: "New" }));

      tree.replaceNodeAtPath("/", newRoot);

      expect(tree.getRoot()).toBe(newRoot);
      expect(tree.findNodeByPath("/")).toBe(newRoot);
      expect(tree.findNodeByPath("/0")?.id).toBe("new-child");
      expect(newRoot.parent).toBeUndefined();
    });

    it("should replace leaf node in deeply nested tree", () => {
      const root = new Sequence({ id: "root" });
      const step1 = new Sequence({ id: "step1", name: "step1" });
      const step2 = new Sequence({ id: "step2", name: "step2" });
      const innerSeq = new Sequence({ id: "inner" });
      const action = new PrintAction({ id: "deep-action", message: "Deep" });

      innerSeq.addChild(action);
      step2.addChild(innerSeq);
      root.addChildren([step1, step2]);

      const tree = new BehaviorTree(root);

      // Replace deeply nested action
      const newAction = new PrintAction({
        id: "new-deep",
        message: "New Deep",
      });
      tree.replaceNodeAtPath("/1/0/0", newAction);

      expect(tree.findNodeByPath("/1/0/0")).toBe(newAction);
      expect(tree.findNodeById("new-deep")).toBe(newAction);
      expect(tree.findNodeById("deep-action")).toBeNull();
    });
  });

  describe("replaceNodeAtPath - Edge Cases", () => {
    it("should throw error for invalid path", () => {
      const tree = new BehaviorTree(new Sequence({ id: "root" }));

      expect(() => {
        tree.replaceNodeAtPath(
          "/99",
          new PrintAction({ id: "test", message: "Test" }),
        );
      }).toThrow("Node not found at path");
    });

    it("should throw error when trying to replace non-existent node", () => {
      const root = new Sequence({ id: "root" });
      root.addChild(new PrintAction({ id: "c1", message: "Child" }));
      const tree = new BehaviorTree(root);

      expect(() => {
        tree.replaceNodeAtPath(
          "/5",
          new PrintAction({ id: "test", message: "Test" }),
        );
      }).toThrow("Node not found at path");
    });
  });

  describe("Multiple Replacements", () => {
    it("should handle multiple sequential replacements", () => {
      const seq = new Sequence({ id: "seq" });
      const a1 = new PrintAction({ id: "a1", message: "First" });
      const a2 = new PrintAction({ id: "a2", message: "Second" });
      const a3 = new PrintAction({ id: "a3", message: "Third" });
      seq.addChildren([a1, a2, a3]);

      const tree = new BehaviorTree(seq);

      // First replacement
      tree.replaceNodeAtPath(
        "/0",
        new PrintAction({ id: "new1", message: "New First" }),
      );
      expect(tree.findNodeById("new1")).toBeDefined();
      expect(tree.findNodeById("a1")).toBeNull();

      // Second replacement
      tree.replaceNodeAtPath(
        "/2",
        new PrintAction({ id: "new3", message: "New Third" }),
      );
      expect(tree.findNodeById("new3")).toBeDefined();
      expect(tree.findNodeById("a3")).toBeNull();

      // Middle node unchanged
      expect(tree.findNodeByPath("/1")).toBe(a2);
    });
  });

  describe("parsePathWithTreeId", () => {
    it("should parse path with tree ID prefix (#TreeID/path)", () => {
      const result = BehaviorTree.parsePathWithTreeId("#SimpleTest/0/1");

      expect(result.treeId).toBe("SimpleTest");
      expect(result.nodePath).toBe("/0/1");
    });

    it("should parse path with tree ID and root path", () => {
      const result = BehaviorTree.parsePathWithTreeId("#MyTree/");

      expect(result.treeId).toBe("MyTree");
      expect(result.nodePath).toBe("/");
    });

    it("should parse path with tree ID only (no slash)", () => {
      const result = BehaviorTree.parsePathWithTreeId("#OnlyTreeId");

      expect(result.treeId).toBe("OnlyTreeId");
      expect(result.nodePath).toBe("/");
    });

    it("should throw error for path without tree ID prefix", () => {
      expect(() => BehaviorTree.parsePathWithTreeId("/0/1/2")).toThrow(
        "Invalid path format",
      );
    });

    it("should throw error for empty tree ID (#/0/1)", () => {
      expect(() => BehaviorTree.parsePathWithTreeId("#/0/1")).toThrow(
        "tree ID cannot be empty",
      );
    });

    it("should throw error for # alone", () => {
      expect(() => BehaviorTree.parsePathWithTreeId("#")).toThrow(
        "tree ID cannot be empty",
      );
    });

    it("should throw error for whitespace-only tree ID", () => {
      expect(() => BehaviorTree.parsePathWithTreeId("#   /0")).toThrow(
        "tree ID cannot be empty",
      );
    });

    it("should handle tree ID with special characters", () => {
      const result = BehaviorTree.parsePathWithTreeId("#My_Tree-123/0");

      expect(result.treeId).toBe("My_Tree-123");
      expect(result.nodePath).toBe("/0");
    });

    it("should handle deeply nested paths", () => {
      const result = BehaviorTree.parsePathWithTreeId("#Root/0/1/2/3/4");

      expect(result.treeId).toBe("Root");
      expect(result.nodePath).toBe("/0/1/2/3/4");
    });
  });
});
