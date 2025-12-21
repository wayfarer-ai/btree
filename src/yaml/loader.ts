/**
 * File system integration for YAML loading
 */

import { readFile } from "fs/promises";
import type { Registry } from "../registry.js";
import type { TreeNode } from "../types.js";
import { loadTreeFromYaml, type LoadOptions } from "./parser.js";

/**
 * Load and create tree from YAML file
 *
 * @param filePath - Path to YAML file
 * @param registry - Registry with registered node types
 * @param options - Loading options
 * @returns Created tree node
 * @throws ValidationError if validation fails
 * @throws Error if file cannot be read
 *
 * @example
 * ```typescript
 * const tree = await loadTreeFromFile('./workflows/checkout.yaml', registry);
 * ```
 */
export async function loadTreeFromFile(
  filePath: string,
  registry: Registry,
  options: LoadOptions = {},
): Promise<TreeNode> {
  try {
    const yamlContent = await readFile(filePath, "utf-8");
    return loadTreeFromYaml(yamlContent, registry, options);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }
}
