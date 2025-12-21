/**
 * Repeat decorator - Execute child N times
 */

import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import {
  type TemporalContext,
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

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    checkSignal(context.signal);

    if (!this.child) {
      throw new ConfigurationError("Repeat requires a child");
    }

    this.log(`Repeat cycle ${this.currentCycle}/${this.numCycles}`);

    // Check if we've completed all cycles
    if (this.currentCycle >= this.numCycles) {
      this.log("All cycles completed");
      this._status = NodeStatus.SUCCESS;
      this.currentCycle = 0; // Reset for next run
      return NodeStatus.SUCCESS;
    }

    // Tick child
    const result = await this.child.tick(context);

    switch (result) {
      case NodeStatus.SUCCESS:
        this.log(`Cycle ${this.currentCycle} succeeded`);
        this.currentCycle++;

        // Check if more cycles remain
        if (this.currentCycle < this.numCycles) {
          this.child.reset(); // Reset for next cycle
          this._status = NodeStatus.RUNNING;
          return NodeStatus.RUNNING;
        } else {
          // All cycles complete - don't reset after final cycle
          this._status = NodeStatus.SUCCESS;
          this.currentCycle = 0;
          return NodeStatus.SUCCESS;
        }

      case NodeStatus.FAILURE:
        this.log(`Cycle ${this.currentCycle} failed`);
        this._status = NodeStatus.FAILURE;
        this.currentCycle = 0;
        return NodeStatus.FAILURE;

      case NodeStatus.RUNNING:
        this.log(`Cycle ${this.currentCycle} is running`);
        this._status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;

      default:
        throw new Error(`Unexpected status from child: ${result}`);
    }
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
