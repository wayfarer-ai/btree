/**
 * Tree definition schemas
 * Validates the structure of tree definitions before node creation
 */

import { z } from "zod";

/**
 * Tree definition type
 * Matches the format expected by Registry.createTree()
 */
export interface TreeDefinition {
  type: string;
  id?: string;
  name?: string;
  props?: Record<string, unknown>;
  children?: TreeDefinition[];
}

/**
 * Recursive schema for tree definitions
 * Supports nested children and arbitrary props
 *
 * Validates:
 * - type is a non-empty string
 * - id is optional string
 * - name is optional string
 * - props is optional record of unknown values
 * - children is optional array of tree definitions
 */
const treeDefSchemaObject = z.object({
  type: z.string().min(1, "Node type is required"),
  id: z.string().optional(),
  name: z.string().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  children: z
    .array(
      z.lazy(() => treeDefinitionSchema) as z.ZodType<TreeDefinition>,
    )
    .optional(),
});

export const treeDefinitionSchema: z.ZodType<TreeDefinition> =
  treeDefSchemaObject;

/**
 * Validate tree definition structure (without type-specific validation)
 * Type-specific validation happens in Registry.create()
 *
 * @param definition - Tree definition to validate
 * @returns Validated tree definition
 * @throws ZodError if structure is invalid
 *
 * @example
 * ```typescript
 * const definition = validateTreeDefinition({
 *   type: 'Sequence',
 *   id: 'root',
 *   children: [
 *     { type: 'PrintAction', id: 'action1' }
 *   ]
 * });
 * ```
 */
export function validateTreeDefinition(definition: unknown): TreeDefinition {
  return treeDefinitionSchema.parse(definition) as TreeDefinition;
}

/**
 * Validate decorator has exactly one child
 *
 * @param nodeType - Type of the decorator node
 * @param children - Children array to validate
 * @throws Error if child count is not exactly 1
 */
export function validateDecoratorChildren(
  nodeType: string,
  children?: TreeDefinition[],
): void {
  const childCount = children?.length || 0;
  if (childCount !== 1) {
    throw new Error(
      `Decorator ${nodeType} must have exactly one child (got ${childCount})`,
    );
  }
}

/**
 * Validate composite has at least minimum children
 *
 * @param nodeType - Type of the composite node
 * @param children - Children array to validate
 * @param minChildren - Minimum required children (default: 0)
 * @throws Error if child count is less than minimum
 */
export function validateCompositeChildren(
  nodeType: string,
  children?: TreeDefinition[],
  minChildren: number = 0,
): void {
  const count = children?.length || 0;
  if (count < minChildren) {
    throw new Error(
      `Composite ${nodeType} requires at least ${minChildren} children (got ${count})`,
    );
  }
}

/**
 * Validate specific child count for composites with fixed requirements
 *
 * @param nodeType - Type of the composite node
 * @param children - Children array to validate
 * @param expectedCount - Exact number of expected children
 * @throws Error if child count doesn't match expected
 *
 * @example
 * ```typescript
 * // While node requires exactly 2 children (condition, body)
 * validateChildCount('While', children, 2);
 * ```
 */
export function validateChildCount(
  nodeType: string,
  children?: TreeDefinition[],
  expectedCount: number = 0,
): void {
  const count = children?.length || 0;
  if (count !== expectedCount) {
    throw new Error(
      `${nodeType} requires exactly ${expectedCount} children (got ${count})`,
    );
  }
}

/**
 * Validate child count range for composites with flexible requirements
 *
 * @param nodeType - Type of the composite node
 * @param children - Children array to validate
 * @param minChildren - Minimum required children
 * @param maxChildren - Maximum allowed children
 * @throws Error if child count is outside range
 *
 * @example
 * ```typescript
 * // Conditional node requires 2-3 children (condition, then, optional else)
 * validateChildCountRange('Conditional', children, 2, 3);
 * ```
 */
export function validateChildCountRange(
  nodeType: string,
  children?: TreeDefinition[],
  minChildren: number = 0,
  maxChildren?: number,
): void {
  const count = children?.length || 0;

  if (count < minChildren) {
    throw new Error(
      `${nodeType} requires at least ${minChildren} children (got ${count})`,
    );
  }

  if (maxChildren !== undefined && count > maxChildren) {
    throw new Error(
      `${nodeType} allows at most ${maxChildren} children (got ${count})`,
    );
  }
}
