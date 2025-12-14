/**
 * Base implementation for all behavior tree nodes
 */

import * as Effect from "effect/Effect";
import { ConfigurationError } from "./errors.js";
import { NodeEventType } from "./events.js";
import {
  type EffectTickContext,
  type NodeConfiguration,
  NodeStatus,
  type PortDefinition,
  type RunningOperation,
  type TreeNode,
} from "./types.js";
import { OperationCancelledError } from "./utils/signal-check.js";
import { handleNodeError } from "./utils/error-handler.js";

/**
 * Abstract base class for all tree nodes
 */
export abstract class BaseNode implements TreeNode {
  readonly id: string;
  readonly name: string;
  readonly type: string;

  protected _status: NodeStatus = NodeStatus.IDLE;
  protected _lastError?: string;
  protected config: NodeConfiguration;
  protected _eventEmitter?: import("./events.js").NodeEventEmitter;

  parent?: TreeNode;
  children?: TreeNode[];

  constructor(config: NodeConfiguration) {
    this.id = config.id;
    this.name = config.name || config.id;
    this.type = this.constructor.name;
    this.config = config;
  }

  /**
   * Main tick method - subclasses override to implement execution logic
   * Now returns Effect for proper async/RUNNING semantics
   * All errors are caught and converted to NodeStatus.FAILURE
   */
  abstract tick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, never, never>;

  /**
   * Clone this node (deep copy including children)
   * Must be implemented by subclasses
   */
  abstract clone(): TreeNode;

  halt(): void {
    console.log(`[${this.type}:${this.name}] Halting...`);

    // Emit HALT event
    this._eventEmitter?.emit({
      type: NodeEventType.HALT,
      nodeId: this.id,
      nodeName: this.name,
      nodeType: this.type,
      timestamp: Date.now(),
    });

    if (this._status === NodeStatus.RUNNING) {
      this.onHalt();
      this._status = NodeStatus.IDLE;
    }
  }

  reset(): void {
    console.log(`[${this.type}:${this.name}] Resetting...`);

    // Emit RESET event
    this._eventEmitter?.emit({
      type: NodeEventType.RESET,
      nodeId: this.id,
      nodeName: this.name,
      nodeType: this.type,
      timestamp: Date.now(),
    });

    this._status = NodeStatus.IDLE;
    this._lastError = undefined;
    this.onReset();
  }

  status(): NodeStatus {
    return this._status;
  }

  get lastError(): string | undefined {
    return this._lastError;
  }

  providedPorts(): PortDefinition[] {
    return [];
  }

  /**
   * Hook for derived classes to implement custom halt logic
   */
  protected onHalt(): void {
    // Override in derived classes if needed
  }

  /**
   * Hook for derived classes to implement custom reset logic
   */
  protected onReset(): void {
    // Override in derived classes if needed
  }

  /**
   * Helper to get input value from blackboard
   */
  protected getInput<T>(
    context: EffectTickContext,
    key: string,
    defaultValue?: T,
  ): T {
    const fullKey = (this.config[key] as string) || key;
    return context.blackboard.getPort<T>(fullKey, defaultValue);
  }

  /**
   * Helper to set output value to blackboard
   */
  protected setOutput<T>(
    context: EffectTickContext,
    key: string,
    value: T,
  ): void {
    const fullKey = (this.config[key] as string) || key;
    context.blackboard.setPort(fullKey, value);
  }

  /**
   * Log helper for debugging
   */
  protected log(message: string, ...args: unknown[]): void {
    console.log(`[${this.type}:${this.name}] ${message}`, ...args);
  }
}

/**
 * Base class for action nodes
 * Includes resumable execution support and Effect-based async/RUNNING semantics
 */
export abstract class ActionNode extends BaseNode {
  /**
   * Clone this action node
   * Leaf nodes have no children to clone
   */
  clone(): TreeNode {
    const ClonedClass = this.constructor as new (
      config: NodeConfiguration,
    ) => this;
    return new ClonedClass({ ...this.config });
  }

