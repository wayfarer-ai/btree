/**
 * RunOnce decorator - Execute child only once per session
 */

import * as Effect from "effect/Effect";
import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

/**
 * RunOnce executes its child only once and caches the result.
 * Subsequent ticks return the cached result without re-executing the child.
 * Useful for initialization or one-time setup operations.
 */
export class RunOnce extends DecoratorNode {
  private hasRun: boolean = false;
  private cachedResult?: NodeStatus;

  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      yield* _(checkSignal(context.signal));

      if (!self.child) {
        return yield* _(
          Effect.fail(new ConfigurationError("RunOnce requires a child")),
        );
      }

      // Return cached result if already executed
      if (self.hasRun) {
        self.log(
          `Already executed, returning cached result: ${self.cachedResult}`,
        );
        if (self.cachedResult === undefined) {
          self._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;
        }
        self._status = self.cachedResult;
        return self.cachedResult;
      }

      // Execute child for the first time
      self.log("First execution - ticking child");
      const result = yield* _(self.child.tick(context));

      // Cache result only if not RUNNING
      if (result !== NodeStatus.RUNNING) {
        self.hasRun = true;
        self.cachedResult = result;
        self.log(`Caching result: ${result}`);
      } else {
        self.log("Child is running - will retry on next tick");
      }

      self._status = result;
      return result;
    });
  }

  protected onReset(): void {
    super.onReset();
    this.hasRun = false;
    this.cachedResult = undefined;
  }
}
