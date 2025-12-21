/**
 * Simple Sequence Workflow Example
 * Demonstrates basic behavior tree execution as a Temporal workflow
 */

import { BehaviorTree, Sequence, PrintAction, type WorkflowArgs, type WorkflowResult } from "../../dist/index.js";

/**
 * Simple workflow that executes a sequence of print actions
 */
export async function simpleSequenceWorkflow(args: WorkflowArgs): Promise<WorkflowResult> {
  // Create behavior tree
  const root = new Sequence({ id: "root" });
  root.addChild(new PrintAction({ id: "step1", message: "Starting workflow..." }));
  root.addChild(new PrintAction({ id: "step2", message: "Processing data..." }));
  root.addChild(new PrintAction({ id: "step3", message: "Workflow complete!" }));

  const tree = new BehaviorTree(root);
  const workflow = tree.toWorkflow();

  // Execute
  return workflow(args);
}
