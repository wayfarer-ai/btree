/**
 * Validation utilities and error conversion
 * Converts Zod validation errors to ConfigurationError
 */

import { z } from "zod";
import { ConfigurationError } from "../errors.js";

/**
 * Convert Zod validation errors to ConfigurationError
 * Preserves detailed error context and provides helpful hints
 *
 * @param error - Zod validation error
 * @param nodeType - Type of node being validated
 * @param nodeId - Optional node ID for context
 * @returns ConfigurationError with formatted message
 */
export function zodErrorToConfigurationError(
  error: z.ZodError<unknown>,
  nodeType: string,
  nodeId?: string,
): ConfigurationError {
  const nodeIdentifier = nodeId ? `${nodeType}:${nodeId}` : nodeType;

  // Format Zod errors into readable message
  const issues = error.issues
    .map((issue: z.ZodIssue) => {
      const path = issue.path.join(".");
      return `  - ${path ? path + ": " : ""}${issue.message}`;
    })
    .join("\n");

  const message = `Invalid configuration for ${nodeIdentifier}:\n${issues}`;

  // Include hint for common fixes
  const hint =
    "Check the node configuration and ensure all required fields are provided with valid values.";

  return new ConfigurationError(message, hint);
}

/**
 * Validate and parse configuration with ConfigurationError conversion
 * Throws ConfigurationError if validation fails
 *
 * @param schema - Zod schema to validate against
 * @param config - Configuration object to validate
 * @param nodeType - Type of node being validated
 * @param nodeId - Optional node ID for error context
 * @returns Validated and parsed configuration
 * @throws ConfigurationError if validation fails
 *
 * @example
 * ```typescript
 * const validatedConfig = validateConfiguration(
 *   timeoutSchema,
 *   { id: 'test', timeoutMs: 1000 },
 *   'Timeout',
 *   'test'
 * );
 * ```
 */
export function validateConfiguration<T = unknown>(
  schema: z.ZodSchema<T>,
  config: unknown,
  nodeType: string,
  nodeId?: string,
): T {
  try {
    return schema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw zodErrorToConfigurationError(error, nodeType, nodeId);
    }
    throw error;
  }
}

/**
 * Safe validation that returns result instead of throwing
 * Useful for user-facing tools that need graceful error handling
 *
 * @param schema - Zod schema to validate against
 * @param config - Configuration object to validate
 * @param nodeType - Type of node being validated (for error messages)
 * @param nodeId - Optional node ID for error context
 * @returns Success result with data or failure result with error
 *
 * @example
 * ```typescript
 * const result = safeValidateConfiguration(
 *   timeoutSchema,
 *   { id: 'test', timeoutMs: -100 },
 *   'Timeout'
 * );
 *
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function safeValidateConfiguration<T>(
  schema: z.ZodSchema<T>,
  config: unknown,
  nodeType: string,
  nodeId?: string,
):
  | { success: true; data: T }
  | { success: false; error: ConfigurationError } {
  const result = schema.safeParse(config);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return {
      success: false,
      error: zodErrorToConfigurationError(result.error, nodeType, nodeId),
    };
  }
}
