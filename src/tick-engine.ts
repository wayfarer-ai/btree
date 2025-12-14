/**
 * TickEngine - Executes behavior trees with async support and cancellation
 */

import * as Effect from "effect/Effect";
import type { Exit } from "effect/Exit";
import { TickDelayStrategy } from "./backoff-strategy.js";
import { ScopedBlackboard } from "./blackboard.js";
import { NodeEventEmitter, NodeEventType } from "./events.js";
import {
  type EffectTickContext,
  type IScopedBlackboard,
  NodeStatus,
  type RunningOperation,
  type TreeNode,
} from "./types.js";

/**
 * What changed in the blackboard between snapshots
 */
export interface BlackboardDiff {
  added: Record<string, unknown>;
  modified: Record<string, { from: unknown; to: unknown }>;
  deleted: string[];
}

/**
 * Node execution information for a tick
 */
export interface ExecutionTraceNode {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: NodeStatus;
  startTime: number;
  duration: number;
}

/**
 * Snapshot of execution state at a specific point in time
 * Only captured when blackboard state changes
 */
export interface ExecutionSnapshot {
  timestamp: number;
  tickNumber: number;
  blackboard: IScopedBlackboard;
  blackboardDiff: BlackboardDiff;
  executionTrace: ExecutionTraceNode[];
  rootNodeId: string;
  rootStatus: NodeStatus;
}

/**
 * Log entry collected during execution (from LogMessage nodes)
 */
export interface LogEntry {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  nodeId: string;
  timestamp: number;
}

/**
 * Result of tickWhileRunning execution
 * Contains status, metrics, and feedback all in one place
 */
export interface TickWhileRunningResult {
  status: NodeStatus;
  tickCount: number;
  logs: LogEntry[];
  failedNodeId?: string;
  failedError?: string;
}

export interface TickEngineOptions {
  /**
   * Session-scoped tree registry for looking up BehaviorTrees by ID.
   * Required - each session should have its own registry for isolation.
   */
  treeRegistry: import("./types.js").ITreeRegistry;

  /**
   * Maximum time for a single tick in milliseconds
   * Default: no limit
   */
  tickTimeout?: number;

  /**
   * Whether to automatically reset the tree before each tick
   * Default: false
   */
  autoReset?: boolean;

  /**
   * Callback for tick events
   */
  onTick?: (status: NodeStatus, elapsed: number) => void;

  /**
   * Callback for errors
   */
  onError?: (error: Error) => void;

  /**
   * Event emitter for observing node lifecycle events
   * External systems can subscribe to TICK_START, TICK_END, ERROR, HALT, RESET events
   */
  eventEmitter?: import("./events.js").NodeEventEmitter;

  /**
   * Whether to capture execution snapshots for time-travel debugging
   * Default: false
   */
  captureSnapshots?: boolean;

  /**
   * Tick delay strategy:
   * - undefined (default): Auto exponential backoff (0ms → 1ms → 2ms → 4ms → 8ms → 16ms cap)
   * - number: Fixed delay in milliseconds for all ticks (0 = setImmediate)
   *
   * Auto mode automatically resets when operations complete or new operations start.
   */
  tickDelayMs?: number;
}

export class TickEngine {
  private root: TreeNode;
  private options: TickEngineOptions;
  private delayStrategy: TickDelayStrategy;
  private abortController: AbortController | null = null;
  private isRunning: boolean = false;
  private tickCount: number = 0;
  private lastTickTime: number = 0;

  // Running operations tracking - persisted across ticks for async/RUNNING semantics
  private runningOps: Map<string, RunningOperation> = new Map();

  private snapshots: ExecutionSnapshot[] = [];
  private previousBlackboardState: Record<string, unknown> = {};
  private currentExecutionTrace: ExecutionTraceNode[] = [];

  // Execution feedback tracking
  private _lastFailedNodeId?: string;
  private _lastFailedError?: string;
  private _logs: LogEntry[] = [];

