/**
 * MemorySequence composite configuration schema
 */

import { z } from "zod";
import { nodeConfigurationSchema } from "../schemas/base.schema.js";

/**
 * Schema for MemorySequence composite configuration
 * Uses base schema only (no additional properties)
 */
export const memorySequenceConfigurationSchema = nodeConfigurationSchema;

/**
 * Validated MemorySequence configuration type
 */
export type ValidatedMemorySequenceConfiguration = z.infer<
  typeof memorySequenceConfigurationSchema
>;