  /**
   * Tick with resumable execution support for leaf nodes
   * Uses Effect for proper async/RUNNING semantics
   * All errors (JavaScript throws and Effect failures) are converted to NodeStatus.FAILURE
   */
  tick(context: EffectTickContext): Effect.Effect<NodeStatus, never, never> {
    const self = this;

    return Effect.gen(function* (_) {
      // Store eventEmitter reference for halt/reset
      self._eventEmitter = context.eventEmitter;

      // Emit TICK_START event
      context.eventEmitter?.emit({
        type: NodeEventType.TICK_START,
        nodeId: self.id,
        nodeName: self.name,
        nodeType: self.type,
        timestamp: Date.now(),
      });

      // Resumable execution: skip leaf nodes before resume point
      if (context.resumeFromNodeId && !context.hasReachedResumePoint) {
        if (self.id === context.resumeFromNodeId) {
          // Reached the resume point - set flag and execute normally
          context.hasReachedResumePoint = true;
          self.log(`[Resume] Resuming execution from this node`);
        } else {
          // Before resume point - mark as SKIPPED
          self.log(`[Resume] Skipping node (before resume point)`);
          self._status = NodeStatus.SKIPPED;

          // Emit TICK_END with SKIPPED status
          context.eventEmitter?.emit({
            type: NodeEventType.TICK_END,
            nodeId: self.id,
            nodeName: self.name,
            nodeType: self.type,
            timestamp: Date.now(),
            data: { status: NodeStatus.SKIPPED },
          });

          // Return SKIPPED status - composites will handle this appropriately
          return NodeStatus.SKIPPED;
        }
      }

      // Execute the actual node logic
      const status = yield* _(self.executeTick(context));
      self._status = status;

      // Emit TICK_END event with status
      context.eventEmitter?.emit({
        type: NodeEventType.TICK_END,
        nodeId: self.id,
        nodeName: self.name,
        nodeType: self.type,
        timestamp: Date.now(),
        data: { status },
      });

      return status;
    }).pipe(
      // Catch ALL errors (JavaScript throws AND Effect failures) and convert to FAILURE
      Effect.catchAll((error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Store the error message
        self._lastError = errorMessage;
        self._status = NodeStatus.FAILURE;

        // Emit ERROR event
        context.eventEmitter?.emit({
          type: NodeEventType.ERROR,
          nodeId: self.id,
          nodeName: self.name,
          nodeType: self.type,
          timestamp: Date.now(),
          data: { error: errorMessage },
        });

        // Emit TICK_END with FAILURE status
        context.eventEmitter?.emit({
          type: NodeEventType.TICK_END,
          nodeId: self.id,
          nodeName: self.name,
          nodeType: self.type,
          timestamp: Date.now(),
          data: { status: NodeStatus.FAILURE },
        });

        // Use centralized error handler for consistent behavior
        return handleNodeError(error);
      }),
    );
  }

  /**
   * Abstract method for subclasses to implement their execution logic
   * Returns Effect for async operations
   *
   * Subclasses can either:
   * 1. Override executeTick directly for simple synchronous operations
   * 2. Use the fork/poll pattern by calling runWithDeferredPattern() in executeTick
   */
  protected abstract executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never>;

