/**
 * Integration tests for schema validation with Registry
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Registry } from "../registry.js";
import { Timeout } from "../decorators/timeout.js";
import { Delay } from "../decorators/delay.js";
import { Parallel } from "../composites/parallel.js";
import { Sequence } from "../composites/sequence.js";
import { ConfigurationError } from "../errors.js";

describe("Schema Validation Integration", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    registry.register("Timeout", Timeout, { category: "decorator" });
    registry.register("Delay", Delay, { category: "decorator" });
    registry.register("Parallel", Parallel, { category: "composite" });
    registry.register("Sequence", Sequence, { category: "composite" });
  });

  describe("Timeout validation", () => {
    it("should accept valid timeoutMs", () => {
      const node = registry.create("Timeout", {
        id: "test",
        timeoutMs: 1000,
      });

      expect(node).toBeInstanceOf(Timeout);
    });

    it("should reject negative timeoutMs", () => {
      expect(() => {
        registry.create("Timeout", {
          id: "test",
          timeoutMs: -100,
        });
      }).toThrow(ConfigurationError);
    });

    it("should reject zero timeoutMs", () => {
      expect(() => {
        registry.create("Timeout", {
          id: "test",
          timeoutMs: 0,
        });
      }).toThrow(ConfigurationError);
    });

    it("should provide helpful error message", () => {
      try {
        registry.create("Timeout", {
          id: "test-timeout",
          timeoutMs: -100,
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        const message = (error as ConfigurationError).message;
        expect(message).toContain("Timeout:test-timeout");
        expect(message).toContain("timeoutMs");
        expect(message).toContain("positive");
      }
    });
  });

  describe("Delay validation", () => {
    it("should accept positive delayMs", () => {
      const node = registry.create("Delay", {
        id: "test",
        delayMs: 500,
      });

      expect(node).toBeInstanceOf(Delay);
    });

    it("should accept zero delayMs", () => {
      const node = registry.create("Delay", {
        id: "test",
        delayMs: 0,
      });

      expect(node).toBeInstanceOf(Delay);
    });

    it("should reject negative delayMs", () => {
      expect(() => {
        registry.create("Delay", {
          id: "test",
          delayMs: -100,
        });
      }).toThrow(ConfigurationError);
    });
  });

  describe("Parallel validation", () => {
    it("should accept valid strategy", () => {
      const node = registry.create("Parallel", {
        id: "test",
        strategy: "strict",
      });

      expect(node).toBeInstanceOf(Parallel);
    });

    it("should accept 'any' strategy", () => {
      const node = registry.create("Parallel", {
        id: "test",
        strategy: "any",
      });

      expect(node).toBeInstanceOf(Parallel);
    });

    it("should use default strategy if not provided", () => {
      const node = registry.create("Parallel", {
        id: "test",
      });

      expect(node).toBeInstanceOf(Parallel);
    });

    it("should reject invalid strategy", () => {
      expect(() => {
        registry.create("Parallel", {
          id: "test",
          strategy: "invalid" as never,
        });
      }).toThrow(ConfigurationError);
    });

    it("should accept positive thresholds", () => {
      const node = registry.create("Parallel", {
        id: "test",
        successThreshold: 2,
        failureThreshold: 1,
      });

      expect(node).toBeInstanceOf(Parallel);
    });
  });

  describe("Tree creation validation", () => {
    it("should validate entire tree structure", () => {
      const definition = {
        type: "Sequence",
        id: "root",
        children: [
          {
            type: "Timeout",
            id: "timeout1",
            props: {
              timeoutMs: 1000,
            },
            children: [
              {
                type: "Delay",
                id: "delay1",
                props: {
                  delayMs: 500,
                },
              },
            ],
          },
        ],
      };

      const tree = registry.createTree(definition);
      expect(tree).toBeInstanceOf(Sequence);
    });

    it("should catch validation errors in nested nodes", () => {
      const definition = {
        type: "Sequence",
        id: "root",
        children: [
          {
            type: "Timeout",
            id: "timeout1",
            props: {
              timeoutMs: -100, // Invalid!
            },
          },
        ],
      };

      expect(() => {
        registry.createTree(definition);
      }).toThrow(ConfigurationError);
    });

    it("should validate tree structure schema", () => {
      const definition = {
        id: "missing-type",
      };

      expect(() => {
        registry.createTree(definition);
      }).toThrow(/type/);
    });
  });

  describe("safeCreateTree", () => {
    it("should return success for valid tree", () => {
      const definition = {
        type: "Sequence",
        id: "root",
      };

      const result = registry.safeCreateTree(definition);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tree).toBeInstanceOf(Sequence);
      }
    });

    it("should return error for invalid tree", () => {
      const definition = {
        type: "Timeout",
        id: "invalid",
        props: {
          timeoutMs: -100,
        },
      };

      const result = registry.safeCreateTree(definition);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toContain("timeoutMs");
      }
    });
  });
});
