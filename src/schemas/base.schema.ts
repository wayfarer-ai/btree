/**
 * Base Zod schemas for node configurations
 * Foundation for all node-specific validation schemas
 */

import { z } from "zod";

/**
 * Base schema for all node configurations
 * Matches NodeConfiguration interface from types.ts
 */
export const nodeConfigurationSchema = z
  .object({
    id: z.string().min(1, "Node ID cannot be empty"),
    name: z.string().optional(),
  })
  .passthrough(); // Allow additional properties for node-specific configs

/**
 * Branded type for validated configurations
 * Ensures runtime type matches compile-time type
 */
export type ValidatedNodeConfiguration = z.infer<
  typeof nodeConfigurationSchema
>;

/**
 * Helper to create node-specific configuration schemas
 * Extends base schema with node-specific fields
 *
 * @param nodeType - Name of the node type for error messages
 * @param fields - Node-specific field definitions
 * @returns Extended Zod schema
 *
 * @example
 * ```typescript
 * const timeoutSchema = createNodeSchema('Timeout', {
 *   timeoutMs: validations.positiveNumber('timeoutMs'),
 * });
 * ```
 */
export function createNodeSchema<T extends z.ZodRawShape>(
  nodeType: string,
  fields: T,
) {
  return nodeConfigurationSchema
    .extend(fields)
    .describe(`${nodeType} configuration`);
}

/**
 * Common validation helpers
 * Reusable validators for standard patterns
 */
export const validations = {
  /**
   * Positive number validator (> 0)
   */
  positiveNumber: (fieldName: string) =>
    z.number().positive(`${fieldName} must be positive`),

  /**
   * Non-negative number validator (>= 0)
   */
  nonNegativeNumber: (fieldName: string) =>
    z.number().nonnegative(`${fieldName} must be non-negative`),

  /**
   * Positive integer validator (> 0, whole number)
   */
  positiveInteger: (fieldName: string) =>
    z.number().int().positive(`${fieldName} must be a positive integer`),

  /**
   * Non-negative integer validator (>= 0, whole number)
   */
  nonNegativeInteger: (fieldName: string) =>
    z
      .number()
      .int()
      .nonnegative(`${fieldName} must be a non-negative integer`),

  /**
   * Blackboard key validator (non-empty string)
   */
  blackboardKey: z.string().min(1, "Blackboard key cannot be empty"),

  /**
   * Tree ID validator (non-empty string for SubTree references)
   */
  treeId: z.string().min(1, "Tree ID cannot be empty"),

  /**
   * Duration in milliseconds validator (non-negative)
   */
  durationMs: (fieldName: string = "duration") =>
    z.number().nonnegative(`${fieldName} must be non-negative milliseconds`),
};

/**
 * Infer TypeScript type from schema
 * Helper for type-safe configuration interfaces
 */
export type InferSchema<T extends z.ZodSchema> = z.infer<T>;
