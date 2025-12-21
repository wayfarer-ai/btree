/**
 * ResumePoint - Marker node for resume location
 * Always returns SUCCESS, used purely as a findable marker for LLM-based resume
 */

import { ActionNode } from "../base-node.js";
import { type TemporalContext, NodeStatus } from "../types.js";

export interface ResumePointConfig {
  id: string;
}

/**
 * ResumePoint is a marker node that LLM agents can insert to indicate
 * where execution should resume from. It always returns SUCCESS.
 */
export class ResumePoint extends ActionNode {
  readonly resumePointId: string;

  constructor(config: ResumePointConfig) {
    super({ id: `resume-point-${config.id}` });
    this.resumePointId = config.id;
  }

  async executeTick(_context: TemporalContext): Promise<NodeStatus> {
    this._status = NodeStatus.SUCCESS;
    return NodeStatus.SUCCESS;
  }
}
