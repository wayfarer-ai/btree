/**
 * Script Node - Execute scripts to manipulate blackboard
 * Inspired by BehaviorTree.CPP's scripting support
 */

import antlr4 from "antlr4";
import { ActionNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import {
  type TemporalContext,
  type NodeConfiguration,
  NodeStatus,
} from "../types.js";
import { ScriptEvaluator } from "./evaluator.js";
import ScriptLangLexer from "./generated/ScriptLangLexer.js";
import ScriptLangParser from "./generated/ScriptLangParser.js";

export interface ScriptConfiguration extends NodeConfiguration {
  textContent: string;
}

/**
 * Script node that executes a script to manipulate the blackboard
 *
 * Features:
 * - Variable assignments (x = 10)
 * - Arithmetic operations (+, -, *, /, %)
 * - Comparison operators (==, !=, >, <, >=, <=)
 * - Logical operators (&&, ||, !)
 * - String concatenation
 * - Property access (object.property)
 * - Multiple statements
 *
 * All variables are read from and written to the blackboard
 */
export class Script extends ActionNode {
  private parseTree: unknown; // Cached parse tree

  constructor(config: ScriptConfiguration) {
    super(config);

    const scriptCode = config.textContent?.trim();

    if (!scriptCode) {
      throw new ConfigurationError("Script node requires text content");
    }

    // Validate and cache parse tree at construction
    try {
      this.parseTree = this.parse(scriptCode);
    } catch (error: unknown) {
      throw new Error(
        `Script syntax error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    try {
      const evaluator = new ScriptEvaluator(context);
      evaluator.visit(this.parseTree);

      this.log("Script executed successfully");
      return NodeStatus.SUCCESS;
    } catch (error: unknown) {
      this.log(
        `Script execution error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return NodeStatus.FAILURE;
    }
  }

  /**
   * Parse script string into AST
   */
  private parse(script: string): unknown {
    const inputStream = new antlr4.InputStream(script);
    const lexer = new ScriptLangLexer(inputStream);
    const tokenStream = new antlr4.CommonTokenStream(lexer);
    const parser = new ScriptLangParser(tokenStream);

    // Remove default error listeners and add throwing error listener
    parser.removeErrorListeners();
    const errors: string[] = [];
    parser.addErrorListener({
      syntaxError: (
        _recognizer: unknown,
        _offendingSymbol: unknown,
        line: number,
        column: number,
        msg: string,
      ) => {
        errors.push(`line ${line}:${column} ${msg}`);
      },
      reportAmbiguity: () => {},
      reportAttemptingFullContext: () => {},
      reportContextSensitivity: () => {},
    });

    const tree = parser.program();

    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }

    return tree;
  }
}

/**
 * Validate script syntax without creating a node
 */
export function validateScriptSyntax(code: string): void {
  const inputStream = new antlr4.InputStream(code);
  const lexer = new ScriptLangLexer(inputStream);
  const tokenStream = new antlr4.CommonTokenStream(lexer);
  const parser = new ScriptLangParser(tokenStream);

  // Remove default error listeners and add throwing error listener
  parser.removeErrorListeners();
  const errors: string[] = [];
  parser.addErrorListener({
    syntaxError: (
      _recognizer: unknown,
      _offendingSymbol: unknown,
      line: number,
      column: number,
      msg: string,
    ) => {
      errors.push(`line ${line}:${column} ${msg}`);
    },
    reportAmbiguity: () => {},
    reportAttemptingFullContext: () => {},
    reportContextSensitivity: () => {},
  });

  // Parse to check for syntax errors
  parser.program();

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}
