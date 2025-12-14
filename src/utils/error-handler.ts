/**
 * Centralized error handling for behavior tree nodes
 */

import * as Effect from "effect/Effect";
import { ConfigurationError } from "../errors.js";
import { OperationCancelledError } from "./signal-check.js";
import { NodeStatus } from "../types.js";

/**
 * Standard error handler for behavior tree nodes.
 * Re-propagates special errors (ConfigurationError, OperationCancelledError)
 * and converts all other errors to FAILURE status.
 *
 * This function is used by all base node classes to ensure consistent error handling:
 * - ConfigurationError: Test authoring error, propagates immediately
 * - OperationCancelledError: Execution cancelled, propagates for cleanup
 * - All other errors: Converted to NodeStatus.FAILURE
 *
 * @param error - The error to handle
 * @returns Effect that either fails with special errors or succeeds with FAILURE status
 */
export function handleNodeError(
  error: unknown,
): Effect.Effect<NodeStatus, never, never> {
  // Re-propagate ConfigurationError - test is broken, don't mask it
  // These errors indicate test authoring bugs, not operational failures
  if (error instanceof ConfigurationError) {
    return Effect.fail(error) as unknown as Effect.Effect<
      NodeStatus,
      never,
      never
    >;
  }

  // Re-propagate OperationCancelledError - execution was cancelled
  // This allows cancellation to be detected at higher levels while still
  // setting the node status to FAILURE
  if (error instanceof OperationCancelledError) {
    return Effect.fail(error) as unknown as Effect.Effect<
      NodeStatus,
      never,
      never
    >;
  }

  // All other errors convert to FAILURE status
  return Effect.succeed(NodeStatus.FAILURE);
}
