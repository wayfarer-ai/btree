import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ActionNode } from "./base-node.js";
import { BehaviorTree } from "./behavior-tree.js";
import { Sequence } from "./composites/sequence.js";
import { Invert } from "./decorators/invert.js";
import { Registry } from "./registry.js";
import {
  type EffectTickContext,
  type NodeConfiguration,
  NodeStatus,
} from "./types.js";

// Mock node for testing
class TestActionNode extends ActionNode {
  tick(_context: EffectTickContext) {
    return Effect.sync(() => {
      this._status = NodeStatus.SUCCESS;
      return NodeStatus.SUCCESS;
    });
  }
}

describe("Registry", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  describe("Node registration", () => {
    it("should register node types", () => {
      registry.register("TestAction", TestActionNode, {
        category: "action",
        description: "Test action node",
      });

      expect(registry.has("TestAction")).toBe(true);
      expect(registry.getRegisteredTypes()).toContain("TestAction");
    });

    it("should throw error when registering duplicate type", () => {
      registry.register("TestAction", TestActionNode);

      expect(() => {
        registry.register("TestAction", TestActionNode);
      }).toThrow("Node type 'TestAction' is already registered");
    });

    it("should store metadata for registered nodes", () => {
      registry.register("TestAction", TestActionNode, {
        category: "action",
        description: "Test action node",
        ports: [
          { name: "input1", type: "input" },
          { name: "output1", type: "output" },
        ],
      });

      const metadata = registry.getMetadata("TestAction");
      expect(metadata).toBeDefined();
      expect(metadata?.type).toBe("TestAction");
      expect(metadata?.category).toBe("action");
      expect(metadata?.description).toBe("Test action node");
      expect(metadata?.ports).toHaveLength(2);
    });

    it("should use default metadata values", () => {
      registry.register("TestAction", TestActionNode);

      const metadata = registry.getMetadata("TestAction");
      expect(metadata?.category).toBe("action");
      expect(metadata?.ports).toEqual([]);
    });
  });

  describe("Node creation", () => {
    beforeEach(() => {
      registry.register("TestAction", TestActionNode);
    });

    it("should create nodes by type", () => {
      const config: NodeConfiguration = {
        id: "test-node",
        name: "Test Node",
      };

      const node = registry.create("TestAction", config);

      expect(node).toBeInstanceOf(TestActionNode);
      expect(node.id).toBe("test-node");
      expect(node.name).toBe("Test Node");
      expect(node.type).toBe("TestActionNode");
    });

    it("should throw error for unknown node type", () => {
      expect(() => {
        registry.create("UnknownType", { id: "test" });
      }).toThrow(/Unknown node type: 'UnknownType'/);
    });

    it("should list available types in error message", () => {
      registry.register("Type1", TestActionNode);
      registry.register("Type2", TestActionNode);

      try {
        registry.create("UnknownType", { id: "test" });
      } catch (error: unknown) {
        expect(error.message).toContain("Type1");
        expect(error.message).toContain("Type2");
      }
    });
  });

  describe("Type queries", () => {
    beforeEach(() => {
      registry.register("Action1", TestActionNode, { category: "action" });
      registry.register("Action2", TestActionNode, { category: "action" });
      registry.register("Sequence", Sequence, { category: "composite" });
      registry.register("Invert", Invert, { category: "decorator" });
    });

    it("should get types by category", () => {
      const actions = registry.getTypesByCategory("action");
      expect(actions).toEqual(["Action1", "Action2"]);

      const composites = registry.getTypesByCategory("composite");
      expect(composites).toEqual(["Sequence"]);

      const decorators = registry.getTypesByCategory("decorator");
      expect(decorators).toEqual(["Invert"]);
    });

    it("should return empty array for unknown category", () => {
      const types = registry.getTypesByCategory("unknown" as unknown);
      expect(types).toEqual([]);
    });

    it("should clear all registrations", () => {
      expect(registry.getRegisteredTypes()).toHaveLength(4);

      registry.clear();

      expect(registry.getRegisteredTypes()).toHaveLength(0);
      expect(registry.has("Action1")).toBe(false);
    });
  });

  describe("Tree creation from JSON", () => {
    beforeEach(() => {
      registry.register("TestAction", TestActionNode);
      registry.register("Sequence", Sequence);
      registry.register("Invert", Invert);
    });

    it("should create single node from definition", () => {
      const definition = {
        type: "TestAction",
        id: "action1",
        name: "Test Action",
        props: {
          customProp: "value",
        },
      };

      const node = registry.createTree(definition);

      expect(node).toBeInstanceOf(TestActionNode);
      expect(node.id).toBe("action1");
      expect(node.name).toBe("Test Action");
      expect((node as unknown).config.customProp).toBe("value");
    });

    it("should throw error if type is missing", () => {
      const definition = {
        id: "node1",
      };

      expect(() => {
        registry.createTree(definition);
      }).toThrow("Node definition must have a type");
    });

    it("should generate id if not provided", () => {
      const definition = {
        type: "TestAction",
      };

      const node = registry.createTree(definition);

      expect(node.id).toMatch(/^TestAction_\d+$/);
    });

    it("should create composite with children", () => {
      const definition = {
        type: "Sequence",
        id: "seq1",
        children: [
          { type: "TestAction", id: "child1" },
          { type: "TestAction", id: "child2" },
        ],
      };

      const node = registry.createTree(definition) as Sequence;

      expect(node).toBeInstanceOf(Sequence);
      expect(node.children).toHaveLength(2);
      expect(node.children?.[0]?.id).toBe("child1");
      expect(node.children?.[1]?.id).toBe("child2");
      expect(node.children?.[0]?.parent).toBe(node);
    });

    it("should create decorator with single child", () => {
      const definition = {
        type: "Invert",
        id: "inv1",
        children: [{ type: "TestAction", id: "child1" }],
      };

      const node = registry.createTree(definition) as Invert;

      expect(node).toBeInstanceOf(Invert);
      expect(node.children).toHaveLength(1);
      expect(node.children?.[0]?.id).toBe("child1");
    });

    it("should throw error if decorator has wrong number of children", () => {
      const definition = {
        type: "Invert",
        id: "inv1",
        children: [
          { type: "TestAction", id: "child1" },
          { type: "TestAction", id: "child2" },
        ],
      };

      expect(() => {
        registry.createTree(definition);
      }).toThrow("Decorator Invert must have exactly one child");
    });

    it("should create nested tree structure", () => {
      const definition = {
        type: "Sequence",
        id: "root",
        children: [
          {
            type: "Invert",
            id: "inv1",
            children: [{ type: "TestAction", id: "action1" }],
          },
          { type: "TestAction", id: "action2" },
        ],
      };

      const root = registry.createTree(definition) as Sequence;

      expect(root.children).toHaveLength(2);
      expect(root.children?.[0]).toBeInstanceOf(Invert);
      expect(root.children?.[0]?.children).toHaveLength(1);
      expect(root.children?.[0]?.children?.[0]?.id).toBe("action1");
      expect(root.children?.[1]?.id).toBe("action2");
    });
  });

  describe("Logging", () => {
    it("should log registry operations", () => {
      const consoleSpy = vi.spyOn(console, "log");

      new Registry();
      expect(consoleSpy).toHaveBeenCalledWith("[Registry] Registry created");

      registry.register("TestNode", TestActionNode);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Registered node type: TestNode"),
      );

      registry.create("TestNode", { id: "test" });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Creating node of type: TestNode"),
      );

      registry.clear();
      expect(consoleSpy).toHaveBeenCalledWith(
        "[Registry] Registry cleared (nodes and trees)",
      );
    });
  });
});

