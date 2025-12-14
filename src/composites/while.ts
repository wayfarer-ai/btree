/**
 * While node - Loop while condition is true
 */

import * as Effect from "effect/Effect";

import { CompositeNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import {
  type EffectTickContext,
  type NodeConfiguration,
  NodeStatus,
  type TreeNode,
} from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

export interface WhileConfiguration extends NodeConfiguration {
  maxIterations?: number; // Safety limit
}

/**
 * While loops while the condition returns SUCCESS.
 * Structure:
 * - First child = condition
 * - Second child = body
 */
export class While extends CompositeNode {
  private maxIterations: number;
  private currentIteration: number = 0;
  private condition?: TreeNode;
  private body?: TreeNode;
  private bodyStarted: boolean = false;

  constructor(config: WhileConfiguration) {
    super(config);
    this.maxIterations = config.maxIterations ?? 1000;
  }

  addChild(child: TreeNode): void {
    if (!this.condition) {
      this.condition = child;
      this._children.push(child);
      child.parent = this;
    } else if (!this.body) {
      this.body = child;
      this._children.push(child);
      child.parent = this;
    } else {
      throw new ConfigurationError(
        "While can have maximum 2 children (condition, body)",
      );
    }
  }

  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      if (!self.condition) {
        return yield* _(
          Effect.fail(
            new ConfigurationError("While requires a condition child"),
          ),
        );
      }
      if (!self.body) {
        return yield* _(
          Effect.fail(new ConfigurationError("While requires a body child")),
        );
      }

      self.log(
        `Starting while loop (iteration ${self.currentIteration}/${self.maxIterations})`,
      );

      // Loop while condition is SUCCESS
      while (self.currentIteration < self.maxIterations) {
        // Check for cancellation before each iteration
        yield* _(checkSignal(context.signal));

        // Only check condition if body hasn't started for this iteration
        if (!self.bodyStarted) {
          // Evaluate condition
          self.log(`Evaluating condition (iteration ${self.currentIteration})`);
          const conditionStatus = yield* _(self.condition.tick(context));

          if (conditionStatus === NodeStatus.RUNNING) {
            self.log("Condition is running");
            self._status = NodeStatus.RUNNING;
            return NodeStatus.RUNNING;
          }

          if (conditionStatus === NodeStatus.FAILURE) {
            self.log("Condition failed - exiting loop");
            self._status = NodeStatus.SUCCESS;
            self.currentIteration = 0;
            self.bodyStarted = false;
            return NodeStatus.SUCCESS;
          }

          // Condition succeeded, mark body as started
          self.bodyStarted = true;
        } else {
          self.log(
            `Body already started for iteration ${self.currentIteration} - continuing execution`,
          );
        }

        // Execute body
        self.log(`Executing body (iteration ${self.currentIteration})`);
        const bodyStatus = yield* _(self.body.tick(context));

        switch (bodyStatus) {
          case NodeStatus.SUCCESS:
            self.log("Body succeeded - continuing loop");
            self.currentIteration++;
            self.bodyStarted = false; // Reset for next iteration
            self.condition.reset(); // Reset for next iteration
            self.body.reset();
            break;

          case NodeStatus.FAILURE:
            self.log("Body failed - While fails");
            self._status = NodeStatus.FAILURE;
            self.currentIteration = 0;
            self.bodyStarted = false;
            return NodeStatus.FAILURE;

          case NodeStatus.RUNNING:
            self.log("Body is running");
            self._status = NodeStatus.RUNNING;
            return NodeStatus.RUNNING;

          default:
            return yield* _(
              Effect.fail(
                new Error(`Unexpected status from body: ${bodyStatus}`),
              ),
            );
        }
      }

      // Max iterations reached
      self.log(`Max iterations (${self.maxIterations}) reached`);
      self._status = NodeStatus.FAILURE;
      self.currentIteration = 0;
      self.bodyStarted = false;
      return NodeStatus.FAILURE;
    });
  }

  protected onReset(): void {
    super.onReset();
    this.log("Resetting - clearing body started flag");
    this.currentIteration = 0;
    this.bodyStarted = false;
  }

  protected onHalt(): void {
    super.onHalt();
    this.log("Halting - clearing body started flag");
    this.currentIteration = 0;
    this.bodyStarted = false;
  }
}
