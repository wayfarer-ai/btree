/**
 * Recovery node - Try-catch-finally error handling
 */

import { CompositeNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import { type TemporalContext, NodeStatus, type TreeNode } from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

/**
 * Recovery implements try-catch-finally error handling for behavior trees.
 * Structure:
 * - First child = try branch
 * - Second child (optional) = catch branch
 * - Third child (optional) = finally branch
 *
 * Behavior:
 * - If try succeeds or returns RUNNING, use its result
 * - If try returns FAILURE and catch exists, execute catch branch
 * - Finally branch always executes (if present) after try/catch completes
 * - Finally branch result does not affect the overall result
 *
 * Special error handling:
 * - ConfigurationError and OperationCancelledError propagate immediately
 * - When these special errors occur, finally branch does NOT execute
 * - This differs from traditional finally semantics but is intentional:
 *   ConfigurationError means the test is broken, so execution stops immediately
 */
export class Recovery extends CompositeNode {
  private tryBranch?: TreeNode;
  private catchBranch?: TreeNode;
  private finallyBranch?: TreeNode;

  addChild(child: TreeNode): void {
    if (!this.tryBranch) {
      this.tryBranch = child;
      this._children.push(child);
      child.parent = this;
    } else if (!this.catchBranch) {
      this.catchBranch = child;
      this._children.push(child);
      child.parent = this;
    } else if (!this.finallyBranch) {
      this.finallyBranch = child;
      this._children.push(child);
      child.parent = this;
    } else {
      throw new ConfigurationError(
        "Recovery can have maximum 3 children (try, catch, finally)",
      );
    }
  }

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // Check for cancellation before starting try-catch-finally
    checkSignal(context.signal);

    if (!this.tryBranch) {
      throw new ConfigurationError("Recovery requires at least a try branch");
    }

    // Execute try branch and determine result
    this.log("Executing try branch");
    const tryResult = await this.tryBranch.tick(context);

    // Determine the main result (from try or catch)
    let mainResult: NodeStatus;

    if (tryResult === NodeStatus.FAILURE && this.catchBranch) {
      // Try failed and we have a catch branch - execute it
      this.log("Try branch failed - executing catch branch");
      mainResult = await this.catchBranch.tick(context);
    } else {
      // Try succeeded, running, or no catch branch
      mainResult = tryResult;
    }

    // Always execute finally branch if it exists
    // Finally branch should not affect the main result (unless it throws ConfigurationError/OperationCancelledError)
    if (this.finallyBranch) {
      this.log("Executing finally branch");
      // Execute finally and ignore its status (but let special errors propagate)
      await this.finallyBranch.tick(context);
      this.log("Finally branch completed");
    }

    this._status = mainResult;
    return mainResult;
  }
}