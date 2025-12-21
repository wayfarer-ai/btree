/**
 * Delay decorator node
 * Waits for a specified duration before executing the child
 *
 * In Temporal workflows: Uses sleep() for deterministic delays
 * In standalone mode: Uses Date.now() polling for multi-tick behavior
 */

import { sleep } from "@temporalio/workflow";
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
  private useTemporalAPI: boolean | null = null;  // Cached detection result

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

    // Try Temporal API on first execution only
    if (this.useTemporalAPI === null) {
      try {
        this.log(`Starting delay of ${this.delayMs}ms`);
        await sleep(this.delayMs);

        // Success - we're in a Temporal workflow
        this.useTemporalAPI = true;
        this.log("Delay completed, executing child");

        checkSignal(context.signal);
        const childStatus = await this.child.tick(context);
        this._status = childStatus;
        return childStatus;

      } catch (err) {
        // Not in Temporal workflow - use standalone polling
        this.useTemporalAPI = false;
        // Fall through to polling implementation below
      }
    }

    // Use Temporal API (we know we're in a workflow)
    if (this.useTemporalAPI === true) {
      this.log(`Starting delay of ${this.delayMs}ms`);
      await sleep(this.delayMs);
      this.log("Delay completed, executing child");

      checkSignal(context.signal);
      const childStatus = await this.child.tick(context);
      this._status = childStatus;
      return childStatus;
    }

    // Standalone polling implementation (multi-tick)
    // If child is already running from a previous tick, execute it immediately
    if (this.child.status() === NodeStatus.RUNNING) {
      checkSignal(context.signal);
      const childStatus = await this.child.tick(context);

      if (childStatus !== NodeStatus.RUNNING) {
        // Child completed - reset delay timer for next cycle
        this.delayStartTime = null;
      }

      this._status = childStatus;
      return childStatus;
    }

    // Start delay if not started
    if (this.delayStartTime === null) {
      this.delayStartTime = Date.now();
      this.log(`Starting delay of ${this.delayMs}ms`);
    }

    const elapsed = Date.now() - this.delayStartTime;

    if (elapsed < this.delayMs) {
      // Still delaying
      this._status = NodeStatus.RUNNING;
      return NodeStatus.RUNNING;
    }

    // Delay completed - execute child
    this.log("Delay completed, executing child");

    checkSignal(context.signal);
    const childStatus = await this.child.tick(context);

    if (childStatus !== NodeStatus.RUNNING) {
      // Child completed - reset delay timer for next cycle
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
    this.useTemporalAPI = null;  // Re-detect on next execution
  }
}
