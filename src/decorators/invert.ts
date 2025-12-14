/**
 * Invert decorator node
 * Inverts the result of its child (SUCCESS becomes FAILURE and vice versa)
 */

import * as Effect from "effect/Effect";
import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

export class Invert extends DecoratorNode {
  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      yield* _(checkSignal(context.signal));

      if (!self.child) {
        return yield* _(
          Effect.fail(
            new ConfigurationError(`${self.name}: Decorator must have a child`),
          ),
        );
      }

      self.log("Ticking child");
      const childStatus = yield* _(self.child.tick(context));

      switch (childStatus) {
        case NodeStatus.SUCCESS:
          self.log("Child succeeded - returning FAILURE");
          self._status = NodeStatus.FAILURE;
          return NodeStatus.FAILURE;

        case NodeStatus.FAILURE:
          self.log("Child failed - returning SUCCESS");
          self._status = NodeStatus.SUCCESS;
          return NodeStatus.SUCCESS;

        case NodeStatus.RUNNING:
          self.log("Child is running");
          self._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;

        default:
          return childStatus;
      }
    });
  }
}
