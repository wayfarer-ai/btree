/**
 * KeepRunningUntilFailure decorator
 * Opposite of Retry - keeps running while child succeeds
 */

import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

/**
 * KeepRunningUntilFailure keeps executing its child while it succeeds.
 * Returns SUCCESS when child fails (goal achieved).
 * Returns RUNNING while child succeeds (keep going).
 */
export class KeepRunningUntilFailure extends DecoratorNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    checkSignal(context.signal);

    if (!this.child) {
      throw new ConfigurationError(
        "KeepRunningUntilFailure requires a child",
      );
    }

    const result = await this.child.tick(context);

    switch (result) {
      case NodeStatus.SUCCESS:
        this.log("Child succeeded - resetting and continuing");
        this.child.reset();
        this._status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;

      case NodeStatus.FAILURE:
        this.log("Child failed - goal achieved");
        this._status = NodeStatus.SUCCESS;
        return NodeStatus.SUCCESS;

      case NodeStatus.RUNNING:
        this.log("Child is running");
        this._status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;

      default:
        throw new Error(`Unexpected status from child: ${result}`);
    }
  }
}
