/**
 * Invert decorator configuration schema
 */

import { z } from "zod";
import { nodeConfigurationSchema } from "../schemas/base.schema.js";

/**
 * Schema for Invert decorator configuration
 * Uses base schema only (no additional properties)
 */
export const invertConfigurationSchema = nodeConfigurationSchema;

/**
 * Validated Invert configuration type
 */
export type ValidatedInvertConfiguration = z.infer<
  typeof invertConfigurationSchema
>;
