/**
 * Recovery composite configuration schema
 */

import { z } from "zod";
import { nodeConfigurationSchema } from "../schemas/base.schema.js";

/**
 * Schema for Recovery composite configuration
 * Uses base schema only - try/catch/finally logic is in child structure
 */
export const recoveryConfigurationSchema = nodeConfigurationSchema;

/**
 * Validated Recovery configuration type
 */
export type ValidatedRecoveryConfiguration = z.infer<
  typeof recoveryConfigurationSchema
>;