  /**
   * Helper method: Run async work using Deferred + Fiber pattern
   * This enables proper async/RUNNING semantics where parents can observe RUNNING status
   *
   * Usage in subclass executeTick:
   * ```
   * protected executeTick(context: EffectTickContext): Effect.Effect<NodeStatus, never, never> {
   *   return this.runWithDeferredPattern(context, (ctx) => {
   *     // Your async work here - returns Effect
   *     return Effect.promise(() => page.click());
   *   });
   * }
   * ```
   */
  protected runWithDeferredPattern(
    context: EffectTickContext,
    createWork: (context: EffectTickContext) => Promise<NodeStatus>,
  ): Effect.Effect<NodeStatus, Error, never> {
    const existingOp = context.runningOps.get(this.id);

    if (existingOp) {
      // Tick 2+: Check if operation completed (O(1) flag check)
      if (existingOp.completed) {
        // Completed - clean up and return result
        context.runningOps.delete(this.id);

        if (existingOp.error) {
          this.log(`Async operation failed: ${existingOp.error}`);
          return Effect.fail(existingOp.error);
        }

        this.log(`Async operation completed with status: ${existingOp.result}`);
        if (existingOp.result === undefined) {
          return Effect.succeed(NodeStatus.RUNNING);
        }
        return Effect.succeed(existingOp.result);
      }

      // Still running
      this.log(`Async operation still running...`);
      return Effect.succeed(NodeStatus.RUNNING);
    } else {
      // Tick 1: Start work and return RUNNING immediately
      const op: RunningOperation = {
        promise: null as unknown as Promise<NodeStatus>, // Will be set immediately
        completed: false,
      };

      // Start the Promise and attach completion handlers
      const promise = createWork(context);
      op.promise = promise;

      promise.then(
        (result) => {
          op.completed = true;
          op.result = result;
        },
        (error) => {
          op.completed = true;
          op.error = error as Error;
        },
      );

      context.runningOps.set(this.id, op);
      this.log(`Async operation started, returning RUNNING`);
      return Effect.succeed(NodeStatus.RUNNING);
    }
  }
}

/**
 * Base class for condition nodes
 * Includes resumable execution support and Effect-based async/RUNNING semantics
 */
export abstract class ConditionNode extends BaseNode {
  /**
   * Clone this condition node
   * Leaf nodes have no children to clone
   */
  clone(): TreeNode {
    const ClonedClass = this.constructor as new (
      config: NodeConfiguration,
    ) => this;
    return new ClonedClass({ ...this.config });
  }

  /**
   * Tick with resumable execution support for leaf nodes
   * Uses Effect for proper async/RUNNING semantics
   * All errors (JavaScript throws and Effect failures) are converted to NodeStatus.FAILURE
   */
  tick(context: EffectTickContext): Effect.Effect<NodeStatus, never, never> {
    const self = this;

    return Effect.gen(function* (_) {
      // Store eventEmitter reference for halt/reset
      self._eventEmitter = context.eventEmitter;

      // Emit TICK_START event
      context.eventEmitter?.emit({
        type: NodeEventType.TICK_START,
        nodeId: self.id,
        nodeName: self.name,
        nodeType: self.type,
        timestamp: Date.now(),
      });

      // Resumable execution: skip leaf nodes before resume point
      if (context.resumeFromNodeId && !context.hasReachedResumePoint) {
        if (self.id === context.resumeFromNodeId) {
          // Reached the resume point - set flag and execute normally
          context.hasReachedResumePoint = true;
          self.log(`[Resume] Resuming execution from this node`);
        } else {
          // Before resume point - mark as SKIPPED
          self.log(`[Resume] Skipping node (before resume point)`);
          self._status = NodeStatus.SKIPPED;

          // Emit TICK_END with SKIPPED status
          context.eventEmitter?.emit({
            type: NodeEventType.TICK_END,
            nodeId: self.id,
            nodeName: self.name,
            nodeType: self.type,
            timestamp: Date.now(),
            data: { status: NodeStatus.SKIPPED },
          });

          // Return SKIPPED status - composites will handle this appropriately
          return NodeStatus.SKIPPED;
        }
      }

      // Execute the actual node logic
      const status = yield* _(self.executeTick(context));
      self._status = status;

      // Emit TICK_END event with status
      context.eventEmitter?.emit({
        type: NodeEventType.TICK_END,
        nodeId: self.id,
        nodeName: self.name,
        nodeType: self.type,
        timestamp: Date.now(),
        data: { status },
      });

      return status;
    }).pipe(
      // Catch ALL errors (JavaScript throws AND Effect failures) and convert to FAILURE
      Effect.catchAll((error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Store the error message
        self._lastError = errorMessage;
        self._status = NodeStatus.FAILURE;

        // Emit ERROR event
        context.eventEmitter?.emit({
          type: NodeEventType.ERROR,
          nodeId: self.id,
          nodeName: self.name,
          nodeType: self.type,
          timestamp: Date.now(),
          data: { error: errorMessage },
        });

        // Emit TICK_END with FAILURE status
        context.eventEmitter?.emit({
          type: NodeEventType.TICK_END,
          nodeId: self.id,
          nodeName: self.name,
          nodeType: self.type,
          timestamp: Date.now(),
          data: { status: NodeStatus.FAILURE },
        });

        // Use centralized error handler for consistent behavior
        return handleNodeError(error);
      }),
    );
  }

