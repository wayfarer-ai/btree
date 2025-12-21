/**
 * Registry for behavior tree nodes
 * Handles registration and creation of nodes by type
 */

import type { BehaviorTree } from "./behavior-tree.js";
import type {
  NodeConfiguration,
  NodeConstructor,
  NodeMetadata,
  TreeNode,
} from "./types.js";
import { z } from "zod";
import {
  schemaRegistry,
  validateConfiguration,
  treeDefinitionSchema,
  type TreeDefinition,
} from "./schemas/index.js";

/**
 * Entry for a registered BehaviorTree with metadata
 */
interface TreeEntry {
  tree: BehaviorTree;
  sourceFile: string;
}

export class Registry {
  private nodeTypes: Map<string, NodeConstructor> = new Map();
  private nodeMetadata: Map<string, NodeMetadata> = new Map();
  private behaviorTrees: Map<string, TreeEntry> = new Map();

  constructor() {
    this.log("Registry created");
  }

  /**
   * Register a node type with the registry
   */
  register<T extends TreeNode>(
    type: string,
    ctor: NodeConstructor<T>,
    metadata?: Partial<NodeMetadata>,
  ): void {
    if (this.nodeTypes.has(type)) {
      throw new Error(`Node type '${type}' is already registered`);
    }

    this.nodeTypes.set(type, ctor);

    // Store metadata
    const fullMetadata: NodeMetadata = {
      type,
      category: metadata?.category || "action",
      description: metadata?.description,
      ports: metadata?.ports || [],
    };

    this.nodeMetadata.set(type, fullMetadata);
    this.log(`Registered node type: ${type} (${fullMetadata.category})`);
  }

  /**
   * Create a node instance by type
   * Validates configuration against schema before creating node
   */
  create(type: string, config: NodeConfiguration): TreeNode {
    const Constructor = this.nodeTypes.get(type);

    if (!Constructor) {
      throw new Error(
        `Unknown node type: '${type}'. Available types: ${this.getRegisteredTypes().join(", ")}`,
      );
    }

    // Validate configuration using schema registry
    const validatedConfig = validateConfiguration<NodeConfiguration>(
      schemaRegistry.getSchema(type) as z.ZodSchema<NodeConfiguration>,
      config,
      type,
      config.id,
    );

    this.log(`Creating node of type: ${type} with id: ${validatedConfig.id}`);
    return new Constructor(validatedConfig);
  }

  /**
   * Check if a node type is registered
   */
  has(type: string): boolean {
    return this.nodeTypes.has(type);
  }

  /**
   * Get metadata for a node type
   */
  getMetadata(type: string): NodeMetadata | undefined {
    return this.nodeMetadata.get(type);
  }

  /**
   * Get all registered node types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.nodeTypes.keys());
  }

  /**
   * Get registered types by category
   */
  getTypesByCategory(category: NodeMetadata["category"]): string[] {
    const types: string[] = [];

    for (const [type, metadata] of this.nodeMetadata) {
      if (metadata.category === category) {
        types.push(type);
      }
    }

    return types;
  }

  /**
   * Clear all registrations (node types, metadata, and behavior trees)
   */
  clear(): void {
    this.nodeTypes.clear();
    this.nodeMetadata.clear();
    this.behaviorTrees.clear();
    this.log("Registry cleared (nodes and trees)");
  }

  /**
   * Register a behavior tree instance with source file metadata.
   * Used for reusable trees like elements, step groups, and test cases.
   *
   * @param id Unique identifier for the tree
   * @param tree BehaviorTree instance to register
   * @param sourceFile Path to the source .sigma file
   * @throws Error if a tree with the same ID is already registered
   */
  registerTree(id: string, tree: BehaviorTree, sourceFile: string): void {
    if (this.behaviorTrees.has(id)) {
      throw new Error(`Behavior tree '${id}' is already registered`);
    }
    this.behaviorTrees.set(id, { tree, sourceFile });
    this.log(`Registered behavior tree: ${id}`);
  }

  /**
   * Unregister a behavior tree by ID.
   * Useful for cleanup in long-running processes or tests.
   *
   * @param id Tree ID to unregister
   * @returns true if tree was found and removed, false otherwise
   */
  unregisterTree(id: string): boolean {
    const deleted = this.behaviorTrees.delete(id);
    if (deleted) {
      this.log(`Unregistered behavior tree: ${id}`);
    }
    return deleted;
  }

