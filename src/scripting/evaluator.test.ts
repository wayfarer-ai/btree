/**
 * Evaluator tests for ScriptLang
 * Tests script evaluation against blackboard
 */

import { beforeEach, describe, expect, it } from "vitest";
import antlr4 from "antlr4";
import { ScopedBlackboard } from "../blackboard.js";
import type { TemporalContext } from "../types.js";
import { ScriptEvaluator } from "./evaluator.js";
import ScriptLangLexer from "./generated/ScriptLangLexer.js";
import ScriptLangParser from "./generated/ScriptLangParser.js";

describe("ScriptEvaluator", () => {
  let blackboard: ScopedBlackboard;
  let context: TemporalContext;

  beforeEach(() => {
    blackboard = new ScopedBlackboard();
    context = {
      blackboard,
      timestamp: Date.now(),
      deltaTime: 0,
      testData: new Map(),
    };
  });

  function evaluate(script: string) {
    const inputStream = new antlr4.InputStream(script);
    const lexer = new ScriptLangLexer(inputStream);
    const tokenStream = new antlr4.CommonTokenStream(lexer);
    const parser = new ScriptLangParser(tokenStream);
    const tree = parser.program();

    const evaluator = new ScriptEvaluator(context);
    return evaluator.visit(tree);
  }

  describe("Basic assignments", () => {
    it("should assign number to variable", () => {
      evaluate("x = 42");
      expect(blackboard.get("x")).toBe(42);
    });

    it("should assign string to variable", () => {
      evaluate('name = "John"');
      expect(blackboard.get("name")).toBe("John");
    });

    it("should assign boolean to variable", () => {
      evaluate("flag = true");
      expect(blackboard.get("flag")).toBe(true);
    });

    it("should assign null to variable", () => {
      evaluate("value = null");
      expect(blackboard.get("value")).toBe(null);
    });

    it("should handle multiple assignments", () => {
      evaluate("x = 10\ny = 20\nz = 30");
      expect(blackboard.get("x")).toBe(10);
      expect(blackboard.get("y")).toBe(20);
      expect(blackboard.get("z")).toBe(30);
    });
  });

  describe("Arithmetic operations", () => {
    it("should add numbers", () => {
      blackboard.set("a", 10);
      blackboard.set("b", 20);
      evaluate("result = a + b");
      expect(blackboard.get("result")).toBe(30);
    });

    it("should subtract numbers", () => {
      blackboard.set("a", 30);
      blackboard.set("b", 10);
      evaluate("result = a - b");
      expect(blackboard.get("result")).toBe(20);
    });

    it("should multiply numbers", () => {
      blackboard.set("a", 5);
      blackboard.set("b", 6);
      evaluate("result = a * b");
      expect(blackboard.get("result")).toBe(30);
    });

    it("should divide numbers", () => {
      blackboard.set("a", 20);
      blackboard.set("b", 4);
      evaluate("result = a / b");
      expect(blackboard.get("result")).toBe(5);
    });

    it("should calculate modulo", () => {
      blackboard.set("a", 17);
      blackboard.set("b", 5);
      evaluate("result = a % b");
      expect(blackboard.get("result")).toBe(2);
    });

    it("should handle complex arithmetic", () => {
      evaluate("result = (10 + 5) * 2 - 8 / 4");
      expect(blackboard.get("result")).toBe(28);
    });

    it("should handle unary minus", () => {
      blackboard.set("x", 10);
      evaluate("result = -x");
      expect(blackboard.get("result")).toBe(-10);
    });
  });

  describe("String operations", () => {
    it("should concatenate strings", () => {
      blackboard.set("first", "Hello");
      blackboard.set("last", "World");
      evaluate('result = first + " " + last');
      expect(blackboard.get("result")).toBe("Hello World");
    });

    it("should concatenate string with number", () => {
      blackboard.set("name", "User");
      blackboard.set("id", 42);
      evaluate("result = name + id");
      expect(blackboard.get("result")).toBe("User42");
    });

    it("should handle string literals", () => {
      evaluate('greeting = "Hello, " + "World!"');
      expect(blackboard.get("greeting")).toBe("Hello, World!");
    });
  });

  describe("Comparison operators", () => {
    it("should compare equality", () => {
      blackboard.set("a", 10);
      blackboard.set("b", 10);
      evaluate("result = a == b");
      expect(blackboard.get("result")).toBe(true);
    });

    it("should compare inequality", () => {
      blackboard.set("a", 10);
      blackboard.set("b", 20);
      evaluate("result = a != b");
      expect(blackboard.get("result")).toBe(true);
    });

    it("should compare greater than", () => {
      blackboard.set("a", 20);
      blackboard.set("b", 10);
      evaluate("result = a > b");
      expect(blackboard.get("result")).toBe(true);
    });

    it("should compare less than", () => {
      blackboard.set("a", 5);
      blackboard.set("b", 10);
      evaluate("result = a < b");
      expect(blackboard.get("result")).toBe(true);
    });

    it("should compare greater or equal", () => {
      blackboard.set("a", 10);
      blackboard.set("b", 10);
      evaluate("result = a >= b");
      expect(blackboard.get("result")).toBe(true);
    });

    it("should compare less or equal", () => {
      blackboard.set("a", 10);
      blackboard.set("b", 15);
      evaluate("result = a <= b");
      expect(blackboard.get("result")).toBe(true);
    });
  });

  describe("Logical operators", () => {
    it("should evaluate logical AND (true)", () => {
      blackboard.set("a", true);
      blackboard.set("b", true);
      evaluate("result = a && b");
      expect(blackboard.get("result")).toBe(true);
    });

    it("should evaluate logical AND (false)", () => {
      blackboard.set("a", true);
      blackboard.set("b", false);
      evaluate("result = a && b");
      expect(blackboard.get("result")).toBe(false);
    });

    it("should evaluate logical OR (true)", () => {
      blackboard.set("a", true);
      blackboard.set("b", false);
      evaluate("result = a || b");
      expect(blackboard.get("result")).toBe(true);
    });

    it("should evaluate logical OR (false)", () => {
      blackboard.set("a", false);
      blackboard.set("b", false);
      evaluate("result = a || b");
      expect(blackboard.get("result")).toBe(false);
    });

    it("should evaluate logical NOT", () => {
      blackboard.set("flag", false);
      evaluate("result = !flag");
      expect(blackboard.get("result")).toBe(true);
    });

    it("should handle complex logical expressions", () => {
      blackboard.set("count", 10);
      blackboard.set("title", "Test");
      evaluate("result = count > 0 && title != null");
      expect(blackboard.get("result")).toBe(true);
    });

    it("should short-circuit AND evaluation", () => {
      blackboard.set("a", false);
      // b is undefined, but should not be evaluated
      evaluate("result = a && b");
      expect(blackboard.get("result")).toBe(false);
    });

    it("should short-circuit OR evaluation", () => {
      blackboard.set("a", true);
      // b is undefined, but should not be evaluated
      evaluate("result = a || b");
      expect(blackboard.get("result")).toBe(true);
    });
  });

  describe("Property access", () => {
    it("should access object property", () => {
      blackboard.set("user", { name: "John", age: 30 });
      evaluate("result = user.name");
      expect(blackboard.get("result")).toBe("John");
    });

    it("should access nested properties", () => {
      blackboard.set("user", {
        profile: {
          name: "John Doe",
          email: "john@example.com",
        },
      });
      evaluate("result = user.profile.name");
      expect(blackboard.get("result")).toBe("John Doe");
    });

    it("should handle undefined property gracefully", () => {
      blackboard.set("user", { name: "John" });
      evaluate("result = user.missing");
      expect(blackboard.get("result")).toBeUndefined();
    });

    it("should use property in expression", () => {
      blackboard.set("user", { age: 25 });
      evaluate("isAdult = user.age >= 18");
      expect(blackboard.get("isAdult")).toBe(true);
    });
  });

  describe("Complex scenarios", () => {
    it("should calculate total and discount", () => {
      blackboard.set("price", 100);
      blackboard.set("quantity", 3);
      evaluate(`
        total = price * quantity
        discount = total * 0.1
        finalPrice = total - discount
      `);
      expect(blackboard.get("total")).toBe(300);
      expect(blackboard.get("discount")).toBe(30);
      expect(blackboard.get("finalPrice")).toBe(270);
    });

    it("should perform validation logic", () => {
      blackboard.set("username", "john_doe");
      blackboard.set("age", 25);
      blackboard.set("email", "john@example.com");
      evaluate(`
        hasUsername = username != null
        isAdult = age >= 18
        hasEmail = email != null
        isValid = hasUsername && isAdult && hasEmail
      `);
      expect(blackboard.get("isValid")).toBe(true);
    });

    it("should compose string from parts", () => {
      blackboard.set("firstName", "John");
      blackboard.set("lastName", "Doe");
      evaluate(`
        fullName = firstName + " " + lastName
        greeting = "Hello, " + fullName + "!"
      `);
      expect(blackboard.get("fullName")).toBe("John Doe");
      expect(blackboard.get("greeting")).toBe("Hello, John Doe!");
    });
  });

  describe("Type coercion", () => {
    it("should convert string to number in arithmetic", () => {
      blackboard.set("x", "10");
      blackboard.set("y", "20");
      evaluate("result = x + y");
      // Since both are strings, should concatenate
      expect(blackboard.get("result")).toBe("1020");
    });

    it("should handle mixed type arithmetic", () => {
      blackboard.set("x", 10);
      blackboard.set("y", "5");
      evaluate("result = x - y");
      expect(blackboard.get("result")).toBe(5);
    });

    it("should convert to boolean in logical operations", () => {
      blackboard.set("x", 0);
      blackboard.set("y", 1);
      evaluate("result = x || y");
      expect(blackboard.get("result")).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle undefined variables", () => {
      evaluate("result = unknownVar");
      expect(blackboard.get("result")).toBeUndefined();
    });

    it("should handle null in comparisons", () => {
      blackboard.set("value", null);
      evaluate("result = value == null");
      expect(blackboard.get("result")).toBe(true);
    });

    it("should handle division by zero", () => {
      evaluate("result = 10 / 0");
      expect(blackboard.get("result")).toBe(Infinity);
    });

    it("should handle empty string", () => {
      evaluate('text = ""');
      expect(blackboard.get("text")).toBe("");
    });
  });
});
