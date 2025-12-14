/**
 * Custom error types for behavior tree execution
 */

/**
 * Error for test configuration/authoring issues.
 * These errors are NOT caught by Selector/Sequence - they propagate up
 * to signal that the test case itself is broken.
 *
 * Examples:
 * - Element reference not found in blackboard
 * - Missing required adapter
 * - Invalid tree structure (decorator without child)
 * - Invalid attribute values (negative timeout)
 *
 * These differ from operational failures (element not visible, timeout exceeded)
 * which should return NodeStatus.FAILURE and can be handled by Selector.
 */
export class ConfigurationError extends Error {
  readonly isConfigurationError = true;

  constructor(
    message: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = "ConfigurationError";

    // Maintains proper stack trace in V8 environments (Chrome, Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigurationError);
    }
  }
}
