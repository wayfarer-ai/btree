/**
 * SoftAssert decorator - Continue even if child fails
 */

import * as Effect from "effect/Effect";
import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

/**
 * SoftAssert converts child FAILURE to SUCCESS, allowing execution to continue.
 * Logs all failures for later review but doesn't halt execution.
 * Useful for non-critical checks that shouldn't block the test.
 */
export class SoftAssert extends DecoratorNode {
  private failures: Array<{
    timestamp: number;
    message: string;
  }> = [];

  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      yield* _(checkSignal(context.signal));

      if (!self.child) {
        return yield* _(
          Effect.fail(new ConfigurationError("SoftAssert requires a child")),
        );
      }

      const result = yield* _(self.child.tick(context));

      if (result === NodeStatus.FAILURE) {
        // Log failure
        const failure = {
          timestamp: Date.now(),
          message: `Soft assertion failed: ${self.child.name}`,
        };
        self.failures.push(failure);

        self.log(`Soft assertion failed (continuing): ${self.child.name}`);

        // Convert FAILURE to SUCCESS
        self._status = NodeStatus.SUCCESS;
        return NodeStatus.SUCCESS;
      }

      // Propagate SUCCESS or RUNNING as-is
      self._status = result;
      return result;
    });
  }

  /**
   * Get all recorded failures
   */
  getFailures(): Array<{ timestamp: number; message: string }> {
    return [...this.failures];
  }

  /**
   * Check if any assertions have failed
   */
  hasFailures(): boolean {
    return this.failures.length > 0;
  }

  protected onReset(): void {
    super.onReset();
    this.failures = [];
  }
}