  /**
   * Abstract method for subclasses to implement their execution logic
   * Returns Effect for async operations
   */
  protected abstract executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never>;
}

/**
 * Base class for decorator nodes (single child)
 */
export abstract class DecoratorNode extends BaseNode {
  protected child?: TreeNode;

  /**
   * Clone this decorator node including its child
   */
  clone(): TreeNode {
    const ClonedClass = this.constructor as new (
      config: NodeConfiguration,
    ) => this;
    const cloned = new ClonedClass({ ...this.config });
    if (this.child) {
      cloned.setChild(this.child.clone());
    }
    return cloned;
  }

  /**
   * Tick with resumable execution support - decorators can be resume points
   * Uses Effect for proper async/RUNNING semantics
   * All errors (JavaScript throws and Effect failures) are converted to NodeStatus.FAILURE
   */
  tick(context: EffectTickContext): Effect.Effect<NodeStatus, never, never> {
    const self = this;

    return Effect.gen(function* (_) {
      // Emit TICK_START event
      context.eventEmitter?.emit({
        type: NodeEventType.TICK_START,
        nodeId: self.id,
        nodeName: self.name,
        nodeType: self.type,
        timestamp: Date.now(),
      });

      // Check if this decorator is the resume point
      if (context.resumeFromNodeId && !context.hasReachedResumePoint) {
        if (self.id === context.resumeFromNodeId) {
          // This decorator is the resume point - set flag and execute normally
          context.hasReachedResumePoint = true;
          self.log(`[Resume] Resuming execution from this decorator node`);
        }
        // If not the resume point, continue traversing to find it (don't skip decorators)
      }

      // Execute decorator's tick logic
      // Outer catchAll will handle all errors
      const status = yield* _(self.executeTick(context));

      // Emit TICK_END event
      context.eventEmitter?.emit({
        type: NodeEventType.TICK_END,
        nodeId: self.id,
        nodeName: self.name,
        nodeType: self.type,
        timestamp: Date.now(),
        data: { status },
      });

      return status;
    }).pipe(
      // Catch ALL errors (JavaScript throws AND Effect failures) and convert to FAILURE
      Effect.catchAll((error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Store the error message
        self._lastError = errorMessage;
        self._status = NodeStatus.FAILURE;

        // Emit ERROR event
        context.eventEmitter?.emit({
          type: NodeEventType.ERROR,
          nodeId: self.id,
          nodeName: self.name,
          nodeType: self.type,
          timestamp: Date.now(),
          data: { error: errorMessage },
        });

        // Emit TICK_END with FAILURE status
        context.eventEmitter?.emit({
          type: NodeEventType.TICK_END,
          nodeId: self.id,
          nodeName: self.name,
          nodeType: self.type,
          timestamp: Date.now(),
          data: { status: NodeStatus.FAILURE },
        });

        // Use centralized error handler for consistent behavior
        return handleNodeError(error);
      }),
    );
  }

  /**
   * Decorator nodes must implement their wrapping logic
   * Returns Effect for async operations
   */
  protected abstract executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never>;

  setChild(child: TreeNode): void {
    if (!child) {
      throw new Error("Cannot set undefined child on decorator node");
    }
    this.child = child;
    this.children = [child];
    child.parent = this;
  }

