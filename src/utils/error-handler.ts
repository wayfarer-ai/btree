/**
 * Centralized error handling for behavior tree nodes
 */

import { ConfigurationError } from "../errors.js";
import { OperationCancelledError } from "./signal-check.js";
import { NodeStatus } from "../types.js";

/**
 * Standard error handler for behavior tree nodes in Temporal workflows.
 * Re-throws special errors (ConfigurationError, OperationCancelledError)
 * and converts all other errors to FAILURE status.
 *
 * This function is used by all base node classes to ensure consistent error handling:
 * - ConfigurationError: Test authoring error, propagates immediately
 * - OperationCancelledError: Execution cancelled, propagates for cleanup
 * - All other errors: Converted to NodeStatus.FAILURE
 *
 * Usage in base classes:
 * ```typescript
 * try {
 *   const status = await this.executeTick(context);
 *   return status;
 * } catch (error) {
 *   return handleNodeError(error);
 * }
 * ```
 *
 * @param error - The error to handle
 * @returns NodeStatus.FAILURE for normal errors, or throws special errors
 */
export function handleNodeError(error: unknown): NodeStatus {
  // Re-throw ConfigurationError - test is broken, don't mask it
  // These errors indicate test authoring bugs, not operational failures
  if (error instanceof ConfigurationError) {
    throw error;
  }

  // Re-throw OperationCancelledError - execution was cancelled
  // This allows cancellation to be detected at higher levels while still
  // setting the node status to FAILURE
  if (error instanceof OperationCancelledError) {
    throw error;
  }

  // All other errors convert to FAILURE status
  return NodeStatus.FAILURE;
}
