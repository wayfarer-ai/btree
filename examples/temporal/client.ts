/**
 * Temporal Client
 * Executes behavior tree workflows on Temporal server
 */

import { Connection, Client } from "@temporalio/client";
import { Registry } from "../../dist/index.js";
import type { WorkflowArgs } from "../../dist/index.js";

async function run() {
  console.log("🔌 Connecting to Temporal server at localhost:7233...");

  const connection = await Connection.connect({
    address: "localhost:7233",
  });

  const client = new Client({ connection });
  console.log("✅ Connected to Temporal server\n");

  // Create tree registry (required for SubTree nodes)
  const treeRegistry = new Registry();

  // Example 1: Simple Sequence Workflow
  console.log("=".repeat(60));
  console.log("Example 1: Simple Sequence Workflow");
  console.log("=".repeat(60));

  const simpleArgs: WorkflowArgs = {
    input: {},
    treeRegistry,
  };

  const simpleResult = await client.workflow.execute("simpleSequenceWorkflow", {
    taskQueue: "btree-workflows",
    workflowId: `simple-sequence-${Date.now()}`,
    args: [simpleArgs],
  });

  console.log("✅ Result:", simpleResult);
  console.log("\n");

  // Example 2: Parallel with Timeout
  console.log("=".repeat(60));
  console.log("Example 2: Parallel Execution with Timeout");
  console.log("=".repeat(60));

  const parallelArgs: WorkflowArgs = {
    input: {},
    treeRegistry,
  };

  const parallelResult = await client.workflow.execute("parallelTimeoutWorkflow", {
    taskQueue: "btree-workflows",
    workflowId: `parallel-timeout-${Date.now()}`,
    args: [parallelArgs],
  });

  console.log("✅ Result:", parallelResult);
  console.log("\n");

  // Example 3: Retry with Backoff
  console.log("=".repeat(60));
  console.log("Example 3: Retry with Backoff");
  console.log("=".repeat(60));

  const retryArgs: WorkflowArgs = {
    input: { attempts: 0 },
    treeRegistry,
  };

  const retryResult = await client.workflow.execute("retryBackoffWorkflow", {
    taskQueue: "btree-workflows",
    workflowId: `retry-backoff-${Date.now()}`,
    args: [retryArgs],
  });

  console.log("✅ Result:", retryResult);
  console.log("\n");

  // Example 4: Complex Workflow
  console.log("=".repeat(60));
  console.log("Example 4: Complex Nested Workflow");
  console.log("=".repeat(60));

  const complexArgs: WorkflowArgs = {
    input: {},
    treeRegistry,
  };

  const complexResult = await client.workflow.execute("complexWorkflow", {
    taskQueue: "btree-workflows",
    workflowId: `complex-${Date.now()}`,
    args: [complexArgs],
  });

  console.log("✅ Result:", complexResult);
  console.log("\n");

  console.log("=".repeat(60));
  console.log("🎉 All workflows completed successfully!");
  console.log("=".repeat(60));
}

run().catch((err) => {
  console.error("❌ Client error:", err);
  process.exit(1);
});
