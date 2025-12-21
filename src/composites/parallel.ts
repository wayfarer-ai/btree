/**
 * Parallel composite node
 * Executes all children concurrently (truly concurrent, not sequential)
 */

import { CompositeNode } from "../base-node.js";
import {
  type TemporalContext,
  type NodeConfiguration,
  NodeStatus,
} from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

/**
 * Execution strategy for parallel node
 */
export type ParallelStrategy =
  | "strict" // All children must succeed
  | "any"; // At least one child must succeed

export interface ParallelConfiguration extends NodeConfiguration {
  /**
   * Execution strategy
   * - 'strict': All children must succeed (default)
   * - 'any': At least one child must succeed
   */
  strategy?: ParallelStrategy;

  /**
   * Optional: Number of children that must succeed (overrides strategy)
   */
  successThreshold?: number;

  /**
   * Optional: Number of children that must fail before parallel fails
   */
  failureThreshold?: number;
}

export class Parallel extends CompositeNode {
  private strategy: ParallelStrategy;
  private successThreshold?: number;
  private failureThreshold?: number;

  constructor(config: ParallelConfiguration) {
    super(config);
    this.strategy = config.strategy ?? "strict";
    this.successThreshold = config.successThreshold;
    this.failureThreshold = config.failureThreshold;
  }

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    this.log(
      `Ticking with ${this._children.length} children (strategy: ${this.strategy})`,
    );

    if (this._children.length === 0) {
      return NodeStatus.SUCCESS;
    }

    // Only tick children that haven't completed yet (IDLE or RUNNING)
    // Children that are SUCCESS or FAILURE should keep their status
    const childrenToTick = this._children.filter((child) => {
      const status = child.status();
      return status === NodeStatus.IDLE || status === NodeStatus.RUNNING;
    });

    this.log(
      `Ticking ${childrenToTick.length}/${this._children.length} children (others completed)`,
    );

    // Check for cancellation before concurrent execution
    checkSignal(context.signal);

    // Tick active children concurrently using Promise.all
    if (childrenToTick.length > 0) {
      await Promise.all(childrenToTick.map((child) => child.tick(context)));
    }

    // Collect all statuses (from both ticked and already-completed children)
    const allStatuses = this._children.map((child) => child.status());

    // Check if any child is still running
    const hasRunning = allStatuses.some(
      (status) => status === NodeStatus.RUNNING,
    );
    if (hasRunning) {
      this.log("At least one child returned RUNNING");
      return NodeStatus.RUNNING;
    }

    // All children completed - count successes and failures
    const successes = allStatuses.filter(
      (status) => status === NodeStatus.SUCCESS,
    ).length;
    const failures = allStatuses.filter(
      (status) => status === NodeStatus.FAILURE,
    ).length;

    this.log(`Results - Successes: ${successes}, Failures: ${failures}`);

    // Check threshold-based completion first (if configured)
    if (
      this.successThreshold !== undefined &&
      successes >= this.successThreshold
    ) {
      this.log(
        `Success threshold met: ${successes}/${this.successThreshold} -> SUCCESS`,
      );
      return NodeStatus.SUCCESS;
    }

    if (
      this.failureThreshold !== undefined &&
      failures >= this.failureThreshold
    ) {
      this.log(
        `Failure threshold met: ${failures}/${this.failureThreshold} -> FAILURE`,
      );
      return NodeStatus.FAILURE;
    }

    // Apply strategy
    if (this.strategy === "strict") {
      // All must succeed
      const finalStatus =
        successes === this._children.length
          ? NodeStatus.SUCCESS
          : NodeStatus.FAILURE;
      this.log(
        `Strategy 'strict': ${successes}/${this._children.length} succeeded -> ${finalStatus}`,
      );
      return finalStatus;
    } else {
      // Any (at least one must succeed)
      const finalStatus =
        successes > 0 ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
      this.log(`Strategy 'any': ${successes} succeeded -> ${finalStatus}`);
      return finalStatus;
    }
  }

  protected onHalt(): void {
    this.log("Halting parallel execution");
    // Halt all running children
    for (const child of this._children) {
      if (child.status() === NodeStatus.RUNNING) {
        child.halt();
      }
    }
  }

  protected onReset(): void {
    this.log("Resetting parallel state");
    // Reset handled by parent class
  }
}