  constructor(root: TreeNode, options: TickEngineOptions) {
    this.root = root;
    this.options = options;
    this.delayStrategy = new TickDelayStrategy(options.tickDelayMs);

    // Auto-create event emitter if snapshots enabled but no emitter provided
    if (this.options.captureSnapshots && !this.options.eventEmitter) {
      this.options.eventEmitter = new NodeEventEmitter();
    }

    // Subscribe to events for execution feedback
    if (this.options.eventEmitter) {
      // Collect LogMessage outputs
      this.options.eventEmitter.on(NodeEventType.LOG, (event) => {
        const data = event.data as
          | { level: string; message: string }
          | undefined;
        if (data) {
          this._logs.push({
            level: data.level as LogEntry["level"],
            message: data.message,
            nodeId: event.nodeId,
            timestamp: event.timestamp,
          });
        }
      });

      // Track failed nodes via TICK_END events
      this.options.eventEmitter.on(NodeEventType.TICK_END, (event) => {
        const data = event.data as
          | { status?: NodeStatus; error?: string }
          | undefined;
        if (data?.status === NodeStatus.FAILURE) {
          // Only capture the first failure (the actual leaf node that failed)
          // Parent composites will also emit FAILURE, but we want the original source
          if (!this._lastFailedNodeId) {
            this._lastFailedNodeId = event.nodeId;
            this._lastFailedError = data.error || undefined;
          }
        }
      });

      // Track errors - only capture the first error (the actual source node)
      // Parent nodes may also emit ERROR when re-propagating, but we want the original
      this.options.eventEmitter.on(NodeEventType.ERROR, (event) => {
        if (!this._lastFailedNodeId) {
          const data = event.data as { error?: string } | undefined;
          this._lastFailedNodeId = event.nodeId;
          this._lastFailedError = data?.error || "Unknown error";
        }
      });
    }

    this.log(`Tick delay strategy: ${this.delayStrategy.getMode()}`);
    this.log("TickEngine created");
  }

  // Execution feedback accessors (for low-level tick() users)
  get lastFailedNodeId(): string | undefined {
    return this._lastFailedNodeId;
  }

  get lastFailedError(): string | undefined {
    return this._lastFailedError;
  }

  get logs(): LogEntry[] {
    return this._logs;
  }

