/**
 * Timeout decorator node
 * Fails if the child doesn't complete within a specified time
 *
 * In Temporal workflows: Uses CancellationScope for deterministic timeouts
 * In standalone mode: Uses Date.now() polling for multi-tick behavior
 */

import { CancellationScope, isCancellation } from "@temporalio/workflow";
import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import {
  type TemporalContext,
  type NodeConfiguration,
  NodeStatus,
} from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

export interface TimeoutConfiguration extends NodeConfiguration {
  /**
   * Timeout duration in milliseconds
   */
  timeoutMs: number;
}

export class Timeout extends DecoratorNode {
  private timeoutMs: number;
  private startTime: number | null = null;
  private useTemporalAPI: boolean | null = null;  // Cached detection result

  constructor(config: TimeoutConfiguration) {
    super(config);
    this.timeoutMs = config.timeoutMs;

    if (this.timeoutMs <= 0) {
      throw new ConfigurationError(
        `${this.name}: Timeout must be positive (got ${this.timeoutMs})`,
      );
    }
  }

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    checkSignal(context.signal);

    if (!this.child) {
      throw new ConfigurationError(`${this.name}: Decorator must have a child`);
    }

    // Try Temporal API on first execution only
    if (this.useTemporalAPI === null) {
      try {
        this.log(`Starting timeout for ${this.timeoutMs}ms`);
        const childStatus = await CancellationScope.withTimeout(
          this.timeoutMs,
          async () => {
            return await this.child!.tick(context);
          }
        );

        // Success - we're in a Temporal workflow
        this.useTemporalAPI = true;
        this._status = childStatus;
        this.log(`Child completed with ${childStatus}`);
        return childStatus;

      } catch (err) {
        // Handle Temporal timeout cancellation
        if (isCancellation(err)) {
          this.useTemporalAPI = true;
          this.log(`Timeout after ${this.timeoutMs}ms`);

          if (this.child.status() === NodeStatus.RUNNING) {
            this.child.halt();
          }

          this._status = NodeStatus.FAILURE;
          return NodeStatus.FAILURE;
        }

        // Not in Temporal workflow - use standalone polling
        this.useTemporalAPI = false;
        // Fall through to polling implementation below
      }
    }

    // Use Temporal API (we know we're in a workflow)
    if (this.useTemporalAPI === true) {
      try {
        this.log(`Starting timeout for ${this.timeoutMs}ms`);
        const childStatus = await CancellationScope.withTimeout(
          this.timeoutMs,
          async () => {
            return await this.child!.tick(context);
          }
        );

        this._status = childStatus;
        this.log(`Child completed with ${childStatus}`);
        return childStatus;

      } catch (err) {
        if (isCancellation(err)) {
          this.log(`Timeout after ${this.timeoutMs}ms`);

          if (this.child.status() === NodeStatus.RUNNING) {
            this.child.halt();
          }

          this._status = NodeStatus.FAILURE;
          return NodeStatus.FAILURE;
        }
        throw err;
      }
    }

    // Standalone polling implementation (multi-tick)
    if (this.startTime === null) {
      this.startTime = Date.now();
      this.log(`Starting timeout for ${this.timeoutMs}ms`);
    }

    const elapsed = Date.now() - this.startTime;

    if (elapsed >= this.timeoutMs) {
      this.log(`Timeout after ${this.timeoutMs}ms`);
      this.startTime = null;

      if (this.child.status() === NodeStatus.RUNNING) {
        this.child.halt();
      }

      this._status = NodeStatus.FAILURE;
      return NodeStatus.FAILURE;
    }

    // Execute child
    const childStatus = await this.child.tick(context);

    if (childStatus !== NodeStatus.RUNNING) {
      // Child completed - cleanup
      this.startTime = null;
    }

    this._status = childStatus;
    return childStatus;
  }

  protected onHalt(): void {
    this.startTime = null;
    if (this.child && this.child.status() === NodeStatus.RUNNING) {
      this.child.halt();
    }
  }

  protected onReset(): void {
    this.startTime = null;
    this.useTemporalAPI = null;  // Re-detect on next execution
  }
}
