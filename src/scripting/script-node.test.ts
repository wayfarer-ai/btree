/**
 * Script Node tests
 * Tests the Script action node integration with behavior trees
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { Script, type ScriptConfiguration } from "./script-node.js";

describe("Script Node", () => {
  let blackboard: ScopedBlackboard;
  let context: EffectTickContext;

  beforeEach(() => {
    blackboard = new ScopedBlackboard();
    context = {
      blackboard,
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
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
    it.effect("should execute simple assignment", () =>
      Effect.gen(function* (_) {
        const node = new Script({
          id: "script-1",
          textContent: "result = 42",
        });

        const status = yield* _(node.tick(context));

        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("result")).toBe(42);
      }),
    );

    it.effect("should execute multiple statements", () =>
      Effect.gen(function* (_) {
        const node = new Script({
          id: "script-1",
          textContent: `
            x = 10
            y = 20
            sum = x + y
          `,
        });

        const status = yield* _(node.tick(context));

        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("x")).toBe(10);
        expect(blackboard.get("y")).toBe(20);
        expect(blackboard.get("sum")).toBe(30);
      }),
    );

    it.effect("should read from existing blackboard values", () =>
      Effect.gen(function* (_) {
        blackboard.set("price", 100);
        blackboard.set("quantity", 3);

        const node = new Script({
          id: "script-1",
          textContent: "total = price * quantity",
        });

        const status = yield* _(node.tick(context));

        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("total")).toBe(300);
      }),
    );

    it.effect("should handle string operations", () =>
      Effect.gen(function* (_) {
        blackboard.set("firstName", "John");
        blackboard.set("lastName", "Doe");

        const node = new Script({
          id: "script-1",
          textContent: 'fullName = firstName + " " + lastName',
        });

        const status = yield* _(node.tick(context));

        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("fullName")).toBe("John Doe");
      }),
    );

    it.effect("should handle comparison operations", () =>
      Effect.gen(function* (_) {
        blackboard.set("age", 25);

        const node = new Script({
          id: "script-1",
          textContent: "isAdult = age >= 18",
        });

        const status = yield* _(node.tick(context));

        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("isAdult")).toBe(true);
      }),
    );

    it.effect("should handle logical operations", () =>
      Effect.gen(function* (_) {
        blackboard.set("count", 10);
        blackboard.set("title", "Test");

        const node = new Script({
          id: "script-1",
          textContent: "isValid = count > 0 && title != null",
        });

        const status = yield* _(node.tick(context));

        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("isValid")).toBe(true);
      }),
    );

    it.effect("should handle property access", () =>
      Effect.gen(function* (_) {
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

        const status = yield* _(node.tick(context));

        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("userName")).toBe("John Doe");
        expect(blackboard.get("userAge")).toBe(30);
      }),
    );
  });

  describe("Error handling", () => {
    it.effect("should handle undefined property access gracefully", () =>
      Effect.gen(function* (_) {
        const node = new Script({
          id: "script-1",
          textContent: "result = unknownVar.property", // Undefined property access returns undefined, not error
        });

        const status = yield* _(node.tick(context));

        // JavaScript doesn't error on undefined property access, so this succeeds
        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("result")).toBeUndefined();
      }),
    );

    it.effect("should handle multiple tick executions", () =>
      Effect.gen(function* (_) {
        const node = new Script({
          id: "script-1",
          textContent: "counter = counter + 1",
        });

        blackboard.set("counter", 0);

        yield* _(node.tick(context));
        expect(blackboard.get("counter")).toBe(1);

        yield* _(node.tick(context));
        expect(blackboard.get("counter")).toBe(2);

        yield* _(node.tick(context));
        expect(blackboard.get("counter")).toBe(3);
      }),
    );
  });

  describe("Real-world scenarios", () => {
    it.effect("should calculate order total with discount", () =>
      Effect.gen(function* (_) {
        blackboard.set("price", 100);
        blackboard.set("quantity", 5);
        blackboard.set("discountPercent", 10);

        const node = new Script({
          id: "calculate-total",
          textContent:
            "subtotal = price * quantity; discountAmount = subtotal * discountPercent / 100; total = subtotal - discountAmount",
        });

        const status = yield* _(node.tick(context));

        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("subtotal")).toBe(500);
        expect(blackboard.get("discountAmount")).toBe(50);
        expect(blackboard.get("total")).toBe(450);
      }),
    );

    it.effect("should perform form validation", () =>
      Effect.gen(function* (_) {
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

        const status = yield* _(node.tick(context));

        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("allValid")).toBe(true);
      }),
    );

    it.effect("should format display text", () =>
      Effect.gen(function* (_) {
        blackboard.set("items", { length: 5 });
        blackboard.set("pageTitle", "Shopping Cart");

        const node = new Script({
          id: "format-text",
          textContent: `
            itemCount = items.length
            displayText = pageTitle + " (" + itemCount + " items)"
          `,
        });

        const status = yield* _(node.tick(context));

        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("displayText")).toBe("Shopping Cart (5 items)");
      }),
    );

    it.effect("should store and verify element properties", () =>
      Effect.gen(function* (_) {
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

        const status = yield* _(node.tick(context));

        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("verificationPassed")).toBe(true);
      }),
    );

    it.effect("should calculate test metrics", () =>
      Effect.gen(function* (_) {
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

        const status = yield* _(node.tick(context));

        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("passRate")).toBe(85);
        expect(blackboard.get("failRate")).toBe(10);
        expect(blackboard.get("completionRate")).toBe(95);
      }),
    );
  });

  describe("Integration with behavior tree", () => {
    it.effect("should work with node reset", () =>
      Effect.gen(function* (_) {
        const node = new Script({
          id: "script-1",
          textContent: "value = 100",
        });

        yield* _(node.tick(context));
        expect(node.status()).toBe(NodeStatus.SUCCESS);

        node.reset();
        expect(node.status()).toBe(NodeStatus.IDLE);

        // Should be able to execute again after reset
        yield* _(node.tick(context));
        expect(node.status()).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("value")).toBe(100);
      }),
    );

    it.effect("should work with node halt", () =>
      Effect.gen(function* (_) {
        const node = new Script({
          id: "script-1",
          textContent: "value = 200",
        });

        yield* _(node.tick(context));

        // Scripts execute synchronously and complete immediately
        expect(node.status()).toBe(NodeStatus.SUCCESS);

        node.halt();

        // Halt only resets status to IDLE if node is RUNNING
        // Since script completed with SUCCESS, halt doesn't change status
        expect(node.status()).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("value")).toBe(200);
      }),
    );

    it.effect("should work with node clone", () =>
      Effect.gen(function* (_) {
        const node = new Script({
          id: "script-1",
          textContent: "value = 300",
        });

        const cloned = node.clone() as Script;

        expect(cloned.id).toBe("script-1");
        yield* _(cloned.tick(context));
        expect(blackboard.get("value")).toBe(300);
      }),
    );
  });

  describe("Comments in scripts", () => {
    it.effect("should handle single-line comments", () =>
      Effect.gen(function* (_) {
        const node = new Script({
          id: "script-1",
          textContent: `
            // Calculate total
            x = 10
            y = 20
            result = x + y // Add them together
          `,
        });

        const status = yield* _(node.tick(context));

        expect(status).toBe(NodeStatus.SUCCESS);
        expect(blackboard.get("result")).toBe(30);
      }),
    );
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
      it.effect("should load test data parameter", () =>
        Effect.gen(function* (_) {
          const testData = new Map<string, unknown>();
          testData.set("username", "john.doe");
          testData.set("age", 25);

          context.testData = testData;

          const node = new Script({
            id: "load-param",
            textContent: 'username = param("username")',
          });

          const result = yield* _(node.tick(context));
          expect(result).toBe(NodeStatus.SUCCESS);
          expect(blackboard.get("username")).toBe("john.doe");
        }),
      );

      it.effect("should load multiple test data parameters", () =>
        Effect.gen(function* (_) {
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

          const result = yield* _(node.tick(context));
          expect(result).toBe(NodeStatus.SUCCESS);
          expect(blackboard.get("user")).toBe("john.doe");
          expect(blackboard.get("pass")).toBe("secret123");
          expect(blackboard.get("userAge")).toBe(30);
        }),
      );

      it.effect("should return undefined for non-existent parameter", () =>
        Effect.gen(function* (_) {
          const testData = new Map<string, unknown>();
          context.testData = testData;

          const node = new Script({
            id: "missing-param",
            textContent: 'value = param("missing")',
          });

          const result = yield* _(node.tick(context));
          expect(result).toBe(NodeStatus.SUCCESS);
          expect(blackboard.get("value")).toBeUndefined();
        }),
      );

      it.effect("should work when testData is not provided", () =>
        Effect.gen(function* (_) {
          // No testData in context

          const node = new Script({
            id: "no-testdata",
            textContent: 'value = param("username")',
          });

          const result = yield* _(node.tick(context));
          expect(result).toBe(NodeStatus.SUCCESS);
          expect(blackboard.get("value")).toBeUndefined();
        }),
      );

      it.effect(
        "should throw error if param() called without string argument",
        () =>
          Effect.gen(function* (_) {
            const testData = new Map<string, unknown>();
            context.testData = testData;

            const node = new Script({
              id: "invalid-param",
              textContent: "value = param(123)", // Number instead of string
            });

            const result = yield* _(node.tick(context));
            expect(result).toBe(NodeStatus.FAILURE);
          }),
      );
    });

    describe("env() function", () => {
      it.effect("should load environment variable", () =>
        Effect.gen(function* (_) {
          process.env.BASE_URL = "https://example.com";
          process.env.API_KEY = "secret-key-123";

          const node = new Script({
            id: "load-env",
            textContent: 'baseUrl = env("BASE_URL")',
          });

          const result = yield* _(node.tick(context));
          expect(result).toBe(NodeStatus.SUCCESS);
          expect(blackboard.get("baseUrl")).toBe("https://example.com");

          // Cleanup
          delete process.env.BASE_URL;
          delete process.env.API_KEY;
        }),
      );

      it.effect("should load multiple environment variables", () =>
        Effect.gen(function* (_) {
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

          const result = yield* _(node.tick(context));
          expect(result).toBe(NodeStatus.SUCCESS);
          expect(blackboard.get("baseUrl")).toBe("https://api.example.com");
          expect(blackboard.get("apiKey")).toBe("key123");
          expect(blackboard.get("timeout")).toBe("5000"); // Env vars are strings

          // Cleanup
          delete process.env.BASE_URL;
          delete process.env.API_KEY;
          delete process.env.TIMEOUT;
        }),
      );

      it.effect(
        "should return undefined for non-existent environment variable",
        () =>
          Effect.gen(function* (_) {
            const node = new Script({
              id: "missing-env",
              textContent: 'value = env("NONEXISTENT_VAR")',
            });

            const result = yield* _(node.tick(context));
            expect(result).toBe(NodeStatus.SUCCESS);
            expect(blackboard.get("value")).toBeUndefined();
          }),
      );

      it.effect(
        "should throw error if env() called without string argument",
        () =>
          Effect.gen(function* (_) {
            const node = new Script({
              id: "invalid-env",
              textContent: "value = env(true)", // Boolean instead of string
            });

            const result = yield* _(node.tick(context));
            expect(result).toBe(NodeStatus.FAILURE);
          }),
      );
    });

    describe("Computed values with built-ins", () => {
      it.effect("should build URL from env and param", () =>
        Effect.gen(function* (_) {
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

          const result = yield* _(node.tick(context));
          expect(result).toBe(NodeStatus.SUCCESS);
          expect(blackboard.get("apiUrl")).toBe(
            "https://api.example.com/users/123/posts/456",
          );

          // Cleanup
          delete process.env.BASE_URL;
        }),
      );

      it.effect("should perform calculations with param values", () =>
        Effect.gen(function* (_) {
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

          const result = yield* _(node.tick(context));
          expect(result).toBe(NodeStatus.SUCCESS);
          expect(blackboard.get("subtotal")).toBe(300);
          expect(blackboard.get("discountAmount")).toBe(30);
          expect(blackboard.get("total")).toBe(270);
        }),
      );

      it.effect("should use conditionals with param values", () =>
        Effect.gen(function* (_) {
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

          const result = yield* _(node.tick(context));
          expect(result).toBe(NodeStatus.SUCCESS);
          expect(blackboard.get("isAdmin")).toBe(true);
          expect(blackboard.get("isAdult")).toBe(true);
          expect(blackboard.get("hasAccess")).toBe(true);
        }),
      );
    });

    describe("Error handling for unknown functions", () => {
      it.effect("should fail with unknown function name", () =>
        Effect.gen(function* (_) {
          const node = new Script({
            id: "unknown-func",
            textContent: 'value = unknownFunction("arg")',
          });

          const result = yield* _(node.tick(context));
          expect(result).toBe(NodeStatus.FAILURE);
        }),
      );
    });
  });
});
