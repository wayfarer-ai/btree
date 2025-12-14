/**
 * ReactiveSequence node - Restarts from beginning each tick
 * Responds to condition changes during execution
 */

import * as Effect from "effect/Effect";
import { ConfigurationError } from "../errors.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";
import { Sequence } from "./sequence.js";

/**
 * ReactiveSequence restarts from the beginning on each tick.
 * Unlike regular Sequence which remembers its position, ReactiveSequence
 * re-evaluates all children from the start, making it responsive to
 * conditions that might change between ticks.
 *
 * Use cases:
 * - Real-time monitoring where conditions might change
 * - Safety-critical checks that must be re-evaluated
 * - Guard conditions that need constant verification
 */
export class ReactiveSequence extends Sequence {
  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      self.log("Ticking (reactive - always starts from beginning)");

      if (self._children.length === 0) {
        return NodeStatus.SUCCESS;
      }

      // Always start from child 0 (reactive behavior)
      // Don't use currentChildIndex from parent Sequence
      for (let i = 0; i < self._children.length; i++) {
        // Check for cancellation before ticking each child
        yield* _(checkSignal(context.signal));

        const child = self._children[i];
        if (!child) {
          return yield* _(
            Effect.fail(
              new ConfigurationError(`Child at index ${i} is undefined`),
            ),
          );
        }

        self.log(`Ticking child ${i}: ${child.name}`);
        const childStatus = yield* _(child.tick(context));

        switch (childStatus) {
          case NodeStatus.SUCCESS:
            self.log(`Child ${child.name} succeeded`);
            // Continue to next child
            break;

          case NodeStatus.FAILURE:
            self.log(`Child ${child.name} failed - sequence fails`);
            self._status = NodeStatus.FAILURE;
            return NodeStatus.FAILURE;

          case NodeStatus.RUNNING:
            self.log(`Child ${child.name} is running`);
            self._status = NodeStatus.RUNNING;
            // Return RUNNING but don't save position - will restart next tick
            return NodeStatus.RUNNING;

          default:
            return yield* _(
              Effect.fail(
                new Error(`Unexpected status from child: ${childStatus}`),
              ),
            );
        }
      }

      // All children succeeded
      self.log("All children succeeded");
      self._status = NodeStatus.SUCCESS;
      return NodeStatus.SUCCESS;
    });
  }

  /**
   * Override to prevent parent Sequence from resetting currentChildIndex
   * (ReactiveSequence doesn't use currentChildIndex)
   */
  protected onReset(): void {
    // Call BaseNode reset (skip Sequence reset)
    this._status = NodeStatus.IDLE;

    // Reset all children
    for (const child of this._children) {
      child.reset();
    }
  }
}