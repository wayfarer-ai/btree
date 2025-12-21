/**
 * YAML parser for behavior tree definitions
 * Implements 4-stage validation pipeline
 */

import * as yaml from "js-yaml";
import type { Registry } from "../registry.js";
import type { TreeNode } from "../types.js";
import type { TreeDefinition } from "../schemas/tree-definition.schema.js";
import {
  YamlSyntaxError,
  StructureValidationError,
  ValidationErrors,
  ValidationError,
} from "./errors.js";
import { treeDefinitionSchema } from "../schemas/tree-definition.schema.js";
import { semanticValidator } from "./validation/semantic-validator.js";

/**
 * Options for YAML loading and validation
 */
export interface LoadOptions {
  /**
   * Enable validation (default: true)
   */
  validate?: boolean;

  /**
   * Fail on first error or collect all errors (default: true - fail fast)
   */
  failFast?: boolean;

  /**
   * Auto-generate IDs for nodes without IDs (default: true)
   */
  autoGenerateIds?: boolean;
}

/**
 * Validation options for validateYaml()
 */
export interface ValidationOptions {
  /**
   * Collect all errors instead of failing fast (default: false)
   */
  collectAllErrors?: boolean;

  /**
   * Check semantic rules like references and circular deps (default: true)
   */
  checkReferences?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: string[];
}

/**
 * Parse YAML string to TreeDefinition
 * Stage 1: YAML Syntax Validation
 *
 * @param yamlString - YAML content to parse
 * @returns Parsed tree definition object
 * @throws YamlSyntaxError if YAML is malformed
 */
export function parseYaml(yamlString: string): TreeDefinition {
  try {
    const parsed = yaml.load(yamlString);

    if (!parsed || typeof parsed !== "object") {
      throw new YamlSyntaxError(
        "Invalid YAML: expected an object",
        undefined,
        undefined,
        "Ensure your YAML defines a tree structure with 'type' field",
      );
    }

    return parsed as TreeDefinition;
  } catch (error) {
    if (error instanceof YamlSyntaxError) {
      throw error;
    }

    // Convert js-yaml errors to our error format
    if (error instanceof yaml.YAMLException) {
      throw new YamlSyntaxError(
        error.message,
        error.mark?.line,
        error.mark?.column,
        "Check YAML syntax (indentation, colons, quotes)",
      );
    }

    throw new YamlSyntaxError(
      `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      undefined,
      "Ensure your YAML is well-formed",
    );
  }
}

/**
 * Validate tree definition structure
 * Stage 2: Structure Validation (using Zod schema)
 *
 * @param definition - Parsed tree definition
 * @throws StructureValidationError if structure is invalid
 */
function validateStructure(definition: unknown): TreeDefinition {
  try {
    return treeDefinitionSchema.parse(definition) as TreeDefinition;
  } catch (error) {
    // Convert Zod errors to StructureValidationError
    throw new StructureValidationError(
      `Invalid tree structure: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      "Ensure all nodes have 'type' field and children are arrays",
    );
  }
}

/**
 * Load and create tree from YAML string
 *
 * @param yamlString - YAML content defining the tree
 * @param registry - Registry with registered node types
 * @param options - Loading options
 * @returns Created tree node
 * @throws ValidationError if validation fails
 *
 * @example
 * ```typescript
 * const yaml = `
 * type: Sequence
 * id: my-seq
 * children:
 *   - type: PrintAction
 *     id: action1
 * `;
 *
 * const tree = loadTreeFromYaml(yaml, registry);
 * ```
 */
export function loadTreeFromYaml(
  yamlString: string,
  registry: Registry,
  options: LoadOptions = {},
): TreeNode {
  const { validate = true, failFast = true, autoGenerateIds = true } = options;

  // Stage 1: Parse YAML syntax
  const parsed = parseYaml(yamlString);

  if (validate) {
    // Stage 2: Validate structure
    const definition = validateStructure(parsed);

    // Stage 3 & 4: Node config and semantic validation happen in Registry.createTree()
    // which calls schema validation for each node
    if (failFast) {
      // Semantic validation
      const semanticErrors = semanticValidator.validate(definition, registry);
      if (semanticErrors.length > 0) {
        if (failFast) {
          throw semanticErrors[0];
        } else {
          throw new ValidationErrors(semanticErrors);
        }
      }
    }

    // Create tree (this validates node configs via schemas)
    return registry.createTree(definition);
  }

  // No validation - directly create tree
  return registry.createTree(parsed);
}

/**
 * Validate YAML without creating tree
 * Useful for editors and validators
 *
 * @param yamlString - YAML content to validate
 * @param registry - Registry with registered node types
 * @param options - Validation options
 * @returns Validation result with errors
 *
 * @example
 * ```typescript
 * const result = validateYaml(yaml, registry);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export function validateYaml(
  yamlString: string,
  registry: Registry,
  options: ValidationOptions = {},
): ValidationResult {
  const { collectAllErrors = false, checkReferences = true } = options;
  const errors: ValidationError[] = [];

  try {
    // Stage 1: Parse YAML
    const parsed = parseYaml(yamlString);

    // Stage 2: Validate structure
    const definition = validateStructure(parsed);

    // Stage 4: Semantic validation
    if (checkReferences) {
      const semanticErrors = semanticValidator.validate(definition, registry);
      errors.push(...semanticErrors);
    }

    // Stage 3: Node config validation (via safe create)
    if (errors.length === 0 || collectAllErrors) {
      const result = registry.safeCreateTree(definition);
      if (!result.success) {
        errors.push(
          new StructureValidationError(
            result.error.message,
            undefined,
            "Check node configurations match their schema requirements",
          ),
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    if (error instanceof ValidationErrors) {
      return {
        valid: false,
        errors: error.errors,
      };
    }

    if (error instanceof ValidationError) {
      errors.push(error);
    } else {
      errors.push(
        new YamlSyntaxError(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }

    return {
      valid: false,
      errors,
    };
  }
}

/**
 * Convert TreeDefinition to YAML string
 *
 * @param definition - Tree definition to convert
 * @returns YAML string representation
 *
 * @example
 * ```typescript
 * const definition = { type: 'Sequence', id: 'root', children: [] };
 * const yamlString = toYaml(definition);
 * ```
 */
export function toYaml(definition: TreeDefinition): string {
  return yaml.dump(definition, {
    indent: 2,
    lineWidth: 80,
    noRefs: true,
  });
}
