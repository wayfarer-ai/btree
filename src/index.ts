/**
 * btree - Core behavior tree implementation
 * Inspired by BehaviorTree.CPP
 */

// Backoff strategy
export { TickDelayStrategy } from "./backoff-strategy.js";
// Base nodes
export {
  ActionNode,
  BaseNode,
  CompositeNode,
  ConditionNode,
  DecoratorNode,
} from "./base-node.js";
// Behavior tree wrapper
export { BehaviorTree, type ParsedPath } from "./behavior-tree.js";
// Blackboard
export { ScopedBlackboard } from "./blackboard.js";
// Composite nodes
export * from "./composites/index.js";

// Decorator nodes
export * from "./decorators/index.js";
// Event system
export * from "./events.js";
// Registry
export { Registry } from "./registry.js";
// Scripting nodes
export * from "./scripting/index.js";
// Test nodes (for examples and testing)
export * from "./test-nodes.js";
export type {
  BlackboardDiff,
  ExecutionSnapshot,
  ExecutionTraceNode,
  LogEntry,
  TickEngineOptions,
  TickWhileRunningResult,
} from "./tick-engine.js";
// Tick engine
export { TickEngine } from "./tick-engine.js";
export type {
  EffectTickContext,
  IScopedBlackboard,
  ITreeRegistry,
  RunningOperation,
} from "./types.js";
// Core types
export * from "./types.js";
// Re-export commonly used types for convenience
export { NodeStatus } from "./types.js";
// Utility nodes
export * from "./utilities/index.js";
// Debug nodes
export * from "./debug/index.js";
// Error types
export { ConfigurationError } from "./errors.js";
