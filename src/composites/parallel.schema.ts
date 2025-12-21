/**
 * Parallel composite configuration schema
 */

import { z } from "zod";
import { createNodeSchema, validations } from "../schemas/base.schema.js";

/**
 * Parallel execution strategy enum
 */
export const parallelStrategySchema = z.enum(["strict", "any"]);

/**
 * Schema for Parallel composite configuration
 * Validates strategy and optional thresholds
 */
export const parallelConfigurationSchema = createNodeSchema("Parallel", {
  strategy: parallelStrategySchema.optional().default("strict"),
  successThreshold: validations.positiveInteger("successThreshold").optional(),
  failureThreshold: validations.positiveInteger("failureThreshold").optional(),
});

/**
 * Validated Parallel configuration type
 */
export type ValidatedParallelConfiguration = z.infer<
  typeof parallelConfigurationSchema
>;
