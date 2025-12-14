/**
 * ScriptLang Evaluator
 * Visitor that evaluates parsed scripts against a blackboard
 */

import type { IScopedBlackboard, TickContext } from "../types.js";
import ScriptLangVisitor from "./generated/ScriptLangVisitor.js";

// ANTLR context type - using any because ANTLR doesn't provide TypeScript types
type AntlrContext = any;

/**
 * Evaluator that extends ANTLR's generated visitor
 * Executes script statements and expressions against the blackboard
 */
export class ScriptEvaluator extends ScriptLangVisitor {
  private lastValue: unknown = null;
  private blackboard: IScopedBlackboard;
  private context: TickContext;

  // Built-in functions registry
  private builtinFunctions: Record<string, (...args: any[]) => unknown> = {
    // Test data operations
    param: (key: string) => {
      if (typeof key !== "string") {
        throw new Error("param() requires a string argument");
      }
      return this.context.testData?.get(key);
    },

    // Environment variables
    env: (key: string) => {
      if (typeof key !== "string") {
        throw new Error("env() requires a string argument");
      }
      return process.env[key];
    },
  };

  constructor(context: TickContext) {
    super();
    this.context = context;
    this.blackboard = context.blackboard;
  }

  /**
   * Visit a parse tree node
   * Inherited from ScriptLangVisitor
   */
  visit(tree: unknown): unknown {
    return super.visit(tree);
  }

  /**
   * Visit the program (root node)
   * Executes all statements and returns the last value
   */
  visitProgram(ctx: AntlrContext): unknown {
    const statements = ctx.statement();
    if (statements && statements.length > 0) {
      for (const stmt of statements) {
        this.visit(stmt);
      }
    }
    return this.lastValue;
  }

  /**
   * Visit a statement (assignment or expression)
   */
  visitStatement(ctx: AntlrContext): unknown {
    if (ctx.assignment()) {
      return this.visit(ctx.assignment());
    } else if (ctx.expressionStatement()) {
      return this.visit(ctx.expressionStatement());
    }
    return null;
  }

  /**
   * Visit an assignment statement
   * Sets the variable in the blackboard
   */
  visitAssignment(ctx: AntlrContext): void {
    const varName = ctx.IDENT().getText();
    const value = this.visit(ctx.expression());
    this.blackboard.set(varName, value);
    this.lastValue = value;
  }

  /**
   * Visit an expression statement
   * Evaluates the expression and stores the result as lastValue
   */
  visitExpressionStatement(ctx: AntlrContext): unknown {
    const value = this.visit(ctx.expression());
    this.lastValue = value;
    return value;
  }

  /**
   * Visit an expression (delegates to logicalOr)
   */
  visitExpression(ctx: AntlrContext): unknown {
    return this.visit(ctx.logicalOr());
  }

  /**
   * Visit logical OR expression
   */
  visitLogicalOr(ctx: AntlrContext): unknown {
    const operands = ctx.logicalAnd();
    let result = this.visit(operands[0]);

    // Only apply boolean logic if there are multiple operands
    if (operands.length === 1) {
      return result;
    }

    for (let i = 1; i < operands.length; i++) {
      // Short-circuit evaluation
      if (this.toBoolean(result)) {
        return true;
      }
      result = this.visit(operands[i]);
    }

    return this.toBoolean(result);
  }

  /**
   * Visit logical AND expression
   */
  visitLogicalAnd(ctx: AntlrContext): unknown {
    const operands = ctx.equality();
    let result = this.visit(operands[0]);

    // Only apply boolean logic if there are multiple operands
    if (operands.length === 1) {
      return result;
    }

    for (let i = 1; i < operands.length; i++) {
      // Short-circuit evaluation
      if (!this.toBoolean(result)) {
        return false;
      }
      result = this.visit(operands[i]);
    }

    return this.toBoolean(result);
  }

  /**
   * Visit equality expression (== or !=)
   */
  visitEquality(ctx: AntlrContext): unknown {
    const operands = ctx.comparison();
    let result = this.visit(operands[0]);

    for (let i = 1; i < operands.length; i++) {
      const operator = ctx.getChild(i * 2 - 1).getText();
      const right = this.visit(operands[i]);

      if (operator === "==") {
        result = result === right;
      } else if (operator === "!=") {
        result = result !== right;
      }
    }

    return result;
  }

  /**
   * Visit comparison expression (>, <, >=, <=)
   */
  visitComparison(ctx: AntlrContext): unknown {
    const operands = ctx.additive();
    let result = this.visit(operands[0]);

    for (let i = 1; i < operands.length; i++) {
      const operator = ctx.getChild(i * 2 - 1).getText();
      const right = this.visit(operands[i]);

      switch (operator) {
        case ">":
          result = this.toNumber(result) > this.toNumber(right);
          break;
        case "<":
          result = this.toNumber(result) < this.toNumber(right);
          break;
        case ">=":
          result = this.toNumber(result) >= this.toNumber(right);
          break;
        case "<=":
          result = this.toNumber(result) <= this.toNumber(right);
          break;
      }
    }

    return result;
  }

