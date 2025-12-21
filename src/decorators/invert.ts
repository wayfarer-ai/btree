/**
 * Invert decorator node
 * Inverts the result of its child (SUCCESS becomes FAILURE and vice versa)
 */

import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

export class Invert extends DecoratorNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    checkSignal(context.signal);

    if (!this.child) {
      throw new ConfigurationError(`${this.name}: Decorator must have a child`);
    }

    this.log("Ticking child");
    const childStatus = await this.child.tick(context);

    switch (childStatus) {
      case NodeStatus.SUCCESS:
        this.log("Child succeeded - returning FAILURE");
        this._status = NodeStatus.FAILURE;
        return NodeStatus.FAILURE;

      case NodeStatus.FAILURE:
        this.log("Child failed - returning SUCCESS");
        this._status = NodeStatus.SUCCESS;
        return NodeStatus.SUCCESS;

      case NodeStatus.RUNNING:
        this.log("Child is running");
        this._status = NodeStatus.RUNNING;
        return NodeStatus.RUNNING;

      default:
        return childStatus;
    }
  }
}
