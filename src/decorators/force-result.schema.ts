/**
 * ForceSuccess and ForceFailure decorator configuration schemas
 */

import { z } from "zod";
import { nodeConfigurationSchema } from "../schemas/base.schema.js";

/**
 * Schema for ForceSuccess decorator configuration
 * Uses base schema only (no additional properties)
 */
export const forceSuccessConfigurationSchema = nodeConfigurationSchema;

/**
 * Schema for ForceFailure decorator configuration
 * Uses base schema only (no additional properties)
 */
export const forceFailureConfigurationSchema = nodeConfigurationSchema;

/**
 * Validated ForceSuccess configuration type
 */
export type ValidatedForceSuccessConfiguration = z.infer<
  typeof forceSuccessConfigurationSchema
>;

/**
 * Validated ForceFailure configuration type
 */
export type ValidatedForceFailureConfiguration = z.infer<
  typeof forceFailureConfigurationSchema
>;
