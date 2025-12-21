import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "./blackboard.js";

describe("ScopedBlackboard", () => {
  let blackboard: ScopedBlackboard;

  beforeEach(() => {
    blackboard = new ScopedBlackboard();
  });

  describe("Basic operations", () => {
    it("should store and retrieve values", () => {
      blackboard.set("key1", "value1");
      blackboard.set("key2", 42);

      expect(blackboard.get("key1")).toBe("value1");
      expect(blackboard.get("key2")).toBe(42);
    });

    it("should return undefined for non-existent keys", () => {
      expect(blackboard.get("nonexistent")).toBeUndefined();
    });

    it("should check if key exists", () => {
      blackboard.set("exists", true);

      expect(blackboard.has("exists")).toBe(true);
      expect(blackboard.has("notexists")).toBe(false);
    });

    it("should delete keys", () => {
      blackboard.set("toDelete", "value");
      expect(blackboard.has("toDelete")).toBe(true);

      blackboard.delete("toDelete");
      expect(blackboard.has("toDelete")).toBe(false);
    });

    it("should clear all entries", () => {
      blackboard.set("key1", "value1");
      blackboard.set("key2", "value2");

      blackboard.clear();

      expect(blackboard.has("key1")).toBe(false);
      expect(blackboard.has("key2")).toBe(false);
      expect(blackboard.keys()).toHaveLength(0);
    });
  });

  describe("Scoped inheritance", () => {
    it("should create child scopes", () => {
      const child = blackboard.createScope("child");

      expect(child.getScopeName()).toBe("child");
      expect(child.getParentScope()).toBe(blackboard);
    });

    it("should inherit values from parent scope", () => {
      blackboard.set("parentValue", "inherited");

      const child = blackboard.createScope("child");
      expect(child.get("parentValue")).toBe("inherited");
      expect(child.has("parentValue")).toBe(true);
    });

    it("should override parent values in child scope", () => {
      blackboard.set("value", "parent");

      const child = blackboard.createScope("child");
      child.set("value", "child");

      expect(blackboard.get("value")).toBe("parent");
      expect(child.get("value")).toBe("child");
    });

    it("should not affect parent when deleting in child", () => {
      blackboard.set("value", "parent");

      const child = blackboard.createScope("child");
      child.delete("value");

      expect(blackboard.get("value")).toBe("parent");
      expect(child.get("value")).toBe("parent"); // Still inherited
    });

    it("should support multi-level inheritance", () => {
      blackboard.set("level0", "root");

      const child1 = blackboard.createScope("child1");
      child1.set("level1", "child1");

      const child2 = child1.createScope("child2");
      child2.set("level2", "child2");

      expect(child2.get("level0")).toBe("root");
      expect(child2.get("level1")).toBe("child1");
      expect(child2.get("level2")).toBe("child2");

      expect(child2.getFullScopePath()).toBe("root.child1.child2");
    });

    it("should reuse existing child scopes", () => {
      const child1 = blackboard.createScope("child");
      child1.set("value", "test");

      const child2 = blackboard.createScope("child");
      expect(child1).toBe(child2);
      expect(child2.get("value")).toBe("test");
    });
  });

  describe("Port operations", () => {
    it("should get port with default value", () => {
      expect(blackboard.getPort("missing", "default")).toBe("default");

      blackboard.set("exists", "value");
      expect(blackboard.getPort("exists", "default")).toBe("value");
    });

    it("should set port value", () => {
      blackboard.setPort("port", 123);
      expect(blackboard.get("port")).toBe(123);
    });

    it("should handle typed port operations", () => {
      interface Config {
        timeout: number;
        retries: number;
      }

      const config: Config = { timeout: 1000, retries: 3 };
      blackboard.setPort<Config>("config", config);

      const retrieved = blackboard.getPort<Config>("config");
      expect(retrieved).toEqual(config);
    });
  });

  describe("Utility methods", () => {
    it("should return all keys including inherited ones", () => {
      blackboard.set("parent1", "value1");
      blackboard.set("parent2", "value2");

      const child = blackboard.createScope("child");
      child.set("child1", "value3");
      child.set("parent1", "overridden"); // Override parent key

      const keys = child.keys();
      expect(keys).toContain("parent1");
      expect(keys).toContain("parent2");
      expect(keys).toContain("child1");
      expect(keys).toHaveLength(3);
    });

    it("should return entries with local values overriding parent", () => {
      blackboard.set("shared", "parent");
      blackboard.set("parentOnly", "value");

      const child = blackboard.createScope("child");
      child.set("shared", "child");
      child.set("childOnly", "value");

      const entries = child.entries();
      const entriesMap = new Map(entries);

      expect(entriesMap.get("shared")).toBe("child");
      expect(entriesMap.get("parentOnly")).toBe("value");
      expect(entriesMap.get("childOnly")).toBe("value");
      expect(entries).toHaveLength(3);
    });

    it("should convert to JSON with only local entries", () => {
      blackboard.set("parent", "value");

      const child = blackboard.createScope("child");
      child.set("child1", "value1");
      child.set("child2", "value2");

      const json = child.toJSON();
      expect(json).toEqual({
        child1: "value1",
        child2: "value2",
      });
      expect(json).not.toHaveProperty("parent");
    });
  });

  describe("Debug utilities", () => {
    it("should not throw when calling debug", () => {
      blackboard.set("key", "value");
      const child = blackboard.createScope("child");
      child.set("childKey", "childValue");

      // Should not throw
      expect(() => child.debug()).not.toThrow();
    });
  });

  describe("Snapshots", () => {
    it("should create independent snapshots with clone", () => {
      blackboard.set("x", 1);
      const snapshot = blackboard.clone();
      blackboard.set("x", 2);

      expect(snapshot.get("x")).toBe(1);
      expect(blackboard.get("x")).toBe(2);
    });

    it("should deep clone child scopes", () => {
      blackboard.set("parent", "value");
      const child = blackboard.createScope("child");
      child.set("child", "value");

      const snapshot = blackboard.clone();
      blackboard.set("parent", "changed");

      expect(snapshot.get("parent")).toBe("value");
      expect(blackboard.get("parent")).toBe("changed");
    });
  });
});
