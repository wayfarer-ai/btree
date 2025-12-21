/**
 * StepGroup node - References and executes a behavior tree from the session-scoped registry
 * Provides function-like reusability for step groups with scoped blackboard isolation
 */

import { ActionNode } from "../base-node.js";
import type { TreeNode } from "../types.js";
import {
  type TemporalContext,
  type NodeConfiguration,
  NodeStatus,
} from "../types.js";
import { checkSignal } from "../utils/signal-check.js";

export interface SubTreeConfiguration extends NodeConfiguration {
  treeId: string; // BehaviorTree ID to look up from registry
}

/**
 * SubTree - References and executes a behavior tree from the registry
 *
 * Execution flow:
 * 1. Clone behavior tree from registry (lazy, on first tick)
 * 2. Create scoped blackboard for isolation (subtree_${id})
 * 3. Execute cloned tree with scoped context
 * 4. Return the tree's execution status
 *
 * The scoped blackboard provides isolation while maintaining read access to parent scopes.
 */
export class SubTree extends ActionNode {
  private treeId: string;
  private clonedTree?: TreeNode; // Cached tree instance

  constructor(config: SubTreeConfiguration) {
    super(config);
    this.treeId = config.treeId;
  }

  protected async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // Check for cancellation before starting step group
    checkSignal(context.signal);

    // 1. Clone tree from registry (lazy, only on first tick)
    if (!this.clonedTree) {
      if (!context.treeRegistry.hasTree(this.treeId)) {
        throw new Error(
          `SubTree tree '${this.treeId}' not found in registry. ` +
            `Available trees: ${context.treeRegistry.getAllTreeIds().join(", ") || "none"}`,
        );
      }
      // cloneTree returns BehaviorTree, get the root TreeNode for execution
      const clonedBehaviorTree = context.treeRegistry.cloneTree(this.treeId);
      this.clonedTree = clonedBehaviorTree.getRoot();
      this.log(`Cloned SubTree tree '${this.treeId}' from registry`);
    }

    // 2. Create scoped blackboard for this SubTree
    const subtreeScope = context.blackboard.createScope(`subtree_${this.id}`);
    this.log(`Created scoped blackboard: ${subtreeScope.getFullScopePath()}`);

    // 3. Execute cloned tree with scoped context
    const scopedContext: TemporalContext = {
      ...context,
      blackboard: subtreeScope,
    };

    try {
      this.log(`Executing SubTree tree '${this.treeId}'`);
      const status = await this.clonedTree.tick(scopedContext);

      this.log(
        `SubTree tree '${this.treeId}' completed with status: ${status}`,
      );
      return status;
    } catch (error) {
      this.log(`SubTree tree '${this.treeId}' failed with error: ${error}`);
      throw error;
    }
  }

  /**
   * Override clone to include cloned tree
   */
  clone(): TreeNode {
    const ClonedClass = this.constructor as new (
      config: NodeConfiguration,
    ) => this;
    const cloned = new ClonedClass({ ...this.config });
    // Don't clone the cached tree - let the clone lazy-load its own
    return cloned;
  }

  /**
   * Override halt to halt the referenced tree
   */
  halt(): void {
    super.halt();
    if (this.clonedTree && this.clonedTree.status() === NodeStatus.RUNNING) {
      this.clonedTree.halt();
    }
  }

  /**
   * Override reset to reset the referenced tree
   */
  reset(): void {
    super.reset();
    if (this.clonedTree) {
      this.clonedTree.reset();
    }
  }
}
