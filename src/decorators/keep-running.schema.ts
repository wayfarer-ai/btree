/**
 * KeepRunningUntilFailure decorator configuration schema
 */

import { z } from "zod";
import { nodeConfigurationSchema } from "../schemas/base.schema.js";

/**
 * Schema for KeepRunningUntilFailure decorator configuration
 * Uses base schema only (no additional properties)
 */
export const keepRunningUntilFailureConfigurationSchema =
  nodeConfigurationSchema;

/**
 * Validated KeepRunningUntilFailure configuration type
 */
export type ValidatedKeepRunningUntilFailureConfiguration = z.infer<
  typeof keepRunningUntilFailureConfigurationSchema
>;