  /**
   * Visit additive expression (+ or -)
   */
  visitAdditive(ctx: AntlrContext): unknown {
    const operands = ctx.multiplicative();
    let result = this.visit(operands[0]);

    for (let i = 1; i < operands.length; i++) {
      const operator = ctx.getChild(i * 2 - 1).getText();
      const right = this.visit(operands[i]);

      if (operator === "+") {
        // String concatenation if either operand is a string
        if (typeof result === "string" || typeof right === "string") {
          result = String(result) + String(right);
        } else {
          result = this.toNumber(result) + this.toNumber(right);
        }
      } else if (operator === "-") {
        result = this.toNumber(result) - this.toNumber(right);
      }
    }

    return result;
  }

  /**
   * Visit multiplicative expression (*, /, %)
   */
  visitMultiplicative(ctx: AntlrContext): unknown {
    const operands = ctx.unary();
    let result = this.visit(operands[0]);

    for (let i = 1; i < operands.length; i++) {
      const operator = ctx.getChild(i * 2 - 1).getText();
      const right = this.visit(operands[i]);

      switch (operator) {
        case "*":
          result = this.toNumber(result) * this.toNumber(right);
          break;
        case "/":
          result = this.toNumber(result) / this.toNumber(right);
          break;
        case "%":
          result = this.toNumber(result) % this.toNumber(right);
          break;
      }
    }

    return result;
  }

  /**
   * Visit unary expression (!, -)
   */
  visitUnary(ctx: AntlrContext): unknown {
    // Check if there's a unary operator
    const firstChild = ctx.getChild(0);
    const firstChildText = firstChild.getText();

    if (firstChildText === "!") {
      const operand = this.visit(ctx.unary());
      return !this.toBoolean(operand);
    } else if (firstChildText === "-") {
      const operand = this.visit(ctx.unary());
      return -this.toNumber(operand);
    } else {
      // No unary operator, continue to propertyAccess
      return this.visit(ctx.propertyAccess());
    }
  }

  /**
   * Visit property access expression (object.property)
   */
  visitPropertyAccess(ctx: AntlrContext): unknown {
    let result = this.visit(ctx.primary());

    // Handle property accesses
    const identifiers = ctx.IDENT();
    if (identifiers && identifiers.length > 0) {
      for (const ident of identifiers) {
        const propName = ident.getText();
        if (
          result !== null &&
          result !== undefined &&
          typeof result === "object"
        ) {
          result = (result as Record<string, unknown>)[propName];
        } else {
          return undefined;
        }
      }
    }

    return result;
  }

  /**
   * Visit primary expression (literals, identifiers, function calls, parenthesized expressions)
   */
  visitPrimary(ctx: AntlrContext): unknown {
    // Number literal
    if (ctx.NUMBER()) {
      return parseFloat(ctx.NUMBER().getText());
    }

    // String literal
    if (ctx.STRING()) {
      const text = ctx.STRING().getText();
      // Remove quotes and handle escape sequences
      return text.slice(1, -1).replace(/\\(.)/g, "$1");
    }

    // Boolean literal
    if (ctx.BOOLEAN()) {
      return ctx.BOOLEAN().getText() === "true";
    }

    // Null literal
    if (ctx.NULL()) {
      return null;
    }

    // Function call
    if (ctx.functionCall()) {
      return this.visit(ctx.functionCall());
    }

    // Identifier (variable from blackboard)
    if (ctx.IDENT()) {
      const varName = ctx.IDENT().getText();
      return this.blackboard.get(varName);
    }

    // Parenthesized expression
    if (ctx.expression()) {
      return this.visit(ctx.expression());
    }

    return null;
  }

  /**
   * Visit function call expression
   * Handles built-in functions like param() and env()
   */
  visitFunctionCall(ctx: AntlrContext): unknown {
    const funcName = ctx.IDENT().getText();
    const builtin = this.builtinFunctions[funcName];

    if (!builtin) {
      throw new Error(`Unknown function: ${funcName}`);
    }

    // Evaluate arguments
    const args: unknown[] = [];
    if (ctx.argumentList()) {
      const expressions = ctx.argumentList().expression();
      for (const expr of expressions) {
        args.push(this.visit(expr));
      }
    }

    return builtin(...args);
  }

  /**
   * Helper: Convert value to boolean
   */
  private toBoolean(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    if (typeof value === "string") {
      return value.length > 0;
    }
    return true; // Objects, arrays, etc. are truthy
  }

  /**
   * Helper: Convert value to number
   */
  private toNumber(value: unknown): number {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }
    if (value === null || value === undefined) {
      return 0;
    }
    return 0;
  }

  /**
   * Get the last evaluated value
   */
  getLastValue(): unknown {
    return this.lastValue;
  }
}
