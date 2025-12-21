/**
 * Precondition decorator configuration schema
 */

import { z } from "zod";
import { nodeConfigurationSchema } from "../schemas/base.schema.js";

/**
 * Schema for Precondition decorator configuration
 * Uses base schema only - preconditions are set programmatically via API
 */
export const preconditionConfigurationSchema = nodeConfigurationSchema;

/**
 * Validated Precondition configuration type
 */
export type ValidatedPreconditionConfiguration = z.infer<
  typeof preconditionConfigurationSchema
>;
