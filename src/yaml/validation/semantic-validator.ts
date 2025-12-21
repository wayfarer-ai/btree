/**
 * Semantic validation (Stage 4)
 * Validates semantic rules like ID uniqueness, circular references, etc.
 */

import type { Registry } from "../../registry.js";
import type { TreeDefinition } from "../../schemas/tree-definition.schema.js";
import { SemanticValidationError } from "../errors.js";

/**
 * Semantic validator for tree definitions
 * Validates cross-node rules that can't be expressed in schemas
 */
class SemanticValidator {
  /**
   * Validate semantic rules for a tree definition
   *
   * @param definition - Tree definition to validate
   * @param registry - Registry to check node types and tree references
   * @returns Array of validation errors (empty if valid)
   */
  validate(definition: TreeDefinition, registry: Registry): SemanticValidationError[] {
    const errors: SemanticValidationError[] = [];

    // Track IDs for uniqueness checking
    const seenIds = new Set<string>();

    // Track SubTree references for circular dependency detection
    const subTreePath: string[] = [];

    // Recursive validation
    this.validateNode(definition, registry, seenIds, subTreePath, "", errors);

    return errors;
  }

  /**
   * Recursively validate a node and its children
   */
  private validateNode(
    node: TreeDefinition,
    registry: Registry,
    seenIds: Set<string>,
    subTreePath: string[],
    path: string,
    errors: SemanticValidationError[],
  ): void {
    const nodePath = path ? `${path}.${node.id || node.type}` : node.id || node.type;

    // Validate node type exists in registry
    if (!registry.has(node.type)) {
      errors.push(
        new SemanticValidationError(
          `Unknown node type '${node.type}'`,
          nodePath,
          `Available types: ${registry.getRegisteredTypes().join(", ")}`,
        ),
      );
      return; // Can't continue validation without valid type
    }

    // Validate ID uniqueness
    if (node.id) {
      if (seenIds.has(node.id)) {
        errors.push(
          new SemanticValidationError(
            `Duplicate ID '${node.id}'`,
            nodePath,
            "Use unique IDs for each node in the tree",
          ),
        );
      } else {
        seenIds.add(node.id);
      }
    }

    // Validate SubTree references for circular dependencies
    if (node.type === "SubTree") {
      const treeId = (node.props?.treeId as string) || "";

      if (!treeId) {
        errors.push(
          new SemanticValidationError(
            "SubTree node missing 'treeId' property",
            nodePath,
            "Specify which tree to reference with 'treeId' in props",
          ),
        );
      } else {
        // Check for circular reference
        if (subTreePath.includes(treeId)) {
          errors.push(
            new SemanticValidationError(
              `Circular SubTree reference detected: ${subTreePath.join(" -> ")} -> ${treeId}`,
              nodePath,
              "Remove circular tree references",
            ),
          );
        }

        // Check if referenced tree exists (if registry has tree lookup)
        if (registry.hasTree && !registry.hasTree(treeId)) {
          errors.push(
            new SemanticValidationError(
              `SubTree references unknown tree '${treeId}'`,
              nodePath,
              `Register the tree '${treeId}' before referencing it`,
            ),
          );
        }
      }
    }

    // Validate children based on node category
    const metadata = registry.getMetadata(node.type);
    if (metadata) {
      if (metadata.category === "decorator") {
        // Decorators must have exactly 1 child
        const childCount = node.children?.length || 0;
        if (childCount !== 1) {
          errors.push(
            new SemanticValidationError(
              `Decorator '${node.type}' must have exactly 1 child (has ${childCount})`,
              nodePath,
              "Decorators wrap a single child node",
            ),
          );
        }
      }

      // Some composites have specific child requirements
      if (node.type === "While") {
        const childCount = node.children?.length || 0;
        if (childCount !== 2) {
          errors.push(
            new SemanticValidationError(
              `While node requires exactly 2 children: condition and body (has ${childCount})`,
              nodePath,
              "First child is the condition, second is the body to execute",
            ),
          );
        }
      }

      if (node.type === "Conditional") {
        const childCount = node.children?.length || 0;
        if (childCount < 2 || childCount > 3) {
          errors.push(
            new SemanticValidationError(
              `Conditional node requires 2-3 children: condition, then, optional else (has ${childCount})`,
              nodePath,
              "First child is condition, second is 'then' branch, third is optional 'else' branch",
            ),
          );
        }
      }

      if (node.type === "ForEach") {
        const childCount = node.children?.length || 0;
        if (childCount === 0) {
          errors.push(
            new SemanticValidationError(
              "ForEach node requires at least 1 child (the body to execute for each item)",
              nodePath,
              "Add a child node to execute for each item in the collection",
            ),
          );
        }
      }
    }

    // Recursively validate children
    if (node.children && Array.isArray(node.children)) {
      const newSubTreePath =
        node.type === "SubTree" && node.props?.treeId
          ? [...subTreePath, node.props.treeId as string]
          : subTreePath;

      node.children.forEach((child, index) => {
        this.validateNode(
          child,
          registry,
          seenIds,
          newSubTreePath,
          `${nodePath}.children[${index}]`,
          errors,
        );
      });
    }
  }
}

/**
 * Singleton semantic validator instance
 */
export const semanticValidator = new SemanticValidator();
