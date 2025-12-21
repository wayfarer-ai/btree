/**
 * Script Node tests
 * Tests the Script action node integration with behavior trees
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { Script, type ScriptConfiguration } from "./script-node.js";

describe("Script Node", () => {
  let blackboard: ScopedBlackboard;
  let context: TemporalContext;

  beforeEach(() => {
    blackboard = new ScopedBlackboard();
    context = {
      blackboard,
      timestamp: Date.now(),
      deltaTime: 0,
    };
  });

  describe("Construction and validation", () => {
    it("should create script node with valid script", () => {
      const node = new Script({
        id: "script-1",
        textContent: "x = 10",
      });
      expect(node).toBeDefined();
      expect(node.id).toBe("script-1");
    });

    it("should cache parse tree at construction", () => {
      // Should not throw on construction
      const node = new Script({
        id: "script-1",
        textContent: "x = 10; y = 20",
      });
      expect(node).toBeDefined();
    });
  });

  describe("Script execution", () => {
    it("should execute simple assignment", async () => {
      const node = new Script({
        id: "script-1",
        textContent: "result = 42",
      });

      const status = await node.tick(context);

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("result")).toBe(42);
    });

    it("should execute multiple statements", async () => {
      const node = new Script({
        id: "script-1",
        textContent: `
            x = 10
            y = 20
            sum = x + y
          `,
      });

      const status = await node.tick(context);

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("x")).toBe(10);
      expect(blackboard.get("y")).toBe(20);
      expect(blackboard.get("sum")).toBe(30);
    });

    it("should read from existing blackboard values", async () => {
      blackboard.set("price", 100);
      blackboard.set("quantity", 3);

      const node = new Script({
        id: "script-1",
        textContent: "total = price * quantity",
      });

      const status = await node.tick(context);

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("total")).toBe(300);
    });

    it("should handle string operations", async () => {
      blackboard.set("firstName", "John");
      blackboard.set("lastName", "Doe");

      const node = new Script({
        id: "script-1",
        textContent: 'fullName = firstName + " " + lastName',
      });

      const status = await node.tick(context);

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("fullName")).toBe("John Doe");
    });

    it("should handle comparison operations", async () => {
      blackboard.set("age", 25);

      const node = new Script({
        id: "script-1",
        textContent: "isAdult = age >= 18",
      });

      const status = await node.tick(context);

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("isAdult")).toBe(true);
    });

    it("should handle logical operations", async () => {
      blackboard.set("count", 10);
      blackboard.set("title", "Test");

      const node = new Script({
        id: "script-1",
        textContent: "isValid = count > 0 && title != null",
      });

      const status = await node.tick(context);

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("isValid")).toBe(true);
    });

    it("should handle property access", async () => {
      blackboard.set("user", {
        profile: {
          name: "John Doe",
          age: 30,
        },
      });

      const node = new Script({
        id: "script-1",
        textContent: `
            userName = user.profile.name
            userAge = user.profile.age
          `,
      });

      const status = await node.tick(context);

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("userName")).toBe("John Doe");
      expect(blackboard.get("userAge")).toBe(30);
    });
  });

  describe("Error handling", () => {
    it("should handle undefined property access gracefully", async () => {
      const node = new Script({
        id: "script-1",
        textContent: "result = unknownVar.property", // Undefined property access returns undefined, not error
      });

      const status = await node.tick(context);

      // JavaScript doesn't error on undefined property access, so this succeeds
      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("result")).toBeUndefined();
    });

    it("should handle multiple tick executions", async () => {
      const node = new Script({
        id: "script-1",
        textContent: "counter = counter + 1",
      });

      blackboard.set("counter", 0);

      await node.tick(context);
      expect(blackboard.get("counter")).toBe(1);

      await node.tick(context);
      expect(blackboard.get("counter")).toBe(2);

      await node.tick(context);
      expect(blackboard.get("counter")).toBe(3);
    });
  });

  describe("Real-world scenarios", () => {
    it("should calculate order total with discount", async () => {
      blackboard.set("price", 100);
      blackboard.set("quantity", 5);
      blackboard.set("discountPercent", 10);

      const node = new Script({
        id: "calculate-total",
        textContent:
          "subtotal = price * quantity; discountAmount = subtotal * discountPercent / 100; total = subtotal - discountAmount",
      });

      const status = await node.tick(context);

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("subtotal")).toBe(500);
      expect(blackboard.get("discountAmount")).toBe(50);
      expect(blackboard.get("total")).toBe(450);
    });

    it("should perform form validation", async () => {
      blackboard.set("username", "john_doe");
      blackboard.set("email", "john@example.com");
      blackboard.set("age", 25);
      blackboard.set("termsAccepted", true);

      const node = new Script({
        id: "validate-form",
        textContent: `
            hasUsername = username != null
            hasEmail = email != null
            isAdult = age >= 18
            allValid = hasUsername && hasEmail && isAdult && termsAccepted
          `,
      });

      const status = await node.tick(context);

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("allValid")).toBe(true);
    });

    it("should format display text", async () => {
      blackboard.set("items", { length: 5 });
      blackboard.set("pageTitle", "Shopping Cart");

      const node = new Script({
        id: "format-text",
        textContent: `
            itemCount = items.length
            displayText = pageTitle + " (" + itemCount + " items)"
          `,
      });

      const status = await node.tick(context);

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("displayText")).toBe("Shopping Cart (5 items)");
    });

    it("should store and verify element properties", async () => {
      blackboard.set("elementText", "Welcome");
      blackboard.set("expectedText", "Welcome");
      blackboard.set("elementVisible", true);

      const node = new Script({
        id: "verify-element",
        textContent: `
            textMatches = elementText == expectedText
            isDisplayed = elementVisible == true
            verificationPassed = textMatches && isDisplayed
          `,
      });

      const status = await node.tick(context);

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("verificationPassed")).toBe(true);
    });

    it("should calculate test metrics", async () => {
      blackboard.set("totalTests", 100);
      blackboard.set("passedTests", 85);
      blackboard.set("failedTests", 10);
      blackboard.set("skippedTests", 5);

      const node = new Script({
        id: "calculate-metrics",
        textContent: `
            passRate = passedTests / totalTests * 100
            failRate = failedTests / totalTests * 100
            completedTests = passedTests + failedTests
            completionRate = completedTests / totalTests * 100
          `,
      });

      const status = await node.tick(context);

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("passRate")).toBe(85);
      expect(blackboard.get("failRate")).toBe(10);
      expect(blackboard.get("completionRate")).toBe(95);
    });
  });

  describe("Integration with behavior tree", () => {
    it("should work with node reset", async () => {
      const node = new Script({
        id: "script-1",
        textContent: "value = 100",
      });

      await node.tick(context);
      expect(node.status()).toBe(NodeStatus.SUCCESS);

      node.reset();
      expect(node.status()).toBe(NodeStatus.IDLE);

      // Should be able to execute again after reset
      await node.tick(context);
      expect(node.status()).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("value")).toBe(100);
    });

    it("should work with node halt", async () => {
      const node = new Script({
        id: "script-1",
        textContent: "value = 200",
      });

      await node.tick(context);

      // Scripts execute synchronously and complete immediately
      expect(node.status()).toBe(NodeStatus.SUCCESS);

      node.halt();

      // Halt only resets status to IDLE if node is RUNNING
      // Since script completed with SUCCESS, halt doesn't change status
      expect(node.status()).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("value")).toBe(200);
    });

    it("should work with node clone", async () => {
      const node = new Script({
        id: "script-1",
        textContent: "value = 300",
      });

      const cloned = node.clone() as Script;

      expect(cloned.id).toBe("script-1");
      await cloned.tick(context);
      expect(blackboard.get("value")).toBe(300);
    });
  });

  describe("Comments in scripts", () => {
    it("should handle single-line comments", async () => {
      const node = new Script({
        id: "script-1",
        textContent: `
            // Calculate total
            x = 10
            y = 20
            result = x + y // Add them together
          `,
      });

      const status = await node.tick(context);

      expect(status).toBe(NodeStatus.SUCCESS);
      expect(blackboard.get("result")).toBe(30);
    });
  });

  describe("Syntax Validation", () => {
    it("should reject invalid operators", () => {
      expect(() => {
        new Script({
          id: "test",
          textContent: "x += 10;",
        });
      }).toThrow(/syntax error/i);
    });

    it("should reject increment operators", () => {
      expect(() => {
        new Script({
          id: "test",
          textContent: "x++; y--;",
        });
      }).toThrow(/syntax error/i);
    });

    it("should reject function calls", () => {
      expect(() => {
        new Script({
          id: "test",
          textContent: "result = Math.max(a, b);",
        });
      }).toThrow(/syntax error/i);
    });

    it("should require text content", () => {
      expect(() => {
        new Script({ id: "test" } as unknown as ScriptConfiguration);
      }).toThrow(/requires text content/i);
    });

    it("should accept valid code", () => {
      expect(() => {
        new Script({
          id: "test",
          textContent: "x = 5; y = x + 10; result = y > 10;",
        });
      }).not.toThrow();
    });
  });

  describe("Built-in Functions", () => {
    describe("param() function", () => {
      it("should load test data parameter", async () => {
        const testData = new Map<string, unknown>();
        testData.set("username", "john.doe");
        testData.set("age", 25);

        context.testData = testData;

        const node = new Script({
          id: "load-param",
          textContent: 'username = param("username")',
        });

        const result = await node.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("username")).toBe("john.doe");
      });

      it("should load multiple test data parameters", async () => {
        const testData = new Map<string, unknown>();
        testData.set("username", "john.doe");
        testData.set("password", "secret123");
        testData.set("age", 30);

        context.testData = testData;

        const node = new Script({
          id: "load-multiple",
          textContent: `
              user = param("username")
              pass = param("password")
              userAge = param("age")
            `,
        });

        const result = await node.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("user")).toBe("john.doe");
        expect(blackboard.get("pass")).toBe("secret123");
        expect(blackboard.get("userAge")).toBe(30);
      });

      it("should return undefined for non-existent parameter", async () => {
        const testData = new Map<string, unknown>();
        context.testData = testData;

        const node = new Script({
          id: "missing-param",
          textContent: 'value = param("missing")',
        });

        const result = await node.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("value")).toBeUndefined();
      });

      it("should work when testData is not provided", async () => {
        // No testData in context

        const node = new Script({
          id: "no-testdata",
          textContent: 'value = param("username")',
        });

        const result = await node.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("value")).toBeUndefined();
      });

      it("should throw error if param() called without string argument", async () => {
        const testData = new Map<string, unknown>();
        context.testData = testData;

        const node = new Script({
          id: "invalid-param",
          textContent: "value = param(123)", // Number instead of string
        });

        const result = await node.tick(context);
        expect(result).toBe(NodeStatus.FAILURE);
      });
    });

    describe("env() function", () => {
      it("should load environment variable", async () => {
        process.env.BASE_URL = "https://example.com";
        process.env.API_KEY = "secret-key-123";

        const node = new Script({
          id: "load-env",
          textContent: 'baseUrl = env("BASE_URL")',
        });

        const result = await node.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("baseUrl")).toBe("https://example.com");

        // Cleanup
        delete process.env.BASE_URL;
        delete process.env.API_KEY;
      });

      it("should load multiple environment variables", async () => {
        process.env.BASE_URL = "https://api.example.com";
        process.env.API_KEY = "key123";
        process.env.TIMEOUT = "5000";

        const node = new Script({
          id: "load-multiple-env",
          textContent: `
              baseUrl = env("BASE_URL")
              apiKey = env("API_KEY")
              timeout = env("TIMEOUT")
            `,
        });

        const result = await node.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("baseUrl")).toBe("https://api.example.com");
        expect(blackboard.get("apiKey")).toBe("key123");
        expect(blackboard.get("timeout")).toBe("5000"); // Env vars are strings

        // Cleanup
        delete process.env.BASE_URL;
        delete process.env.API_KEY;
        delete process.env.TIMEOUT;
      });

      it("should return undefined for non-existent environment variable", async () => {
        const node = new Script({
          id: "missing-env",
          textContent: 'value = env("NONEXISTENT_VAR")',
        });

        const result = await node.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("value")).toBeUndefined();
      });

      it("should throw error if env() called without string argument", async () => {
        const node = new Script({
          id: "invalid-env",
          textContent: "value = env(true)", // Boolean instead of string
        });

        const result = await node.tick(context);
        expect(result).toBe(NodeStatus.FAILURE);
      });
    });

    describe("Computed values with built-ins", () => {
      it("should build URL from env and param", async () => {
        process.env.BASE_URL = "https://api.example.com";

        const testData = new Map<string, unknown>();
        testData.set("userId", "123");
        testData.set("postId", "456");
        context.testData = testData;

        const node = new Script({
          id: "build-url",
          textContent: `
              baseUrl = env("BASE_URL")
              userId = param("userId")
              postId = param("postId")
              apiUrl = baseUrl + "/users/" + userId + "/posts/" + postId
            `,
        });

        const result = await node.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("apiUrl")).toBe(
          "https://api.example.com/users/123/posts/456",
        );

        // Cleanup
        delete process.env.BASE_URL;
      });

      it("should perform calculations with param values", async () => {
        const testData = new Map<string, unknown>();
        testData.set("price", 100);
        testData.set("quantity", 3);
        testData.set("discountPercent", 10);
        context.testData = testData;

        const node = new Script({
          id: "calculate",
          textContent: `
              price = param("price")
              quantity = param("quantity")
              discount = param("discountPercent")

              subtotal = price * quantity
              discountAmount = subtotal * discount / 100
              total = subtotal - discountAmount
            `,
        });

        const result = await node.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("subtotal")).toBe(300);
        expect(blackboard.get("discountAmount")).toBe(30);
        expect(blackboard.get("total")).toBe(270);
      });

      it("should use conditionals with param values", async () => {
        const testData = new Map<string, unknown>();
        testData.set("userRole", "admin");
        testData.set("age", 25);
        context.testData = testData;

        const node = new Script({
          id: "conditionals",
          textContent: `
              role = param("userRole")
              age = param("age")

              isAdmin = role == "admin"
              isAdult = age >= 18
              hasAccess = isAdmin && isAdult
            `,
        });

        const result = await node.tick(context);
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("isAdmin")).toBe(true);
        expect(blackboard.get("isAdult")).toBe(true);
        expect(blackboard.get("hasAccess")).toBe(true);
      });
    });

    describe("Error handling for unknown functions", () => {
      it("should fail with unknown function name", async () => {
        const node = new Script({
          id: "unknown-func",
          textContent: 'value = unknownFunction("arg")',
        });

        const result = await node.tick(context);
        expect(result).toBe(NodeStatus.FAILURE);
      });
    });
  });
});
