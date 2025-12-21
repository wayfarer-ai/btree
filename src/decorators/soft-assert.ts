/**
 * SoftAssert decorator - Continue even if child fails
 */

import { DecoratorNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type TemporalContext, NodeStatus } from "../types.js";
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

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    checkSignal(context.signal);

    if (!this.child) {
      throw new ConfigurationError("SoftAssert requires a child");
    }

    const result = await this.child.tick(context);

    if (result === NodeStatus.FAILURE) {
      // Log failure
      const failure = {
        timestamp: Date.now(),
        message: `Soft assertion failed: ${this.child.name}`,
      };
      this.failures.push(failure);

      this.log(`Soft assertion failed (continuing): ${this.child.name}`);

      // Convert FAILURE to SUCCESS
      this._status = NodeStatus.SUCCESS;
      return NodeStatus.SUCCESS;
    }

    // Propagate SUCCESS or RUNNING as-is
    this._status = result;
    return result;
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
