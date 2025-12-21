/**
 * While composite configuration schema
 */

import { z } from "zod";
import { createNodeSchema, validations } from "../schemas/base.schema.js";

/**
 * Schema for While composite configuration
 * Validates maxIterations with default value
 */
export const whileConfigurationSchema = createNodeSchema("While", {
  maxIterations: validations
    .positiveInteger("maxIterations")
    .optional()
    .default(1000),
});

/**
 * Validated While configuration type
 */
export type ValidatedWhileConfiguration = z.infer<
  typeof whileConfigurationSchema
>;
