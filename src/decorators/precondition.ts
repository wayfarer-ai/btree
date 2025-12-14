/**
 * Precondition decorator - Check/resolve preconditions before executing child
 */

import * as Effect from "effect/Effect";
import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type EffectTickContext, NodeStatus, type TreeNode } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

export interface PreconditionEntry {
  condition: TreeNode;
  resolver?: TreeNode;
  required: boolean;
}

/**
 * Precondition checks preconditions before executing the main child.
 * If preconditions fail, attempts to resolve them using resolvers.
 * Useful for ensuring prerequisites are met before executing actions.
 */
export class Precondition extends DecoratorNode {
  private preconditions: PreconditionEntry[] = [];
  private preconditionsChecked: boolean = false;

  /**
   * Add a precondition to check before main execution
   */
  addPrecondition(
    condition: TreeNode,
    resolver?: TreeNode,
    required: boolean = true,
  ): void {
    this.preconditions.push({ condition, resolver, required });
  }

  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      yield* _(checkSignal(context.signal));

      if (!self.child) {
        return yield* _(
          Effect.fail(new ConfigurationError("Precondition requires a child")),
        );
      }

      // Only check preconditions if not already verified
      if (!self.preconditionsChecked) {
        // Check all preconditions
        for (let i = 0; i < self.preconditions.length; i++) {
          yield* _(checkSignal(context.signal));
          const precond = self.preconditions[i];
          if (!precond) {
            continue;
          }

          self.log(
            `Checking precondition ${i + 1}/${self.preconditions.length}`,
          );
          const conditionResult = yield* _(precond.condition.tick(context));

          if (conditionResult === NodeStatus.RUNNING) {
            self.log(`Precondition ${i + 1} is running`);
            self._status = NodeStatus.RUNNING;
            return NodeStatus.RUNNING;
          }

          if (conditionResult === NodeStatus.FAILURE) {
            self.log(`Precondition ${i + 1} failed`);

            // Try resolver if available
            if (precond.resolver) {
              self.log(`Attempting to resolve precondition ${i + 1}`);
              const resolverResult = yield* _(precond.resolver.tick(context));

              if (resolverResult === NodeStatus.RUNNING) {
                self.log(`Resolver ${i + 1} is running`);
                self._status = NodeStatus.RUNNING;
                return NodeStatus.RUNNING;
              }

              if (resolverResult === NodeStatus.SUCCESS) {
                self.log(`Precondition ${i + 1} resolved successfully`);
                // Re-check condition after resolution
                const recheckResult = yield* _(precond.condition.tick(context));
                if (recheckResult !== NodeStatus.SUCCESS) {
                  if (precond.required) {
                    self.log(
                      `Precondition ${i + 1} still not met after resolution`,
                    );
                    self._status = NodeStatus.FAILURE;
                    return NodeStatus.FAILURE;
                  } else {
                    self.log(`Optional precondition ${i + 1} skipped`);
                  }
                }
              } else if (precond.required) {
                self.log(`Failed to resolve required precondition ${i + 1}`);
                self._status = NodeStatus.FAILURE;
                return NodeStatus.FAILURE;
              }
            } else if (precond.required) {
              self.log(`Required precondition ${i + 1} not met (no resolver)`);
              self._status = NodeStatus.FAILURE;
              return NodeStatus.FAILURE;
            } else {
              self.log(`Optional precondition ${i + 1} skipped`);
            }
          }
        }

        // Mark preconditions as checked once all pass
        self.preconditionsChecked = true;
        self.log("All preconditions met - executing main child");
      } else {
        self.log("Preconditions already verified - continuing child execution");
      }

      // Execute child
      yield* _(checkSignal(context.signal));
      const result = yield* _(self.child.tick(context));
      self._status = result;

      // Reset flag when child completes
      if (result !== NodeStatus.RUNNING) {
        self.log("Child completed - resetting precondition check flag");
        self.preconditionsChecked = false;
      }

      return result;
    });
  }

  protected onHalt(): void {
    this.log("Halting - resetting precondition check flag");
    this.preconditionsChecked = false;
    super.onHalt();
  }

  protected onReset(): void {
    this.log("Resetting - clearing precondition check flag");
    this.preconditionsChecked = false;
  }
}
