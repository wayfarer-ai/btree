/**
 * Scripting support for behavior trees
 * Enables blackboard manipulation through a simple DSL
 */

export { ScriptEvaluator } from "./evaluator.js";
export type { ScriptConfiguration } from "./script-node.js";
export { Script, validateScriptSyntax } from "./script-node.js";
