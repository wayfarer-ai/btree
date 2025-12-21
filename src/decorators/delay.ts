/**
 * Delay decorator node
 * Waits for a specified duration before executing the child
 */

import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import {
  type TemporalContext,
  type NodeConfiguration,
  NodeStatus,
} from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

export interface DelayConfiguration extends NodeConfiguration {
  /**
   * Delay duration in milliseconds
   */
  delayMs: number;
}

export class Delay extends DecoratorNode {
  private delayMs: number;
  private delayStartTime: number | null = null;

  constructor(config: DelayConfiguration) {
    super(config);
    this.delayMs = config.delayMs;

    if (this.delayMs < 0) {
      throw new ConfigurationError(
        `${this.name}: Delay must be non-negative (got ${this.delayMs})`,
      );
    }
  }

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    checkSignal(context.signal);

    if (!this.child) {
      throw new ConfigurationError(`${this.name}: Decorator must have a child`);
    }

    // If delay is 0, just execute the child immediately
    if (this.delayMs === 0) {
      return await this.child.tick(context);
    }

    // Track start time for logging
    if (this.delayStartTime === null) {
      this.delayStartTime = Date.now();
      this.log(`Starting delay of ${this.delayMs}ms`);
    }

    // Check if delay has elapsed
    const elapsed = Date.now() - this.delayStartTime;

    if (elapsed < this.delayMs) {
      checkSignal(context.signal);
      const remaining = this.delayMs - elapsed;
      this.log(`Delaying... ${remaining}ms remaining`);
      this._status = NodeStatus.RUNNING;
      return NodeStatus.RUNNING;
    }

    // Delay elapsed, execute child
    this.log("Delay completed, executing child");
    checkSignal(context.signal);
    const childStatus = await this.child.tick(context);

    // If child completes, reset for next execution
    if (childStatus !== NodeStatus.RUNNING) {
      this.delayStartTime = null;
    }

    this._status = childStatus;
    return childStatus;
  }

  protected onHalt(): void {
    this.delayStartTime = null;
  }

  protected onReset(): void {
    this.delayStartTime = null;
  }
}