describe("Behavior Tree Registration with Metadata", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  it("should register a BehaviorTree with source file", () => {
    const node = new Sequence({ id: "seq1", name: "Test Sequence" });
    const tree = new BehaviorTree(node);
    const sourceFile = "/path/to/test.sigma";

    registry.registerTree("TestTree", tree, sourceFile);

    expect(registry.hasTree("TestTree")).toBe(true);
    expect(registry.getTree("TestTree")).toBe(tree);
  });

  it("should return the source file for a registered tree", () => {
    const node = new Sequence({ id: "seq1", name: "Test Sequence" });
    const tree = new BehaviorTree(node);
    const sourceFile = "/path/to/test.sigma";

    registry.registerTree("TestTree", tree, sourceFile);

    expect(registry.getTreeSourceFile("TestTree")).toBe(sourceFile);
  });

  it("should return undefined for unknown tree source file", () => {
    expect(registry.getTreeSourceFile("UnknownTree")).toBeUndefined();
  });

  it("should get all trees for a specific source file", () => {
    const node1 = new Sequence({ id: "seq1" });
    const tree1 = new BehaviorTree(node1);
    const node2 = new Sequence({ id: "seq2" });
    const tree2 = new BehaviorTree(node2);
    const node3 = new Sequence({ id: "seq3" });
    const tree3 = new BehaviorTree(node3);

    const file1 = "/path/to/file1.sigma";
    const file2 = "/path/to/file2.sigma";

    registry.registerTree("Tree1", tree1, file1);
    registry.registerTree("Tree2", tree2, file1); // Same file as Tree1
    registry.registerTree("Tree3", tree3, file2); // Different file

    const treesInFile1 = registry.getTreesForFile(file1);

    expect(treesInFile1.size).toBe(2);
    expect(treesInFile1.has("Tree1")).toBe(true);
    expect(treesInFile1.has("Tree2")).toBe(true);
    expect(treesInFile1.has("Tree3")).toBe(false);
  });

  it("should return empty map for unknown file", () => {
    const treesInFile = registry.getTreesForFile("/unknown/file.sigma");
    expect(treesInFile.size).toBe(0);
  });

  it("should clone a registered BehaviorTree", () => {
    const node = new Sequence({ id: "seq1", name: "Test Sequence" });
    const tree = new BehaviorTree(node);
    const sourceFile = "/path/to/test.sigma";

    registry.registerTree("TestTree", tree, sourceFile);

    const clonedTree = registry.cloneTree("TestTree");

    expect(clonedTree).toBeInstanceOf(BehaviorTree);
    expect(clonedTree).not.toBe(tree); // Different instance
    expect(clonedTree.getRoot().id).toBe(node.id);
  });

  it("should throw when registering duplicate tree ID", () => {
    const node = new Sequence({ id: "seq1" });
    const tree = new BehaviorTree(node);

    registry.registerTree("TestTree", tree, "/path/to/file.sigma");

    expect(() => {
      registry.registerTree("TestTree", tree, "/path/to/file.sigma");
    }).toThrow("Behavior tree 'TestTree' is already registered");
  });

  it("should throw when cloning unknown tree", () => {
    expect(() => {
      registry.cloneTree("UnknownTree");
    }).toThrow("Behavior tree 'UnknownTree' not found");
  });

  it("should clear all registered trees", () => {
    const node = new Sequence({ id: "seq1" });
    const tree = new BehaviorTree(node);

    registry.registerTree("TestTree", tree, "/path/to/file.sigma");
    expect(registry.hasTree("TestTree")).toBe(true);

    registry.clearTrees();
    expect(registry.hasTree("TestTree")).toBe(false);
    expect(registry.getAllTreeIds()).toHaveLength(0);
  });

  it("should get all registered tree IDs", () => {
    const node1 = new Sequence({ id: "seq1" });
    const tree1 = new BehaviorTree(node1);
    const node2 = new Sequence({ id: "seq2" });
    const tree2 = new BehaviorTree(node2);

    registry.registerTree("Tree1", tree1, "/path/to/file1.sigma");
    registry.registerTree("Tree2", tree2, "/path/to/file2.sigma");

    const allIds = registry.getAllTreeIds();

    expect(allIds).toContain("Tree1");
    expect(allIds).toContain("Tree2");
    expect(allIds).toHaveLength(2);
  });

  it("should unregister a tree and return true", () => {
    const node = new Sequence({ id: "seq1" });
    const tree = new BehaviorTree(node);

    registry.registerTree("TestTree", tree, "/path/to/file.sigma");
    expect(registry.hasTree("TestTree")).toBe(true);

    const result = registry.unregisterTree("TestTree");

    expect(result).toBe(true);
    expect(registry.hasTree("TestTree")).toBe(false);
  });

  it("should return false when unregistering non-existent tree", () => {
    const result = registry.unregisterTree("NonExistent");
    expect(result).toBe(false);
  });

  it("should replace an existing tree", () => {
    const node1 = new Sequence({ id: "seq1" });
    const tree1 = new BehaviorTree(node1);
    const node2 = new Sequence({ id: "seq2" });
    const tree2 = new BehaviorTree(node2);

    registry.registerTree("TestTree", tree1, "/path/to/old.sigma");
    expect(registry.getTree("TestTree")).toBe(tree1);
    expect(registry.getTreeSourceFile("TestTree")).toBe("/path/to/old.sigma");

    registry.replaceTree("TestTree", tree2, "/path/to/new.sigma");

    expect(registry.getTree("TestTree")).toBe(tree2);
    expect(registry.getTreeSourceFile("TestTree")).toBe("/path/to/new.sigma");
  });

  it("should register new tree when replacing non-existent tree", () => {
    const node = new Sequence({ id: "seq1" });
    const tree = new BehaviorTree(node);

    registry.replaceTree("NewTree", tree, "/path/to/file.sigma");

    expect(registry.hasTree("NewTree")).toBe(true);
    expect(registry.getTree("NewTree")).toBe(tree);
  });

  it("should clear trees when calling clear()", () => {
    const node = new Sequence({ id: "seq1" });
    const tree = new BehaviorTree(node);

    registry.register("TestNode", Sequence);
    registry.registerTree("TestTree", tree, "/path/to/file.sigma");

    expect(registry.has("TestNode")).toBe(true);
    expect(registry.hasTree("TestTree")).toBe(true);

    registry.clear();

    expect(registry.has("TestNode")).toBe(false);
    expect(registry.hasTree("TestTree")).toBe(false);
  });
});
