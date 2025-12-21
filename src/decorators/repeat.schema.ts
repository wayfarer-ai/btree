/**
 * Repeat decorator configuration schema
 */

import { z } from "zod";
import { createNodeSchema, validations } from "../schemas/base.schema.js";

/**
 * Schema for Repeat decorator configuration
 * Validates that numCycles is a positive integer
 */
export const repeatConfigurationSchema = createNodeSchema("Repeat", {
  numCycles: validations.positiveInteger("numCycles"),
});

/**
 * Validated Repeat configuration type
 */
export type ValidatedRepeatConfiguration = z.infer<
  typeof repeatConfigurationSchema
>;
