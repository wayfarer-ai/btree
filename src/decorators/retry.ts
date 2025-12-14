/**
 * Retry decorator node
 * Retries the child node on failure up to a specified number of times
 */

import * as Effect from "effect/Effect";
import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import {
  type EffectTickContext,
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

  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      yield* _(checkSignal(context.signal));

      if (!self.child) {
        return yield* _(
          Effect.fail(
            new ConfigurationError(`${self.name}: Decorator must have a child`),
          ),
        );
      }

      // Handle retry delay
      if (self.isWaiting) {
        yield* _(checkSignal(context.signal));
        const elapsed = Date.now() - self.waitStartTime;
        if (elapsed < self.retryDelay) {
          self.log(`Waiting ${self.retryDelay - elapsed}ms before retry`);
          self._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;
        }
        self.isWaiting = false;
      }

      // Tick the child
      self.log(`Attempt ${self.currentAttempt + 1}/${self.maxAttempts}`);
      const childStatus = yield* _(self.child.tick(context));

      switch (childStatus) {
        case NodeStatus.SUCCESS:
          self.log("Child succeeded");
          self._status = NodeStatus.SUCCESS;
          self.currentAttempt = 0;
          return NodeStatus.SUCCESS;

        case NodeStatus.FAILURE:
          self.currentAttempt++;

          if (self.currentAttempt >= self.maxAttempts) {
            self.log(`Max attempts (${self.maxAttempts}) reached - failing`);
            self._status = NodeStatus.FAILURE;
            self.currentAttempt = 0;
            return NodeStatus.FAILURE;
          }

          self.log(
            `Child failed, will retry (${self.currentAttempt}/${self.maxAttempts})`,
          );

          // Reset child for retry
          self.child.reset();

          // Start delay if configured
          if (self.retryDelay > 0) {
            self.isWaiting = true;
            self.waitStartTime = Date.now();
            self._status = NodeStatus.RUNNING;
            return NodeStatus.RUNNING;
          }

          // Immediate retry
          self._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;

        case NodeStatus.RUNNING:
          self.log("Child is running");
          self._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;

        default:
          return childStatus;
      }
    });
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
