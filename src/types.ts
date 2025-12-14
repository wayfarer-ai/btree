/**
 * Core types for the Behavior Tree implementation
 * Inspired by BehaviorTree.CPP
 */

/**
 * Status of a node after tick execution
 */
export enum NodeStatus {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  RUNNING = "RUNNING",
  IDLE = "IDLE",
  SKIPPED = "SKIPPED",
}

/**
 * Base configuration for all nodes
 */
export interface NodeConfiguration {
  id: string;
  name?: string;
  [key: string]: unknown; // Additional properties can be passed
}

/**
 * Context passed during tick execution
 */
export interface TickContext {
  blackboard: IScopedBlackboard;
  treeRegistry: ITreeRegistry;
  signal?: AbortSignal;
  deltaTime?: number;
  timestamp: number;

  // Test data parameters (from CSV, data tables, etc.)
  // Used for $param.key variable resolution
  testData?: Map<string, unknown>;

  // Resumable execution support (for dry-run agents and debugging)
  // When set, skip all nodes until we reach resumeFromNodeId, then execute normally from there
  resumeFromNodeId?: string;
  hasReachedResumePoint?: boolean; // Internal flag - set to true when resume point is reached
  sessionId?: string;

  // Observable event system (for monitoring, debugging, visualization)
  // External systems can subscribe to node lifecycle events
  eventEmitter?: import("./events.js").NodeEventEmitter;
}

/**
 * Running operation tracked for async/RUNNING semantics with Effect fibers
 */
/**
 * Tracks a running async operation
 * Uses simple Promise + completion flag for O(1) status checks
 */
export interface RunningOperation {
  promise: Promise<NodeStatus>;
  completed: boolean;
  result?: NodeStatus;
  error?: Error;
}

/**
 * Extended context for Effect-based execution with running operation tracking
 */
export interface EffectTickContext extends TickContext {
  // Map of nodeId → running operation for async status tracking
  runningOps: Map<string, RunningOperation>;
}

/**
 * Port definition for typed inputs/outputs
 */
export interface PortDefinition {
  name: string;
  type: "input" | "output" | "inout";
  description?: string;
  defaultValue?: unknown;
  required?: boolean;
}

/**
 * Base interface for all tree nodes
 */
export interface TreeNode {
  readonly id: string;
  readonly name: string;
  readonly type: string;

  // Core methods - now returns Effect for proper async/RUNNING semantics
  // All errors are caught and converted to NodeStatus.FAILURE
  tick(
    context: EffectTickContext,
  ): import("effect/Effect").Effect<NodeStatus, never, never>;
  halt(): void;
  reset(): void;
  clone(): TreeNode;

  // Port management
  providedPorts?(): PortDefinition[];

  // Status
  status(): NodeStatus;

  // Error tracking - stores the actual error message when node fails
  lastError?: string;

  // Hierarchy
  parent?: TreeNode;
  children?: TreeNode[];
}

/**
 * Constructor type for node factories
 */
export type NodeConstructor<T extends TreeNode = TreeNode> = new (
  config: NodeConfiguration,
) => T;

/**
 * Node metadata for registry
 */
export interface NodeMetadata {
  type: string;
  category: "action" | "condition" | "decorator" | "composite" | "subtree";
  description?: string;
  ports?: PortDefinition[];
}

/**
 * Interface for tree registry (session-scoped)
 * Used by nodes like StepGroup and LocateElement to lookup behavior trees
 */
export interface ITreeRegistry {
  hasTree(id: string): boolean;
  cloneTree(id: string): { getRoot(): TreeNode };
  getAllTreeIds(): string[];
  registerTree(
    id: string,
    tree: { getRoot(): TreeNode; clone(): { getRoot(): TreeNode } },
    sourceFile: string,
  ): void;
  getTree(
    id: string,
  ): { getRoot(): TreeNode; clone(): { getRoot(): TreeNode } } | undefined;
  getTreeSourceFile(id: string): string | undefined;
  getTreesForFile(
    filePath: string,
  ): Map<string, { getRoot(): TreeNode; clone(): { getRoot(): TreeNode } }>;
}

/**
 * Interface for scoped blackboard
 */
export interface IScopedBlackboard {
  // Basic operations - simple mutable API
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;

  // Scoped operations
  createScope(name: string): IScopedBlackboard;
  getParentScope(): IScopedBlackboard | null;
  getScopeName(): string;
  getFullScopePath(): string;

  // Port operations (typed access)
  getPort<T>(key: string, defaultValue?: T): T;
  setPort<T>(key: string, value: T): void;

  // Utilities
  keys(): string[];
  entries(): [string, unknown][];
  toJSON(): Record<string, unknown>;

  // Snapshot utilities - uses native structuredClone for deep cloning
  clone(): IScopedBlackboard;
}
