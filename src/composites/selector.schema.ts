/**
 * Selector composite configuration schema
 */

import { z } from "zod";
import { nodeConfigurationSchema } from "../schemas/base.schema.js";

/**
 * Schema for Selector composite configuration
 * Uses base schema only (no additional properties)
 */
export const selectorConfigurationSchema = nodeConfigurationSchema;

/**
 * Validated Selector configuration type
 */
export type ValidatedSelectorConfiguration = z.infer<
  typeof selectorConfigurationSchema
>;