  halt(): void {
    super.halt();
    if (this.child && this.child.status() === NodeStatus.RUNNING) {
      this.child.halt();
    }
  }

  reset(): void {
    super.reset();
    if (this.child) {
      this.child.reset();
    }
  }
}

/**
 * Base class for composite nodes (multiple children)
 */
export abstract class CompositeNode extends BaseNode {
  protected _children: TreeNode[] = [];

  /**
   * Clone this composite node including all children
   */
  clone(): TreeNode {
    const ClonedClass = this.constructor as new (
      config: NodeConfiguration,
    ) => this;
    const cloned = new ClonedClass({ ...this.config });
    // Clone all children
    const clonedChildren = this._children.map((child) => child.clone());
    cloned.addChildren(clonedChildren);
    return cloned;
  }

  /**
   * Tick with resumable execution support - composites can be resume points
   * Uses Effect for proper async/RUNNING semantics
   * All errors (JavaScript throws and Effect failures) are converted to NodeStatus.FAILURE
   */
  tick(context: EffectTickContext): Effect.Effect<NodeStatus, never, never> {
    const self = this;

    return Effect.gen(function* (_) {
      // Emit TICK_START event
      context.eventEmitter?.emit({
        type: NodeEventType.TICK_START,
        nodeId: self.id,
        nodeName: self.name,
        nodeType: self.type,
        timestamp: Date.now(),
      });

      // Check if this composite is the resume point
      if (context.resumeFromNodeId && !context.hasReachedResumePoint) {
        if (self.id === context.resumeFromNodeId) {
          // This composite is the resume point - set flag and execute normally
          context.hasReachedResumePoint = true;
          self.log(`[Resume] Resuming execution from this composite node`);
        }
        // If not the resume point, continue traversing to find it (don't skip composites)
      }

      // Execute composite's tick logic
      const status = yield* _(self.executeTick(context));

      // Emit TICK_END event
      context.eventEmitter?.emit({
        type: NodeEventType.TICK_END,
        nodeId: self.id,
        nodeName: self.name,
        nodeType: self.type,
        timestamp: Date.now(),
        data: { status },
      });

      return status;
    }).pipe(
      // Catch ALL errors (JavaScript throws AND Effect failures) and convert to FAILURE
      Effect.catchAll((error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Store the error message
        self._lastError = errorMessage;
        self._status = NodeStatus.FAILURE;

        // Emit ERROR event
        context.eventEmitter?.emit({
          type: NodeEventType.ERROR,
          nodeId: self.id,
          nodeName: self.name,
          nodeType: self.type,
          timestamp: Date.now(),
          data: { error: errorMessage },
        });

        // Emit TICK_END with FAILURE status
        context.eventEmitter?.emit({
          type: NodeEventType.TICK_END,
          nodeId: self.id,
          nodeName: self.name,
          nodeType: self.type,
          timestamp: Date.now(),
          data: { status: NodeStatus.FAILURE },
        });

        // Use centralized error handler for consistent behavior
        return handleNodeError(error);
      }),
    );
  }

  /**
   * Composite nodes must implement their traversal logic
   * Returns Effect for async operations
   */
  protected abstract executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never>;

  addChild(child: TreeNode): void {
    if (!child) {
      throw new Error("Cannot add undefined child to composite node");
    }
    this._children.push(child);
    this.children = this._children;
    child.parent = this;
  }

  addChildren(children: TreeNode[]): void {
    children.forEach((child) => {
      this.addChild(child);
    });
  }

  halt(): void {
    super.halt();
    // Halt all running children
    for (const child of this._children) {
      if (child.status() === NodeStatus.RUNNING) {
        child.halt();
      }
    }
  }

  reset(): void {
    super.reset();
    // Reset all children
    for (const child of this._children) {
      child.reset();
    }
  }

  protected haltChildren(startIndex: number = 0): void {
    for (let i = startIndex; i < this._children.length; i++) {
      const child = this._children[i];
      if (child && child.status() === NodeStatus.RUNNING) {
        child.halt();
      }
    }
  }
}
