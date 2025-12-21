/**
 * Timeout decorator configuration schema
 */

import { z } from "zod";
import { createNodeSchema, validations } from "../schemas/base.schema.js";

/**
 * Schema for Timeout decorator configuration
 * Validates that timeoutMs is a positive number
 */
export const timeoutConfigurationSchema = createNodeSchema("Timeout", {
  timeoutMs: validations.positiveNumber("timeoutMs"),
});

/**
 * Validated Timeout configuration type
 */
export type ValidatedTimeoutConfiguration = z.infer<
  typeof timeoutConfigurationSchema
>;
