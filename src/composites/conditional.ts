/**
 * Conditional node - If-then-else logic for behavior trees
 */

import * as Effect from "effect/Effect";
import { CompositeNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type EffectTickContext, NodeStatus, type TreeNode } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

/**
 * Conditional implements if-then-else logic.
 * Structure:
 * - First child = condition
 * - Second child = then branch
 * - Third child (optional) = else branch
 */
export class Conditional extends CompositeNode {
  private condition?: TreeNode;
  private thenBranch?: TreeNode;
  private elseBranch?: TreeNode;
  private conditionEvaluated: boolean = false;
  private selectedBranch?: TreeNode;

  /**
   * Override addChild to enforce conditional structure
   */
  addChild(child: TreeNode): void {
    if (!this.condition) {
      this.condition = child;
      this._children.push(child);
      child.parent = this;
    } else if (!this.thenBranch) {
      this.thenBranch = child;
      this._children.push(child);
      child.parent = this;
    } else if (!this.elseBranch) {
      this.elseBranch = child;
      this._children.push(child);
      child.parent = this;
    } else {
      throw new ConfigurationError(
        "Conditional can have maximum 3 children (condition, then, else)",
      );
    }
  }

  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      // Check for cancellation before processing conditional
      // OperationCancelledError will be caught by base node's catchAll and re-thrown
      yield* _(checkSignal(context.signal));

      if (!self.condition) {
        return yield* _(
          Effect.fail(
            new Error("Conditional requires at least a condition child"),
          ),
        );
      }

      if (!self.thenBranch) {
        return yield* _(
          Effect.fail(
            new Error(
              "Conditional requires at least condition and then branch",
            ),
          ),
        );
      }

      // Only evaluate condition if not already evaluated
      if (!self.conditionEvaluated) {
        self.log("Evaluating condition");
        const conditionStatus = yield* _(self.condition.tick(context));

        switch (conditionStatus) {
          case NodeStatus.SUCCESS:
            self.log("Condition succeeded - will execute then branch");
            self.selectedBranch = self.thenBranch;
            self.conditionEvaluated = true;
            break;

          case NodeStatus.FAILURE:
            if (self.elseBranch) {
              self.log("Condition failed - will execute else branch");
              self.selectedBranch = self.elseBranch;
              self.conditionEvaluated = true;
            } else {
              self.log("Condition failed - no else branch, returning FAILURE");
              self._status = NodeStatus.FAILURE;
              return NodeStatus.FAILURE;
            }
            break;

          case NodeStatus.RUNNING:
            self.log("Condition is running");
            self._status = NodeStatus.RUNNING;
            return NodeStatus.RUNNING;

          default:
            return yield* _(
              Effect.fail(
                new Error(
                  `Unexpected status from condition: ${conditionStatus}`,
                ),
              ),
            );
        }
      } else {
        self.log("Condition already evaluated - continuing branch execution");
      }

      // Execute selected branch
      if (!self.selectedBranch) {
        return yield* _(
          Effect.fail(new Error("No branch selected for execution")),
        );
      }

      const branchStatus = yield* _(self.selectedBranch.tick(context));
      self._status = branchStatus;

      // Reset flag when branch completes
      if (branchStatus !== NodeStatus.RUNNING) {
        self.log("Branch completed - resetting condition check flag");
        self.conditionEvaluated = false;
        self.selectedBranch = undefined;
      }

      return branchStatus;
    });
  }

  protected onHalt(): void {
    this.log("Halting - resetting condition check flag");
    this.conditionEvaluated = false;
    this.selectedBranch = undefined;
    super.onHalt();
  }

  protected onReset(): void {
    this.log("Resetting - clearing condition check flag");
    this.conditionEvaluated = false;
    this.selectedBranch = undefined;
  }
}
