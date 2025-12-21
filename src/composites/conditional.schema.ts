/**
 * Conditional composite configuration schema
 */

import { z } from "zod";
import { nodeConfigurationSchema } from "../schemas/base.schema.js";

/**
 * Schema for Conditional composite configuration
 * Uses base schema only - condition logic is in child nodes
 */
export const conditionalConfigurationSchema = nodeConfigurationSchema;

/**
 * Validated Conditional configuration type
 */
export type ValidatedConditionalConfiguration = z.infer<
  typeof conditionalConfigurationSchema
>;
