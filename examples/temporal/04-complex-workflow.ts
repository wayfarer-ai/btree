/**
 * Complex Workflow Example
 * Demonstrates nested behavior trees with various node types
 */

import {
  BehaviorTree,
  Sequence,
  Selector,
  Parallel,
  RetryUntilSuccessful,
  Timeout,
  Delay,
  PrintAction,
  CounterAction,
  CheckCondition,
  MockAction,
  NodeStatus,
  type WorkflowArgs,
  type WorkflowResult,
} from "../../dist/index.js";

/**
 * Complex workflow demonstrating:
 * - Nested sequences and selectors
 * - Parallel execution
 * - Retry logic
 * - Timeouts and delays
 * - Blackboard data flow
 */
export async function complexWorkflow(args: WorkflowArgs): Promise<WorkflowResult> {
  const root = new Sequence({ id: "root" });

  // Phase 1: Initialization
  root.addChild(new PrintAction({ id: "init", message: "=== Phase 1: Initialization ===" }));
  root.addChild(new CounterAction({ id: "setScore", counterKey: "score", increment: 100 }));

  // Phase 2: Parallel data fetching with timeout
  const fetchPhase = new PrintAction({ id: "fetchPhase", message: "=== Phase 2: Data Fetching ===" });
  root.addChild(fetchPhase);

  const parallelFetch = new Parallel({
    id: "fetch",
    strategy: "strict",
  });
  parallelFetch.addChild(new PrintAction({ id: "fetchUser", message: "Fetching user data..." }));
  parallelFetch.addChild(new PrintAction({ id: "fetchOrders", message: "Fetching orders..." }));
  parallelFetch.addChild(new PrintAction({ id: "fetchSettings", message: "Fetching settings..." }));

  const fetchWithTimeout = new Timeout({
    id: "fetchTimeout",
    timeoutMs: 3000,
  });
  fetchWithTimeout.setChild(parallelFetch);
  root.addChild(fetchWithTimeout);

  // Phase 3: Processing with fallback logic
  root.addChild(new PrintAction({ id: "processPhase", message: "=== Phase 3: Processing ===" }));

  const processingSelector = new Selector({ id: "processSelector" });

  // Try primary processing
  const primaryProcessing = new Sequence({ id: "primary" });
  primaryProcessing.addChild(new PrintAction({ id: "tryPrimary", message: "Trying primary processing..." }));
  primaryProcessing.addChild(new CheckCondition({
    id: "checkScore",
    key: "score",
    operator: ">=",
    value: 50,
  }));
  primaryProcessing.addChild(new PrintAction({ id: "primarySuccess", message: "Primary processing succeeded!" }));

  // Fallback processing
  const fallbackProcessing = new Sequence({ id: "fallback" });
  fallbackProcessing.addChild(new PrintAction({ id: "tryFallback", message: "Using fallback processing..." }));
  fallbackProcessing.addChild(new CounterAction({ id: "adjustScore", counterKey: "score", increment: 50 }));
  fallbackProcessing.addChild(new PrintAction({ id: "fallbackSuccess", message: "Fallback processing succeeded!" }));

  processingSelector.addChildren([primaryProcessing, fallbackProcessing]);
  root.addChild(processingSelector);

  // Phase 4: Validation with retry
  root.addChild(new PrintAction({ id: "validatePhase", message: "=== Phase 4: Validation ===" }));

  const validationSequence = new Sequence({ id: "validate" });
  validationSequence.addChild(new PrintAction({ id: "validating", message: "Validating results..." }));

  validationSequence.addChild(new CheckCondition({
    id: "finalCheck",
    key: "score",
    operator: ">=",
    value: 100,
  }));

  const validationWithRetry = new RetryUntilSuccessful({
    id: "retryValidation",
    maxAttempts: 3,
    retryDelay: 100,
  });
  validationWithRetry.setChild(validationSequence);
  root.addChild(validationWithRetry);

  // Phase 5: Completion with delay
  root.addChild(new PrintAction({ id: "completionPhase", message: "=== Phase 5: Completion ===" }));

  const delayedCompletion = new Delay({
    id: "completionDelay",
    delayMs: 200,
  });
  delayedCompletion.setChild(new PrintAction({ id: "done", message: "Workflow completed successfully!" }));
  root.addChild(delayedCompletion);

  const tree = new BehaviorTree(root);
  const workflow = tree.toWorkflow();

  return workflow(args);
}
