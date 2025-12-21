/**
 * Parallel Execution with Timeout Example
 * Demonstrates concurrent task execution with timeout protection
 */

import {
  BehaviorTree,
  Sequence,
  Parallel,
  Timeout,
  PrintAction,
  MockAction,
  NodeStatus,
  type WorkflowArgs,
  type WorkflowResult,
} from "../../dist/index.js";

/**
 * Workflow that executes multiple tasks in parallel with timeout
 */
export async function parallelTimeoutWorkflow(args: WorkflowArgs): Promise<WorkflowResult> {
  // Create parallel node with strict strategy (wait for all tasks)
  const parallel = new Parallel({
    id: "parallelTasks",
    strategy: "strict",
  });

  // Add concurrent tasks
  parallel.addChild(new PrintAction({ id: "task1", message: "Task 1: Fetching data..." }));
  parallel.addChild(new PrintAction({ id: "task2", message: "Task 2: Processing..." }));
  parallel.addChild(new PrintAction({ id: "task3", message: "Task 3: Validating..." }));

  // Wrap in timeout to prevent hanging
  const timeout = new Timeout({
    id: "timeout",
    timeoutMs: 5000, // 5 second timeout
  });
  timeout.setChild(parallel);

  // Create sequence: timeout -> completion message
  const root = new Sequence({ id: "root" });
  root.addChild(timeout);
  root.addChild(new PrintAction({ id: "complete", message: "All tasks completed successfully!" }));

  const tree = new BehaviorTree(root);
  const workflow = tree.toWorkflow();

  return workflow(args);
}
