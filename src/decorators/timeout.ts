/**
 * Timeout decorator node
 * Fails if the child doesn't complete within a specified time
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

      // Start timer on first tick
      if (self.startTime === null) {
        self.startTime = Date.now();
        self.log(`Starting timeout for ${self.timeoutMs}ms`);
      }

      // Check if time has elapsed
      const elapsed = Date.now() - self.startTime;
      if (elapsed >= self.timeoutMs) {
        self.log(`Timeout after ${elapsed}ms`);

        // Halt child if still running
        if (self.child.status() === NodeStatus.RUNNING) {
          self.child.halt();
        }

        self.startTime = null; // Reset timer
        self._status = NodeStatus.FAILURE;
        return NodeStatus.FAILURE;
      }

      // Tick the child
      const remainingTime = self.timeoutMs - elapsed;
      self.log(`Ticking child (${remainingTime}ms remaining)`);

      const childStatus = yield* _(self.child.tick(context));

      // Check timeout again AFTER child tick
      const elapsedAfterTick = Date.now() - self.startTime;
      if (elapsedAfterTick >= self.timeoutMs) {
        self.log(`Timed out during child execution (${elapsedAfterTick}ms)`);

        if (self.child.status() === NodeStatus.RUNNING) {
          self.child.halt();
        }

        self.startTime = null; // Reset timer
        self._status = NodeStatus.FAILURE;
        return NodeStatus.FAILURE;
      }

      // Child completed or still running within timeout
      switch (childStatus) {
        case NodeStatus.SUCCESS:
        case NodeStatus.FAILURE:
          self.log(
            `Child completed with ${childStatus} after ${elapsedAfterTick}ms`,
          );
          self.startTime = null; // Reset for next execution
          self._status = childStatus;
          return childStatus;

        case NodeStatus.RUNNING:
          self._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;

        default:
          self.startTime = null;
          return childStatus;
      }
    });
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
