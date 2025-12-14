/**
 * KeepRunningUntilFailure decorator
 * Opposite of Retry - keeps running while child succeeds
 */

import * as Effect from "effect/Effect";
import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

/**
 * KeepRunningUntilFailure keeps executing its child while it succeeds.
 * Returns SUCCESS when child fails (goal achieved).
 * Returns RUNNING while child succeeds (keep going).
 */
export class KeepRunningUntilFailure extends DecoratorNode {
  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      yield* _(checkSignal(context.signal));

      if (!self.child) {
        return yield* _(
          Effect.fail(
            new ConfigurationError("KeepRunningUntilFailure requires a child"),
          ),
        );
      }

      const result = yield* _(self.child.tick(context));

      switch (result) {
        case NodeStatus.SUCCESS:
          self.log("Child succeeded - resetting and continuing");
          self.child.reset();
          self._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;

        case NodeStatus.FAILURE:
          self.log("Child failed - goal achieved");
          self._status = NodeStatus.SUCCESS;
          return NodeStatus.SUCCESS;

        case NodeStatus.RUNNING:
          self.log("Child is running");
          self._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;

        default:
          return yield* _(
            Effect.fail(new Error(`Unexpected status from child: ${result}`)),
          );
      }
    });
  }
}
