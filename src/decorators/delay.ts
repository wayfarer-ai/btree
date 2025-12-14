/**
 * Delay decorator node
 * Waits for a specified duration before executing the child
 */

import * as Effect from "effect/Effect";

import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import {
  type EffectTickContext,
  type NodeConfiguration,
  NodeStatus,
} from "../types.js";
import { checkSignal, OperationCancelledError } from "../utils/signal-check.js";

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

      // If delay is 0, just execute the child immediately
      if (self.delayMs === 0) {
        return yield* _(self.child.tick(context));
      }

      // Track start time for logging
      if (self.delayStartTime === null) {
        self.delayStartTime = Date.now();
        self.log(`Starting delay of ${self.delayMs}ms`);
      }

      // Check if delay has elapsed
      const elapsed = Date.now() - self.delayStartTime;

      if (elapsed < self.delayMs) {
        yield* _(checkSignal(context.signal));
        const remaining = self.delayMs - elapsed;
        self.log(`Delaying... ${remaining}ms remaining`);
        self._status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;
      }

      // Delay elapsed, execute child
      self.log("Delay completed, executing child");
      yield* _(checkSignal(context.signal));
      const childStatus = yield* _(self.child.tick(context));

      // If child completes, reset for next execution
      if (childStatus !== NodeStatus.RUNNING) {
        self.delayStartTime = null;
      }

      self._status = childStatus;
      return childStatus;
    }).pipe(
      Effect.catchAll((error) => {
        // Re-throw OperationCancelledError so it propagates to base node's catchAll
        if (error instanceof OperationCancelledError) {
          return Effect.fail(error) as unknown as Effect.Effect<
            NodeStatus,
            never,
            never
          >;
        }
        // Other errors should not happen here, but if they do, convert to FAILURE
        return Effect.succeed(NodeStatus.FAILURE);
      }),
    ) as Effect.Effect<NodeStatus, never, never>;
  }

  protected onHalt(): void {
    this.delayStartTime = null;
  }

  protected onReset(): void {
    this.delayStartTime = null;
  }
}
