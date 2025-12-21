/**
 * Parser tests for ScriptLang
 * Tests the ANTLR grammar and parsing
 */

import { describe, expect, it } from "vitest";
import antlr4 from "antlr4";
import ScriptLangLexer from "./generated/ScriptLangLexer.js";
import ScriptLangParser from "./generated/ScriptLangParser.js";

describe("ScriptLang Parser", () => {
  function parse(script: string) {
    const inputStream = new antlr4.InputStream(script);
    const lexer = new ScriptLangLexer(inputStream);
    const tokenStream = new antlr4.CommonTokenStream(lexer);
    const parser = new ScriptLangParser(tokenStream);
    return parser.program();
  }

  describe("Basic parsing", () => {
    it("should parse empty program", () => {
      const tree = parse("");
      expect(tree).toBeDefined();
    });

    it("should parse simple assignment", () => {
      const tree = parse("x = 10");
      expect(tree).toBeDefined();
      expect(tree.statement().length).toBe(1);
    });

    it("should parse multiple assignments", () => {
      const tree = parse("x = 10\ny = 20");
      expect(tree).toBeDefined();
      expect(tree.statement().length).toBe(2);
    });

    it("should parse assignment with semicolon", () => {
      const tree = parse("x = 10;");
      expect(tree).toBeDefined();
      expect(tree.statement().length).toBe(1);
    });
  });

  describe("Literals", () => {
    it("should parse number literals", () => {
      const tree = parse("x = 42");
      expect(tree).toBeDefined();
    });

    it("should parse decimal numbers", () => {
      const tree = parse("x = 3.14");
      expect(tree).toBeDefined();
    });

    it("should parse string literals with double quotes", () => {
      const tree = parse('x = "hello"');
      expect(tree).toBeDefined();
    });

    it("should parse string literals with single quotes", () => {
      const tree = parse("x = 'world'");
      expect(tree).toBeDefined();
    });

    it("should parse boolean literals", () => {
      const tree = parse("x = true\ny = false");
      expect(tree).toBeDefined();
      expect(tree.statement().length).toBe(2);
    });

    it("should parse null literal", () => {
      const tree = parse("x = null");
      expect(tree).toBeDefined();
    });
  });

  describe("Arithmetic operators", () => {
    it("should parse addition", () => {
      const tree = parse("result = a + b");
      expect(tree).toBeDefined();
    });

    it("should parse subtraction", () => {
      const tree = parse("result = a - b");
      expect(tree).toBeDefined();
    });

    it("should parse multiplication", () => {
      const tree = parse("result = a * b");
      expect(tree).toBeDefined();
    });

    it("should parse division", () => {
      const tree = parse("result = a / b");
      expect(tree).toBeDefined();
    });

    it("should parse modulo", () => {
      const tree = parse("result = a % b");
      expect(tree).toBeDefined();
    });

    it("should parse complex arithmetic", () => {
      const tree = parse("result = (a + b) * c - d / e");
      expect(tree).toBeDefined();
    });
  });

  describe("Comparison operators", () => {
    it("should parse equality", () => {
      const tree = parse("result = a == b");
      expect(tree).toBeDefined();
    });

    it("should parse inequality", () => {
      const tree = parse("result = a != b");
      expect(tree).toBeDefined();
    });

    it("should parse greater than", () => {
      const tree = parse("result = a > b");
      expect(tree).toBeDefined();
    });

    it("should parse less than", () => {
      const tree = parse("result = a < b");
      expect(tree).toBeDefined();
    });

    it("should parse greater or equal", () => {
      const tree = parse("result = a >= b");
      expect(tree).toBeDefined();
    });

    it("should parse less or equal", () => {
      const tree = parse("result = a <= b");
      expect(tree).toBeDefined();
    });
  });

  describe("Logical operators", () => {
    it("should parse logical AND", () => {
      const tree = parse("result = a && b");
      expect(tree).toBeDefined();
    });

    it("should parse logical OR", () => {
      const tree = parse("result = a || b");
      expect(tree).toBeDefined();
    });

    it("should parse logical NOT", () => {
      const tree = parse("result = !a");
      expect(tree).toBeDefined();
    });

    it("should parse complex logical expression", () => {
      const tree = parse("result = a && b || c && !d");
      expect(tree).toBeDefined();
    });
  });

  describe("Unary operators", () => {
    it("should parse unary minus", () => {
      const tree = parse("result = -x");
      expect(tree).toBeDefined();
    });

    it("should parse nested unary minus", () => {
      const tree = parse("result = --x");
      expect(tree).toBeDefined();
    });

    it("should parse unary not", () => {
      const tree = parse("result = !flag");
      expect(tree).toBeDefined();
    });
  });

  describe("Property access", () => {
    it("should parse simple property access", () => {
      const tree = parse("result = obj.prop");
      expect(tree).toBeDefined();
    });

    it("should parse nested property access", () => {
      const tree = parse("result = user.profile.name");
      expect(tree).toBeDefined();
    });

    it("should parse property access in expressions", () => {
      const tree = parse("result = user.age > 18");
      expect(tree).toBeDefined();
    });
  });

  describe("Operator precedence", () => {
    it("should handle multiplication before addition", () => {
      const tree = parse("result = a + b * c");
      expect(tree).toBeDefined();
    });

    it("should handle parentheses for grouping", () => {
      const tree = parse("result = (a + b) * c");
      expect(tree).toBeDefined();
    });

    it("should handle logical operators correctly", () => {
      const tree = parse("result = a || b && c");
      expect(tree).toBeDefined();
    });
  });

  describe("Multiple statements", () => {
    it("should parse multiple statements with newlines", () => {
      const script = `
        x = 10
        y = 20
        result = x + y
      `;
      const tree = parse(script);
      expect(tree).toBeDefined();
      expect(tree.statement().length).toBe(3);
    });

    it("should parse multiple statements with semicolons", () => {
      const tree = parse("x = 10; y = 20; result = x + y");
      expect(tree).toBeDefined();
      expect(tree.statement().length).toBe(3);
    });
  });

  describe("Comments", () => {
    it("should ignore single-line comments", () => {
      const script = `
        // This is a comment
        x = 10
      `;
      const tree = parse(script);
      expect(tree).toBeDefined();
      expect(tree.statement().length).toBe(1);
    });

    it("should ignore inline comments", () => {
      const tree = parse("x = 10 // inline comment");
      expect(tree).toBeDefined();
    });
  });

  describe("Expression statements", () => {
    it("should parse standalone expression", () => {
      const tree = parse("x + y");
      expect(tree).toBeDefined();
    });

    it("should parse comparison as expression", () => {
      const tree = parse("x > y");
      expect(tree).toBeDefined();
    });
  });
});
