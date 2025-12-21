/**
 * SubTree composite configuration schema
 */

import { z } from "zod";
import { createNodeSchema, validations } from "../schemas/base.schema.js";

/**
 * Schema for SubTree composite configuration
 * Validates treeId reference
 */
export const subTreeConfigurationSchema = createNodeSchema("SubTree", {
  treeId: validations.treeId,
});

/**
 * Validated SubTree configuration type
 */
export type ValidatedSubTreeConfiguration = z.infer<
  typeof subTreeConfigurationSchema
>;
