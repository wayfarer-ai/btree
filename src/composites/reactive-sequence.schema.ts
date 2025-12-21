/**
 * ReactiveSequence composite configuration schema
 */

import { z } from "zod";
import { nodeConfigurationSchema } from "../schemas/base.schema.js";

/**
 * Schema for ReactiveSequence composite configuration
 * Uses base schema only (no additional properties)
 */
export const reactiveSequenceConfigurationSchema = nodeConfigurationSchema;

/**
 * Validated ReactiveSequence configuration type
 */
export type ValidatedReactiveSequenceConfiguration = z.infer<
  typeof reactiveSequenceConfigurationSchema
>;
