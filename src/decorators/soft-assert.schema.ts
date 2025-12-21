/**
 * SoftAssert decorator configuration schema
 */

import { z } from "zod";
import { nodeConfigurationSchema } from "../schemas/base.schema.js";

/**
 * Schema for SoftAssert decorator configuration
 * Uses base schema only (no additional properties)
 */
export const softAssertConfigurationSchema = nodeConfigurationSchema;

/**
 * Validated SoftAssert configuration type
 */
export type ValidatedSoftAssertConfiguration = z.infer<
  typeof softAssertConfigurationSchema
>;