  /**
   * Compute diff between two blackboard states
   */
  private computeDiff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): BlackboardDiff {
    const added: Record<string, unknown> = {};
    const modified: Record<string, { from: unknown; to: unknown }> = {};
    const deleted: string[] = [];

    // Find added and modified keys
    for (const key in after) {
      if (!(key in before)) {
        added[key] = after[key];
      } else if (!this.isEqual(before[key], after[key])) {
        modified[key] = { from: before[key], to: after[key] };
      }
    }

    // Find deleted keys
    for (const key in before) {
      if (!(key in after)) {
        deleted.push(key);
      }
    }

    return { added, modified, deleted };
  }

  /**
   * Check if diff has any changes
   */
  private hasChanges(diff: BlackboardDiff): boolean {
    return (
      Object.keys(diff.added).length > 0 ||
      Object.keys(diff.modified).length > 0 ||
      diff.deleted.length > 0
    );
  }

  /**
   * Deep equality check using JSON serialization
   */
  private isEqual(a: unknown, b: unknown): boolean {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      // Fallback for non-serializable objects
      return a === b;
    }
  }

  /**
   * Set up event listeners to track execution during a tick
   */
  private setupExecutionTracking(context: EffectTickContext): void {
    this.currentExecutionTrace = [];

    if (!context.eventEmitter) {
      return;
    }

    const traceMap = new Map<string, { start: number }>();

    // Track when nodes start
    const onTickStart = (event: { nodeId: string; timestamp: number }) => {
      traceMap.set(event.nodeId, { start: event.timestamp });
    };

    // Track when nodes complete
    const onTickEnd = (event: {
      nodeId: string;
      timestamp: number;
      nodeName?: string;
      nodeType?: string;
      data?: { status?: NodeStatus };
    }) => {
      const startInfo = traceMap.get(event.nodeId);
      if (startInfo) {
        this.currentExecutionTrace.push({
          nodeId: event.nodeId,
          nodeName: event.nodeName || event.nodeId,
          nodeType: event.nodeType || "unknown",
          status: event.data?.status || NodeStatus.SUCCESS,
          startTime: startInfo.start,
          duration: event.timestamp - startInfo.start,
        });
      }
    };

    context.eventEmitter.on(NodeEventType.TICK_START, onTickStart);
    context.eventEmitter.on(NodeEventType.TICK_END, onTickEnd);
  }

  /**
   * Capture a snapshot of current execution state
   * Only captures if captureSnapshots option is enabled AND state has changed
   */
  private captureSnapshotIfChanged(
    blackboard: IScopedBlackboard,
    status: NodeStatus,
  ): void {
    if (!this.options.captureSnapshots) {
      return;
    }

    const currentState = blackboard.toJSON();
    const diff = this.computeDiff(this.previousBlackboardState, currentState);

    // Only capture if something changed
    if (this.hasChanges(diff)) {
      this.snapshots.push({
        timestamp: Date.now(),
        tickNumber: this.tickCount,
        blackboard: blackboard.clone(),
        blackboardDiff: diff,
        executionTrace: [...this.currentExecutionTrace],
        rootNodeId: this.root.id,
        rootStatus: status,
      });
    }

    // Update previous state for next comparison
    this.previousBlackboardState = currentState;
  }

  /**
   * Get all captured snapshots
   */
  getSnapshots(): ExecutionSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Clear all captured snapshots and reset tracking state
   */
  clearSnapshots(): void {
    this.snapshots = [];
    this.previousBlackboardState = {};
    this.currentExecutionTrace = [];
  }

  /**
   * Execute a single tick of the behavior tree
   * @param blackboard - Optional blackboard to use for this tick
   * @param resumeFromNodeId - Optional node ID to resume execution from (skips nodes before this point)
   */
  async tick(
    blackboard?: ScopedBlackboard,
    resumeFromNodeId?: string,
  ): Promise<NodeStatus> {
    if (this.isRunning) {
      throw new Error("TickEngine is already running");
    }

    this.isRunning = true;
    this.tickCount++;

    // Create abort controller for cancellation
    this.abortController = new AbortController();

    // Auto-reset if configured and tree has completed
    const status = this.root.status();
    if (
      this.options.autoReset &&
      status !== NodeStatus.RUNNING &&
      status !== NodeStatus.IDLE
    ) {
      this.log("Auto-resetting tree");
      this.root.reset();
    }

    // Create tick context
    const currentBlackboard = blackboard || new ScopedBlackboard();

    // Set up execution tracking if snapshots are enabled
    const context: EffectTickContext = {
      blackboard: currentBlackboard,
      treeRegistry: this.options.treeRegistry,
      signal: this.abortController.signal,
      timestamp: Date.now(),
      deltaTime: this.lastTickTime ? Date.now() - this.lastTickTime : 0,
      eventEmitter: this.options.eventEmitter,
      runningOps: this.runningOps, // Reuse running operations map across ticks
      resumeFromNodeId,
      hasReachedResumePoint: false,
    };

    // Start tracking execution if snapshots enabled
    if (this.options.captureSnapshots) {
      this.setupExecutionTracking(context);
    }

    this.lastTickTime = context.timestamp;
    const startTime = Date.now();

    try {
      // Use Effect.runPromiseExit() instead of Effect.runPromise()
      // This gives us an Exit type that preserves error information properly
      this.log(`Starting tick #${this.tickCount}`);

      // Handle timeout if configured
      let exit: Exit<NodeStatus, unknown>;
      if (this.options.tickTimeout) {
        const tickPromise = Effect.runPromiseExit(this.root.tick(context));
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Tick timeout")),
            this.options.tickTimeout,
          );
        });

        exit = await Promise.race([tickPromise, timeoutPromise]);
      } else {
        exit = await Effect.runPromiseExit(this.root.tick(context));
      }

      const elapsed = Date.now() - startTime;

      // Pattern match on the Exit to handle success and failure
      if (exit._tag === "Success") {
        const resultStatus = exit.value;
        this.log(
          `Tick #${this.tickCount} completed with status: ${resultStatus} (${elapsed}ms)`,
        );

        // Capture snapshot only if state changed
        this.captureSnapshotIfChanged(currentBlackboard, resultStatus);

        // Call tick callback
        this.options.onTick?.(resultStatus, elapsed);

        return resultStatus;
      } else {
        // exit._tag === "Failure"
        // Extract the original error from the Cause
        const cause = exit.cause;
        let originalError: unknown = new Error("Unknown error");

        // Use Effect's Cause API to extract the failure
        if (cause._tag === "Fail") {
          originalError = cause.error;
        } else if (cause._tag === "Die") {
          originalError = cause.defect;
        }

        this.log(
          `Tick #${this.tickCount} failed after ${elapsed}ms:`,
          originalError,
        );

        // Halt the tree on error
        this.root.halt();

        // Call error callback
        this.options.onError?.(originalError as Error);

        // Throw the original error
        throw originalError;
      }
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  /**
   * Continuously tick the tree while it returns RUNNING
   * Returns a result object containing status, tick count, logs, and failure info
   * @param blackboard - Optional blackboard for the tick context
   * @param maxTicks - Maximum number of ticks before stopping (safety limit)
   * @param resumeFromNodeId - Optional node ID to resume from (passed only on first tick)
   */
  async tickWhileRunning(
    blackboard?: ScopedBlackboard,
    maxTicks?: number,
    resumeFromNodeId?: string,
  ): Promise<TickWhileRunningResult> {
    // Clear execution feedback at start for clean slate
    this._logs = [];
    this._lastFailedNodeId = undefined;
    this._lastFailedError = undefined;

    let status: NodeStatus;
    let ticks = 0;
    let previousStatus: NodeStatus | null = null;
    let isFirstTick = true;

    this.log("Starting tickWhileRunning loop");

    do {
      // Pass resumeFromNodeId only on the first tick to skip to resume point
      status = await this.tick(
        blackboard,
        isFirstTick ? resumeFromNodeId : undefined,
      );
      isFirstTick = false;
      ticks++;

      if (maxTicks && ticks >= maxTicks) {
        this.log(`Reached max ticks limit (${maxTicks})`);
        break;
      }

      // Reset delay strategy when:
      // 1. Node completes (RUNNING → SUCCESS/FAILURE)
      // 2. Starting new operation (SUCCESS/FAILURE → RUNNING)
      if (previousStatus !== null) {
        if (
          previousStatus === NodeStatus.RUNNING &&
          status !== NodeStatus.RUNNING
        ) {
          // Operation completed
          this.delayStrategy.reset();
        } else if (
          previousStatus !== NodeStatus.RUNNING &&
          status === NodeStatus.RUNNING
        ) {
          // New operation started
          this.delayStrategy.reset();
        }
      }

      if (status === NodeStatus.RUNNING) {
        const delayMs = this.delayStrategy.getDelayAndAdvance();

        if (delayMs === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        } else {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      previousStatus = status;
    } while (status === NodeStatus.RUNNING);

    this.log(
      `tickWhileRunning completed after ${ticks} ticks with status: ${status}`,
    );

    return {
      status,
      tickCount: ticks,
      logs: [...this._logs], // Return a copy
      failedNodeId: this._lastFailedNodeId,
      failedError: this._lastFailedError,
    };
  }

  /**
   * Halt the currently running tree
   */
  halt(): void {
    this.log("Halting tree execution");

    if (this.abortController) {
      this.abortController.abort();
    }

    this.root.halt();
    this.isRunning = false;
    this.runningOps.clear(); // Clear running operations on halt
  }

  /**
   * Reset the tree
   */
  reset(): void {
    this.log("Resetting tree");
    this.root.reset();
    this.tickCount = 0;
    this.lastTickTime = 0;
    this.runningOps.clear(); // Clear running operations on reset
  }

  /**
   * Get the root node
   */
  getRoot(): TreeNode {
    return this.root;
  }

  /**
   * Get current status
   */
  getStatus(): NodeStatus {
    return this.root.status();
  }

  /**
   * Get tick count
   */
  getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Check if engine is running
   */
  isEngineRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Create a TickContext configured for resumable execution
   * This is used by dry-run agents and debuggers to resume execution from a specific node
   *
   * Usage:
   * - Programmatic: Pass node.id from code
   *
   * @param resumeFromNodeId - ID of the node to resume execution from
   * @param sessionId - Unique identifier for the execution session
   * @param blackboard - Optional blackboard instance to use (preserves state)
   * @returns TickContext configured for resumable execution
   */
  createResumeContext(
    resumeFromNodeId: string,
    sessionId: string,
    blackboard?: ScopedBlackboard,
  ): EffectTickContext {
    return {
      blackboard: blackboard || new ScopedBlackboard(),
      treeRegistry: this.options.treeRegistry,
      timestamp: Date.now(),
      signal: this.abortController?.signal,
      resumeFromNodeId,
      hasReachedResumePoint: false,
      sessionId,
      runningOps: new Map(), // Initialize running operations map
    };
  }

  private log(message: string, ...args: unknown[]): void {
    console.log(`[TickEngine] ${message}`, ...args);
  }
}
