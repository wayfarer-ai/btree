/**
 * ForceSuccess and ForceFailure decorators
 * Always return specific result regardless of child
 */

import * as Effect from "effect/Effect";
import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { checkSignal, OperationCancelledError } from "../utils/signal-check.js";

/**
 * ForceSuccess always returns SUCCESS regardless of child result.
 * Useful for ensuring a branch always succeeds.
 */
export class ForceSuccess extends DecoratorNode {
  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      yield* _(checkSignal(context.signal));

      if (!self.child) {
        return yield* _(
          Effect.fail(new ConfigurationError("ForceSuccess requires a child")),
        );
      }

      // Tick child and check status
      const childStatus = yield* _(self.child.tick(context));

      // Propagate RUNNING status - only force result when child completes
      if (childStatus === NodeStatus.RUNNING) {
        self._status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;
      }

      // Force SUCCESS regardless of child result (SUCCESS or FAILURE)
      self._status = NodeStatus.SUCCESS;
      return NodeStatus.SUCCESS;
    }).pipe(
      Effect.catchAll((error) => {
        // Re-throw OperationCancelledError so it propagates to base node's catchAll
        if (error instanceof OperationCancelledError) {
          return Effect.fail(error) as unknown as Effect.Effect<
            NodeStatus,
            never,
            never
          >;
        }
        // Other errors should not happen here, but if they do, convert to FAILURE
        return Effect.succeed(NodeStatus.FAILURE);
      }),
    ) as Effect.Effect<NodeStatus, never, never>;
  }
}

/**
 * ForceFailure always returns FAILURE regardless of child result.
 * Useful for negation or testing.
 */
export class ForceFailure extends DecoratorNode {
  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      yield* _(checkSignal(context.signal));

      if (!self.child) {
        return yield* _(
          Effect.fail(new ConfigurationError("ForceFailure requires a child")),
        );
      }

      // Tick child and check status
      const childStatus = yield* _(self.child.tick(context));

      // Propagate RUNNING status - only force result when child completes
      if (childStatus === NodeStatus.RUNNING) {
        self._status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;
      }

      // Force FAILURE regardless of child result (SUCCESS or FAILURE)
      self._status = NodeStatus.FAILURE;
      return NodeStatus.FAILURE;
    }).pipe(
      Effect.catchAll((error) => {
        // Re-throw OperationCancelledError so it propagates to base node's catchAll
        if (error instanceof OperationCancelledError) {
          return Effect.fail(error) as unknown as Effect.Effect<
            NodeStatus,
            never,
            never
          >;
        }
        // Other errors should not happen here, but if they do, convert to FAILURE
        return Effect.succeed(NodeStatus.FAILURE);
      }),
    ) as Effect.Effect<NodeStatus, never, never>;
  }
}
