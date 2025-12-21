/**
 * Retry decorator node
 * Retries the child node on failure up to a specified number of times
 */

import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import {
  type TemporalContext,
  type NodeConfiguration,
  NodeStatus,
} from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

export interface RetryConfiguration extends NodeConfiguration {
  /**
   * Maximum number of retry attempts
   * Default: 3
   */
  maxAttempts?: number;

  /**
   * Delay between retries in milliseconds
   * Default: 0 (no delay)
   */
  retryDelay?: number;
}

export class RetryUntilSuccessful extends DecoratorNode {
  private maxAttempts: number;
  private retryDelay: number;
  private currentAttempt: number = 0;
  private isWaiting: boolean = false;
  private waitStartTime: number = 0;

  constructor(config: RetryConfiguration) {
    super(config);
    this.maxAttempts = config.maxAttempts ?? 3;
    this.retryDelay = config.retryDelay ?? 0;
  }

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    checkSignal(context.signal);

    if (!this.child) {
      throw new ConfigurationError(`${this.name}: Decorator must have a child`);
    }

    // Handle retry delay
    if (this.isWaiting) {
      checkSignal(context.signal);
      const elapsed = Date.now() - this.waitStartTime;
      if (elapsed < this.retryDelay) {
        this.log(`Waiting ${this.retryDelay - elapsed}ms before retry`);
        this._status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;
      }
      this.isWaiting = false;
    }

    // Tick the child
    this.log(`Attempt ${this.currentAttempt + 1}/${this.maxAttempts}`);
    const childStatus = await this.child.tick(context);

    switch (childStatus) {
      case NodeStatus.SUCCESS:
        this.log("Child succeeded");
        this._status = NodeStatus.SUCCESS;
        this.currentAttempt = 0;
        return NodeStatus.SUCCESS;

      case NodeStatus.FAILURE:
        this.currentAttempt++;

        if (this.currentAttempt >= this.maxAttempts) {
          this.log(`Max attempts (${this.maxAttempts}) reached - failing`);
          this._status = NodeStatus.FAILURE;
          this.currentAttempt = 0;
          return NodeStatus.FAILURE;
        }

        this.log(
          `Child failed, will retry (${this.currentAttempt}/${this.maxAttempts})`,
        );

        // Reset child for retry
        this.child.reset();

        // Start delay if configured
        if (this.retryDelay > 0) {
          this.isWaiting = true;
          this.waitStartTime = Date.now();
          this._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;
        }

        // Immediate retry
        this._status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;

      case NodeStatus.RUNNING:
        this.log("Child is running");
        this._status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;

      default:
        return childStatus;
    }
  }

  protected onHalt(): void {
    this.currentAttempt = 0;
    this.isWaiting = false;
  }

  protected onReset(): void {
    this.currentAttempt = 0;
    this.isWaiting = false;
  }
}

/**
 * Retry is an alias for RetryUntilSuccessful (BehaviorTree.CPP compatibility)
 */
export class Retry extends RetryUntilSuccessful {
  constructor(config: NodeConfiguration & { maxAttempts: number; retryDelay?: number }) {
    super({ ...config, type: "Retry" });
  }
}
