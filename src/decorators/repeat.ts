/**
 * Repeat decorator - Execute child N times
 */

import * as Effect from "effect/Effect";
import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import {
  type EffectTickContext,
  type NodeConfiguration,
  NodeStatus,
} from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

export interface RepeatConfiguration extends NodeConfiguration {
  numCycles: number;
}

/**
 * Repeat executes its child exactly N times.
 * Returns SUCCESS when all cycles complete successfully.
 * Returns FAILURE if any cycle fails.
 */
export class Repeat extends DecoratorNode {
  private numCycles: number;
  private currentCycle: number = 0;

  constructor(config: RepeatConfiguration) {
    super(config);
    this.numCycles = config.numCycles;
  }

  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, Error, never> {
    const self = this;

    return Effect.gen(function* (_) {
      yield* _(checkSignal(context.signal));

      if (!self.child) {
        return yield* _(
          Effect.fail(new ConfigurationError("Repeat requires a child")),
        );
      }

      self.log(`Repeat cycle ${self.currentCycle}/${self.numCycles}`);

      // Check if we've completed all cycles
      if (self.currentCycle >= self.numCycles) {
        self.log("All cycles completed");
        self._status = NodeStatus.SUCCESS;
        self.currentCycle = 0; // Reset for next run
        return NodeStatus.SUCCESS;
      }

      // Tick child
      const result = yield* _(self.child.tick(context));

      switch (result) {
        case NodeStatus.SUCCESS:
          self.log(`Cycle ${self.currentCycle} succeeded`);
          self.currentCycle++;

          // Check if more cycles remain
          if (self.currentCycle < self.numCycles) {
            self.child.reset(); // Reset for next cycle
            self._status = NodeStatus.RUNNING;
            return NodeStatus.RUNNING;
          } else {
            // All cycles complete - don't reset after final cycle
            self._status = NodeStatus.SUCCESS;
            self.currentCycle = 0;
            return NodeStatus.SUCCESS;
          }

        case NodeStatus.FAILURE:
          self.log(`Cycle ${self.currentCycle} failed`);
          self._status = NodeStatus.FAILURE;
          self.currentCycle = 0;
          return NodeStatus.FAILURE;

        case NodeStatus.RUNNING:
          self.log(`Cycle ${self.currentCycle} is running`);
          self._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;

        default:
          return yield* _(
            Effect.fail(new Error(`Unexpected status from child: ${result}`)),
          );
      }
    });
  }

  protected onReset(): void {
    super.onReset();
    this.currentCycle = 0;
  }

  protected onHalt(): void {
    super.onHalt();
    this.currentCycle = 0;
  }
}
