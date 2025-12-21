/**
 * ForEach composite configuration schema
 */

import { z } from "zod";
import { createNodeSchema, validations } from "../schemas/base.schema.js";

/**
 * Schema for ForEach composite configuration
 * Validates collection and item keys
 */
export const forEachConfigurationSchema = createNodeSchema("ForEach", {
  collectionKey: validations.blackboardKey,
  itemKey: validations.blackboardKey,
  indexKey: validations.blackboardKey.optional(),
});

/**
 * Validated ForEach configuration type
 */
export type ValidatedForEachConfiguration = z.infer<
  typeof forEachConfigurationSchema
>;
