/**
 * ForceSuccess and ForceFailure decorators
 * Always return specific result regardless of child
 */

import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

/**
 * ForceSuccess always returns SUCCESS regardless of child result.
 * Useful for ensuring a branch always succeeds.
 */
export class ForceSuccess extends DecoratorNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    checkSignal(context.signal);

    if (!this.child) {
      throw new ConfigurationError("ForceSuccess requires a child");
    }

    // Tick child and check status
    const childStatus = await this.child.tick(context);

    // Propagate RUNNING status - only force result when child completes
    if (childStatus === NodeStatus.RUNNING) {
      this._status = NodeStatus.RUNNING;
      return NodeStatus.RUNNING;
    }

    // Force SUCCESS regardless of child result (SUCCESS or FAILURE)
    this._status = NodeStatus.SUCCESS;
    return NodeStatus.SUCCESS;
  }
}

/**
 * ForceFailure always returns FAILURE regardless of child result.
 * Useful for negation or testing.
 */
export class ForceFailure extends DecoratorNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    checkSignal(context.signal);

    if (!this.child) {
      throw new ConfigurationError("ForceFailure requires a child");
    }

    // Tick child and check status
    const childStatus = await this.child.tick(context);

    // Propagate RUNNING status - only force result when child completes
    if (childStatus === NodeStatus.RUNNING) {
      this._status = NodeStatus.RUNNING;
      return NodeStatus.RUNNING;
    }

    // Force FAILURE regardless of child result (SUCCESS or FAILURE)
    this._status = NodeStatus.FAILURE;
    return NodeStatus.FAILURE;
  }
}
