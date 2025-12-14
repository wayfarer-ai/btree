/**
 * MemorySequence node - Remembers which children succeeded and skips them on retry
 * Useful for long test sequences where early steps shouldn't re-run
 */

import * as Effect from "effect/Effect";
import { ConfigurationError } from "../errors.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";
import { Sequence } from "./sequence.js";

/**
 * MemorySequence extends Sequence with memory of completed children.
 * When a child fails, subsequent retries will skip already-successful children.
 * This is particularly useful for expensive setup steps that shouldn't be re-executed.
 */
export class MemorySequence extends Sequence {
  private completedChildren: Set<string> = new Set();

  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      self.log(
        `Ticking with ${self._children.length} children (${self.completedChildren.size} completed)`,
      );

      if (self._children.length === 0) {
        return NodeStatus.SUCCESS;
      }

      // Start from first non-completed child
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

        // Skip if already completed
        if (self.completedChildren.has(child.id)) {
          self.log(`Skipping completed child: ${child.name}`);
          continue;
        }

        self.log(`Ticking child ${i}: ${child.name}`);
        const childStatus = yield* _(child.tick(context));

        switch (childStatus) {
          case NodeStatus.SUCCESS:
            self.log(`Child ${child.name} succeeded - remembering`);
            self.completedChildren.add(child.id);
            break;

          case NodeStatus.FAILURE:
            self.log(`Child ${child.name} failed - sequence fails`);
            self._status = NodeStatus.FAILURE;
            return NodeStatus.FAILURE;

          case NodeStatus.RUNNING:
            self.log(`Child ${child.name} is running`);
            self._status = NodeStatus.RUNNING;
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

  protected onReset(): void {
    super.onReset();
    this.log("Clearing completed children memory");
    this.completedChildren.clear();
  }

  protected onHalt(): void {
    super.onHalt();
    // Note: we don't clear memory on halt, only on reset
    // This allows resuming after interruption
  }
}