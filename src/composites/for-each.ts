/**
 * ForEach node - Iterate over collection
 */

import * as Effect from "effect/Effect";

import { CompositeNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import {
  type EffectTickContext,
  type NodeConfiguration,
  NodeStatus,
} from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

export interface ForEachConfiguration extends NodeConfiguration {
  collectionKey: string; // Blackboard key for array
  itemKey: string; // Blackboard key for current item
  indexKey?: string; // Blackboard key for current index
}

/**
 * ForEach iterates over a collection from the blackboard.
 * For each item, it sets the item (and optionally index) in the blackboard
 * and executes the body (first child).
 */
export class ForEach extends CompositeNode {
  private collectionKey: string;
  private itemKey: string;
  private indexKey?: string;
  private currentIndex: number = 0;

  constructor(config: ForEachConfiguration) {
    super(config);
    this.collectionKey = config.collectionKey;
    this.itemKey = config.itemKey;
    this.indexKey = config.indexKey;
  }

  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      if (self._children.length === 0) {
        return yield* _(
          Effect.fail(
            new ConfigurationError(
              "ForEach requires at least one child (body)",
            ),
          ),
        );
      }

      const body = self._children[0];
      if (!body) {
        return yield* _(
          Effect.fail(
            new ConfigurationError(
              "ForEach requires at least one child (body)",
            ),
          ),
        );
      }
      const collection = context.blackboard.get(self.collectionKey);

      if (!collection) {
        self.log(`Collection '${self.collectionKey}' not found in blackboard`);
        self._status = NodeStatus.FAILURE;
        return NodeStatus.FAILURE;
      }

      if (!Array.isArray(collection)) {
        return yield* _(
          Effect.fail(
            new Error(`Collection '${self.collectionKey}' is not an array`),
          ),
        );
      }

      // Empty collection is success
      if (collection.length === 0) {
        self.log("Collection is empty - returning SUCCESS");
        self._status = NodeStatus.SUCCESS;
        return NodeStatus.SUCCESS;
      }

      self.log(
        `Iterating over collection (${collection.length} items), starting at index ${self.currentIndex}`,
      );

      // Continue from where we left off
      while (self.currentIndex < collection.length) {
        // Check for cancellation before processing each item
        yield* _(checkSignal(context.signal));

        const item = collection[self.currentIndex];

        // Set current item and index in blackboard
        context.blackboard.set(self.itemKey, item);
        if (self.indexKey) {
          context.blackboard.set(self.indexKey, self.currentIndex);
        }

        self.log(
          `Processing item ${self.currentIndex}: ${JSON.stringify(item)}`,
        );
        const bodyStatus = yield* _(body.tick(context));

        switch (bodyStatus) {
          case NodeStatus.SUCCESS:
            self.log(`Item ${self.currentIndex} succeeded`);
            self.currentIndex++;
            body.reset(); // Reset for next iteration
            break;

          case NodeStatus.FAILURE:
            self.log(`Item ${self.currentIndex} failed - ForEach fails`);
            self._status = NodeStatus.FAILURE;
            self.currentIndex = 0; // Reset for next tick
            return NodeStatus.FAILURE;

          case NodeStatus.RUNNING:
            self.log(`Item ${self.currentIndex} is running`);
            self._status = NodeStatus.RUNNING;
            return NodeStatus.RUNNING; // Will resume from this index next tick

          default:
            return yield* _(
              Effect.fail(
                new Error(`Unexpected status from body: ${bodyStatus}`),
              ),
            );
        }
      }

      // All items processed successfully
      self.log("All items processed successfully");
      self._status = NodeStatus.SUCCESS;
      self.currentIndex = 0; // Reset for next tick
      return NodeStatus.SUCCESS;
    });
  }

  protected onReset(): void {
    super.onReset();
    this.currentIndex = 0;
  }

  protected onHalt(): void {
    super.onHalt();
    this.currentIndex = 0;
  }
}