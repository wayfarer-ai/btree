/**
 * Precondition decorator - Check/resolve preconditions before executing child
 */

import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type TemporalContext, NodeStatus, type TreeNode } from "../types.js";
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

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    checkSignal(context.signal);

    if (!this.child) {
      throw new ConfigurationError("Precondition requires a child");
    }

    // Only check preconditions if not already verified
    if (!this.preconditionsChecked) {
      // Check all preconditions
      for (let i = 0; i < this.preconditions.length; i++) {
        checkSignal(context.signal);
        const precond = this.preconditions[i];
        if (!precond) {
          continue;
        }

        this.log(
          `Checking precondition ${i + 1}/${this.preconditions.length}`,
        );
        const conditionResult = await precond.condition.tick(context);

        if (conditionResult === NodeStatus.RUNNING) {
          this.log(`Precondition ${i + 1} is running`);
          this._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;
        }

        if (conditionResult === NodeStatus.FAILURE) {
          this.log(`Precondition ${i + 1} failed`);

          // Try resolver if available
          if (precond.resolver) {
            this.log(`Attempting to resolve precondition ${i + 1}`);
            const resolverResult = await precond.resolver.tick(context);

            if (resolverResult === NodeStatus.RUNNING) {
              this.log(`Resolver ${i + 1} is running`);
              this._status = NodeStatus.RUNNING;
              return NodeStatus.RUNNING;
            }

            if (resolverResult === NodeStatus.SUCCESS) {
              this.log(`Precondition ${i + 1} resolved successfully`);
              // Re-check condition after resolution
              const recheckResult = await precond.condition.tick(context);
              if (recheckResult !== NodeStatus.SUCCESS) {
                if (precond.required) {
                  this.log(
                    `Precondition ${i + 1} still not met after resolution`,
                  );
                  this._status = NodeStatus.FAILURE;
                  return NodeStatus.FAILURE;
                } else {
                  this.log(`Optional precondition ${i + 1} skipped`);
                }
              }
            } else if (precond.required) {
              this.log(`Failed to resolve required precondition ${i + 1}`);
              this._status = NodeStatus.FAILURE;
              return NodeStatus.FAILURE;
            }
          } else if (precond.required) {
            this.log(`Required precondition ${i + 1} not met (no resolver)`);
            this._status = NodeStatus.FAILURE;
            return NodeStatus.FAILURE;
          } else {
            this.log(`Optional precondition ${i + 1} skipped`);
          }
        }
      }

      // Mark preconditions as checked once all pass
      this.preconditionsChecked = true;
      this.log("All preconditions met - executing main child");
    } else {
      this.log("Preconditions already verified - continuing child execution");
    }

    // Execute child
    checkSignal(context.signal);
    const result = await this.child.tick(context);
    this._status = result;

    // Reset flag when child completes
    if (result !== NodeStatus.RUNNING) {
      this.log("Child completed - resetting precondition check flag");
      this.preconditionsChecked = false;
    }

    return result;
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
