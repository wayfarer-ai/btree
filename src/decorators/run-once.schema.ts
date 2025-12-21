/**
 * RunOnce decorator configuration schema
 */

import { z } from "zod";
import { nodeConfigurationSchema } from "../schemas/base.schema.js";

/**
 * Schema for RunOnce decorator configuration
 * Uses base schema only (no additional properties)
 */
export const runOnceConfigurationSchema = nodeConfigurationSchema;

/**
 * Validated RunOnce configuration type
 */
export type ValidatedRunOnceConfiguration = z.infer<
  typeof runOnceConfigurationSchema
>;
