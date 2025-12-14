/**
 * Sequence composite node
 * Executes children in order until one fails or all succeed
 */

import * as Effect from "effect/Effect";
import { CompositeNode } from "../base-node.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

export class Sequence extends CompositeNode {
  private currentChildIndex: number = 0;

  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      self.log("Ticking with", self._children.length, "children");

      if (self._children.length === 0) {
        return NodeStatus.SUCCESS;
      }

      // Continue from where we left off if RUNNING
      while (self.currentChildIndex < self._children.length) {
        // Check for cancellation before ticking each child
        yield* _(checkSignal(context.signal));

        const child = self._children[self.currentChildIndex];
        if (!child) {
          return yield* _(
            Effect.fail(
              new Error(
                `Child at index ${self.currentChildIndex} is undefined`,
              ),
            ),
          );
        }

        self.log(`Ticking child ${self.currentChildIndex}: ${child.name}`);
        const childStatus = yield* _(child.tick(context));

        switch (childStatus) {
          case NodeStatus.SUCCESS:
            self.log(`Child ${child.name} succeeded`);
            self.currentChildIndex++;
            break;

          case NodeStatus.SKIPPED:
            self.log(`Child ${child.name} skipped (before resume point)`);
            self.currentChildIndex++;
            break;

          case NodeStatus.FAILURE:
            self.log(`Child ${child.name} failed - sequence fails`);
            self._status = NodeStatus.FAILURE;
            self.currentChildIndex = 0;
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
      self.currentChildIndex = 0;
      return NodeStatus.SUCCESS;
    });
  }

  protected onHalt(): void {
    this.haltChildren(this.currentChildIndex);
    this.currentChildIndex = 0;
  }

  protected onReset(): void {
    this.currentChildIndex = 0;
  }
}