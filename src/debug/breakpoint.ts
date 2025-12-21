/**
 * Breakpoint - Pauses execution without failure
 * Returns RUNNING to signal pause (not FAILURE)
 */

import { ActionNode } from "../base-node.js";
import { type TemporalContext, NodeStatus } from "../types.js";

export interface BreakpointConfig {
  id: string;
}

/**
 * Breakpoint pauses execution without marking it as a failure.
 * Returns RUNNING to signal that execution should pause here.
 * The session can then be resumed from this point.
 */
export class Breakpoint extends ActionNode {
  readonly breakpointId: string;

  constructor(config: BreakpointConfig) {
    super({ id: `breakpoint-${config.id}` });
    this.breakpointId = config.id;
  }

  async executeTick(_context: TemporalContext): Promise<NodeStatus> {
    this._status = NodeStatus.RUNNING;
    return NodeStatus.RUNNING;
  }
}