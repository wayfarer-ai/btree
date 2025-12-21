/**
 * Retry with Backoff Example
 * Demonstrates retry logic with exponential backoff
 */

import {
  BehaviorTree,
  Sequence,
  RetryUntilSuccessful,
  PrintAction,
  MockAction,
  CounterAction,
  CheckCondition,
  NodeStatus,
  type WorkflowArgs,
  type WorkflowResult,
} from "../../dist/index.js";

/**
 * Workflow that demonstrates retry logic with delays
 * Simulates a flaky API call that succeeds after 2 failures
 */
export async function retryBackoffWorkflow(args: WorkflowArgs): Promise<WorkflowResult> {
  const root = new Sequence({ id: "root" });

  // Initialize counter for tracking attempts
  root.addChild(new PrintAction({ id: "start", message: "Starting workflow with retry logic..." }));

  // Create a sequence that increments counter and checks if it's >= 3
  const attemptSequence = new Sequence({ id: "attemptSeq" });
  attemptSequence.addChild(new CounterAction({ id: "increment", counterKey: "attempts", increment: 1 }));
  attemptSequence.addChild(new PrintAction({ id: "attempting", message: "Attempting operation..." }));

  // Check if attempts >= 3 (succeeds on 3rd attempt)
  attemptSequence.addChild(
    new CheckCondition({
      id: "checkAttempts",
      key: "attempts",
      operator: ">=",
      value: 3,
    })
  );

  // Wrap in retry with delay
  const retry = new RetryUntilSuccessful({
    id: "retry",
    maxAttempts: 5,
    retryDelay: 100, // 100ms delay between retries
  });
  retry.setChild(attemptSequence);

  root.addChild(retry);
  root.addChild(new PrintAction({ id: "success", message: "Operation succeeded after retries!" }));

  const tree = new BehaviorTree(root);
  const workflow = tree.toWorkflow();

  return workflow(args);
}
