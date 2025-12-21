/**
 * RunOnce decorator - Execute child only once per session
 */

import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

/**
 * RunOnce executes its child only once and caches the result.
 * Subsequent ticks return the cached result without re-executing the child.
 * Useful for initialization or one-time setup operations.
 */
export class RunOnce extends DecoratorNode {
  private hasRun: boolean = false;
  private cachedResult?: NodeStatus;

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    checkSignal(context.signal);

    if (!this.child) {
      throw new ConfigurationError("RunOnce requires a child");
    }

    // Return cached result if already executed
    if (this.hasRun) {
      this.log(
        `Already executed, returning cached result: ${this.cachedResult}`,
      );
      if (this.cachedResult === undefined) {
        this._status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;
      }
      this._status = this.cachedResult;
      return this.cachedResult;
    }

    // Execute child for the first time
    this.log("First execution - ticking child");
    const result = await this.child.tick(context);

    // Cache result only if not RUNNING
    if (result !== NodeStatus.RUNNING) {
      this.hasRun = true;
      this.cachedResult = result;
      this.log(`Caching result: ${result}`);
    } else {
      this.log("Child is running - will retry on next tick");
    }

    this._status = result;
    return result;
  }

  protected onReset(): void {
    super.onReset();
    this.hasRun = false;
    this.cachedResult = undefined;
  }
}