  /**
   * Replace an existing behavior tree registration.
   * If the tree doesn't exist, it will be registered as new.
   *
   * @param id Tree ID to replace
   * @param tree New BehaviorTree instance
   * @param sourceFile Path to the source .sigma file
   */
  replaceTree(id: string, tree: BehaviorTree, sourceFile: string): void {
    const existed = this.behaviorTrees.has(id);
    this.behaviorTrees.set(id, { tree, sourceFile });
    this.log(`${existed ? "Replaced" : "Registered"} behavior tree: ${id}`);
  }

  /**
   * Get a behavior tree instance by ID
   */
  getTree(id: string): BehaviorTree | undefined {
    return this.behaviorTrees.get(id)?.tree;
  }

  /**
   * Get the source file path for a behavior tree
   */
  getTreeSourceFile(id: string): string | undefined {
    return this.behaviorTrees.get(id)?.sourceFile;
  }

  /**
   * Get all trees that belong to a specific source file
   */
  getTreesForFile(filePath: string): Map<string, BehaviorTree> {
    const result = new Map<string, BehaviorTree>();
    for (const [id, entry] of this.behaviorTrees) {
      if (entry.sourceFile === filePath) {
        result.set(id, entry.tree);
      }
    }
    return result;
  }

  /**
   * Check if a behavior tree is registered
   */
  hasTree(id: string): boolean {
    return this.behaviorTrees.has(id);
  }

  /**
   * Clone a registered behavior tree for instantiation
   * Returns the cloned BehaviorTree (caller should use getRoot() for TreeNode)
   */
  cloneTree(id: string): BehaviorTree {
    const entry = this.behaviorTrees.get(id);
    if (!entry) {
      throw new Error(
        `Behavior tree '${id}' not found. Available trees: ${this.getAllTreeIds().join(", ") || "none"}`,
      );
    }
    this.log(`Cloning behavior tree: ${id}`);
    return entry.tree.clone();
  }

  /**
   * Get all registered behavior tree IDs
   */
  getAllTreeIds(): string[] {
    return Array.from(this.behaviorTrees.keys());
  }

  /**
   * Clear all registered behavior trees
   */
  clearTrees(): void {
    this.behaviorTrees.clear();
    this.log("Cleared all behavior trees");
  }

  /**
   * Create a tree from a JSON definition
   * Validates tree structure before creating nodes
   */
  createTree(definition: unknown): TreeNode {
    // Validate tree definition structure
    const validatedDef = treeDefinitionSchema.parse(definition) as TreeDefinition;

    if (!validatedDef.type) {
      throw new Error("Node definition must have a type");
    }

    // Create the node configuration
    const config: NodeConfiguration = {
      id: validatedDef.id || `${validatedDef.type}_${Date.now()}`,
      name: validatedDef.name || validatedDef.id,
      ...validatedDef.props,
    };

    // Create node with validated configuration (uses schema validation)
    const node = this.create(validatedDef.type, config);

    // Handle children for composite/decorator nodes
    if (validatedDef.children && Array.isArray(validatedDef.children)) {
      if ("setChild" in node && typeof node.setChild === "function") {
        // Decorator node - single child
        if (validatedDef.children.length !== 1) {
          throw new Error(
            `Decorator ${validatedDef.type} must have exactly one child`,
          );
        }
        const child = this.createTree(validatedDef.children[0]);
        (node as { setChild: (child: TreeNode) => void }).setChild(child);
      } else if (
        "addChildren" in node &&
        typeof node.addChildren === "function"
      ) {
        // Composite node - multiple children
        const children = validatedDef.children.map((childDef) =>
          this.createTree(childDef),
        );
        (node as { addChildren: (children: TreeNode[]) => void }).addChildren(
          children,
        );
      }
    }

    return node;
  }

  /**
   * Safe tree creation that returns success/error result
   * Useful for user-facing tools that need graceful error handling
   *
   * @param definition - Tree definition to create
   * @returns Success result with tree or failure result with error
   *
   * @example
   * ```typescript
   * const result = registry.safeCreateTree({
   *   type: 'Sequence',
   *   id: 'root',
   *   children: [...]
   * });
   *
   * if (result.success) {
   *   console.log('Tree created:', result.tree);
   * } else {
   *   console.error('Failed:', result.error.message);
   * }
   * ```
   */
  safeCreateTree(
    definition: unknown,
  ): { success: true; tree: TreeNode } | { success: false; error: Error } {
    try {
      const tree = this.createTree(definition);
      return { success: true, tree };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private log(message: string): void {
    console.log(`[Registry] ${message}`);
  }
}
