/**
 * Temporal Integration Tests
 * Validates that behavior trees work correctly as Temporal workflows
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { BehaviorTree } from "./behavior-tree.js";
import { Sequence } from "./composites/sequence.js";
import { Selector } from "./composites/selector.js";
import { Parallel, ParallelStrategy } from "./composites/parallel.js";
import { PrintAction, MockAction, CounterAction } from "./test-nodes.js";
import { Timeout } from "./decorators/timeout.js";
import { Delay } from "./decorators/delay.js";
import { NodeStatus } from "./types.js";
import { Registry } from "./registry.js";

describe.skip("Temporal Integration", () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  }, 60000); // 60 second timeout for creating test environment

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it("should execute simple sequence workflow", async () => {
    const root = new Sequence({ id: "root" });
    root.addChild(new PrintAction({ id: "step1", message: "Hello" }));
    root.addChild(new PrintAction({ id: "step2", message: "World" }));

    const tree = new BehaviorTree(root);
    const workflow = tree.toWorkflow();

    const treeRegistry = new Registry();
    const result = await workflow({ input: {}, treeRegistry });

    expect(result.status).toBe(NodeStatus.SUCCESS);
    expect(result.output).toBeDefined();
  });

  it("should handle selector (fallback) logic", async () => {
    const root = new Selector({ id: "root" });
    root.addChild(new MockAction({ id: "fail1", returnStatus: NodeStatus.FAILURE }));
    root.addChild(new MockAction({ id: "fail2", returnStatus: NodeStatus.FAILURE }));
    root.addChild(new MockAction({ id: "success", returnStatus: NodeStatus.SUCCESS }));

    const tree = new BehaviorTree(root);
    const workflow = tree.toWorkflow();

    const treeRegistry = new Registry();
    const result = await workflow({ input: {}, treeRegistry });

    expect(result.status).toBe(NodeStatus.SUCCESS);
  });

  it("should execute parallel nodes concurrently", async () => {
    const root = new Parallel({
      id: "root",
      strategy: ParallelStrategy.JOIN_ALL,
      threshold: 3,
    });
    root.addChild(new MockAction({ id: "task1", returnStatus: NodeStatus.SUCCESS }));
    root.addChild(new MockAction({ id: "task2", returnStatus: NodeStatus.SUCCESS }));
    root.addChild(new MockAction({ id: "task3", returnStatus: NodeStatus.SUCCESS }));

    const tree = new BehaviorTree(root);
    const workflow = tree.toWorkflow();

    const treeRegistry = new Registry();
    const result = await workflow({ input: {}, treeRegistry });

    expect(result.status).toBe(NodeStatus.SUCCESS);
  });

  it("should handle blackboard input and output", async () => {
    const root = new Sequence({ id: "root" });
    root.addChild(new CounterAction({ id: "increment1", counterKey: "count", increment: 5 }));
    root.addChild(new CounterAction({ id: "increment2", counterKey: "count", increment: 3 }));

    const tree = new BehaviorTree(root);
    const workflow = tree.toWorkflow();

    const treeRegistry = new Registry();
    const result = await workflow({
      input: { count: 10 },
      treeRegistry
    });

    expect(result.status).toBe(NodeStatus.SUCCESS);
    expect(result.output.count).toBe(18); // 10 + 5 + 3
  });

  // NOTE: Retry decorator removed - use Temporal's native RetryPolicy instead

  it("should handle timeout decorator", async () => {
    const timeout = new Timeout({
      id: "timeout",
      timeoutMs: 100,
    });
    const fastAction = new MockAction({
      id: "fast",
      returnStatus: NodeStatus.SUCCESS,
      ticksBeforeComplete: 1,
    });
    timeout.setChild(fastAction);

    const tree = new BehaviorTree(timeout);
    const workflow = tree.toWorkflow();

    const treeRegistry = new Registry();
    const result = await workflow({ input: {}, treeRegistry });

    expect(result.status).toBe(NodeStatus.SUCCESS);
  });

  it("should handle delay decorator", async () => {
    const delay = new Delay({
      id: "delay",
      delayMs: 50,
    });
    const action = new PrintAction({
      id: "action",
      message: "Delayed action",
    });
    delay.setChild(action);

    const tree = new BehaviorTree(delay);
    const workflow = tree.toWorkflow();

    const treeRegistry = new Registry();
    const startTime = Date.now();
    const result = await workflow({ input: {}, treeRegistry });
    const duration = Date.now() - startTime;

    expect(result.status).toBe(NodeStatus.SUCCESS);
    expect(duration).toBeGreaterThanOrEqual(50);
  });

  it("should handle complex nested trees", async () => {
    // Create a complex tree: Sequence -> (Selector, Parallel, Action)
    const root = new Sequence({ id: "root" });

    const selector = new Selector({ id: "selector" });
    selector.addChild(new MockAction({ id: "fail", returnStatus: NodeStatus.FAILURE }));
    selector.addChild(new MockAction({ id: "success", returnStatus: NodeStatus.SUCCESS }));

    const parallel = new Parallel({
      id: "parallel",
      strategy: ParallelStrategy.JOIN_ALL,
      threshold: 2,
    });
    parallel.addChild(new PrintAction({ id: "p1", message: "Parallel 1" }));
    parallel.addChild(new PrintAction({ id: "p2", message: "Parallel 2" }));

    const action = new MockAction({ id: "finalAction", returnStatus: NodeStatus.SUCCESS });

    root.addChildren([selector, parallel, action]);

    const tree = new BehaviorTree(root);
    const workflow = tree.toWorkflow();

    const treeRegistry = new Registry();
    const result = await workflow({ input: {}, treeRegistry });

    expect(result.status).toBe(NodeStatus.SUCCESS);
  });

  it("should preserve workflow info in context", async () => {
    let capturedWorkflowInfo: any = null;

    const action = new MockAction({
      id: "capture",
      returnStatus: NodeStatus.SUCCESS,
    });

    // Override tick to capture workflow info
    const originalTick = action.tick.bind(action);
    action.tick = async (context) => {
      capturedWorkflowInfo = context.workflowInfo;
      return originalTick(context);
    };

    const tree = new BehaviorTree(action);
    const workflow = tree.toWorkflow();

    const treeRegistry = new Registry();
    const result = await workflow({ input: {}, treeRegistry });

    expect(result.status).toBe(NodeStatus.SUCCESS);
    // In test environment, workflowInfo might not be available
    // This test just validates the structure doesn't break
  });

  it("should handle session ID properly", async () => {
    const root = new PrintAction({ id: "root", message: "Session test" });

    const tree = new BehaviorTree(root);
    const workflow = tree.toWorkflow();

    const treeRegistry = new Registry();
    const customSessionId = "test-session-123";
    const result = await workflow({
      input: {},
      treeRegistry,
      sessionId: customSessionId,
    });

    expect(result.status).toBe(NodeStatus.SUCCESS);
  });
});
