/**
 * Timeout decorator node
 * Fails if the child doesn't complete within a specified time
 */

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

    // Start timer on first tick
    if (this.startTime === null) {
      this.startTime = Date.now();
      this.log(`Starting timeout for ${this.timeoutMs}ms`);
    }

    // Check if time has elapsed
    const elapsed = Date.now() - this.startTime;
    if (elapsed >= this.timeoutMs) {
      this.log(`Timeout after ${elapsed}ms`);

      // Halt child if still running
      if (this.child.status() === NodeStatus.RUNNING) {
        this.child.halt();
      }

      this.startTime = null; // Reset timer
      this._status = NodeStatus.FAILURE;
      return NodeStatus.FAILURE;
    }

    // Tick the child
    const remainingTime = this.timeoutMs - elapsed;
    this.log(`Ticking child (${remainingTime}ms remaining)`);

    const childStatus = await this.child.tick(context);

    // Check timeout again AFTER child tick
    const elapsedAfterTick = Date.now() - this.startTime;
    if (elapsedAfterTick >= this.timeoutMs) {
      this.log(`Timed out during child execution (${elapsedAfterTick}ms)`);

      if (this.child.status() === NodeStatus.RUNNING) {
        this.child.halt();
      }

      this.startTime = null; // Reset timer
      this._status = NodeStatus.FAILURE;
      return NodeStatus.FAILURE;
    }

    // Child completed or still running within timeout
    switch (childStatus) {
      case NodeStatus.SUCCESS:
      case NodeStatus.FAILURE:
        this.log(
          `Child completed with ${childStatus} after ${elapsedAfterTick}ms`,
        );
        this.startTime = null; // Reset for next execution
        this._status = childStatus;
        return childStatus;

      case NodeStatus.RUNNING:
        this._status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;

      default:
        this.startTime = null;
        return childStatus;
    }
  }

  protected onHalt(): void {
    this.startTime = null;

    // Ensure child is halted
    if (this.child && this.child.status() === NodeStatus.RUNNING) {
      this.child.halt();
    }
  }

  protected onReset(): void {
    this.startTime = null;
  }
}
