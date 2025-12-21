/**
 * Sequence composite configuration schema
 */

import { z } from "zod";
import { nodeConfigurationSchema } from "../schemas/base.schema.js";

/**
 * Schema for Sequence composite configuration
 * Uses base schema only (no additional properties)
 */
export const sequenceConfigurationSchema = nodeConfigurationSchema;

/**
 * Validated Sequence configuration type
 */
export type ValidatedSequenceConfiguration = z.infer<
  typeof sequenceConfigurationSchema
>;
