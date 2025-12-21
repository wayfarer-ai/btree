/**
 * Delay decorator configuration schema
 */

import { z } from "zod";
import { createNodeSchema, validations } from "../schemas/base.schema.js";

/**
 * Schema for Delay decorator configuration
 * Validates that delayMs is non-negative (can be 0)
 */
export const delayConfigurationSchema = createNodeSchema("Delay", {
  delayMs: validations.nonNegativeNumber("delayMs"),
});

/**
 * Validated Delay configuration type
 */
export type ValidatedDelayConfiguration = z.infer<
  typeof delayConfigurationSchema
>;
