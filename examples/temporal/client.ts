/**
 * Temporal Client
 * Executes YAML-defined behavior tree workflows on Temporal server
 */

import { readFileSync } from "fs";
import { Connection, Client } from "@temporalio/client";
import { Registry } from "../../dist/index.js";
import type { YamlWorkflowArgs } from "./yaml-workflow-loader.js";

async function run() {
  console.log("🔌 Connecting to Temporal server at localhost:7233...");

  const connection = await Connection.connect({
    address: "localhost:7233",
  });

  const client = new Client({ connection });
  console.log("✅ Connected to Temporal server\n");

  // Create tree registry (required for SubTree nodes)
  const treeRegistry = new Registry();

  // Load YAML workflows
  const workflows = [
    {
      name: "Simple Sequence",
      file: "../yaml-workflows/01-simple-sequence.yaml",
      id: "simple-sequence",
    },
    {
      name: "Parallel with Timeout",
      file: "../yaml-workflows/02-parallel-timeout.yaml",
      id: "parallel-timeout",
    },
    {
      name: "Order Processing",
      file: "../yaml-workflows/05-order-processing.yaml",
      id: "order-processing",
    },
    // Complex workflows (comment out for initial test)
    // {
    //   name: "E-commerce Checkout",
    //   file: "../yaml-workflows/03-ecommerce-checkout.yaml",
    //   id: "ecommerce-checkout",
    // },
    // {
    //   name: "AI Agent Workflow",
    //   file: "../yaml-workflows/04-ai-agent-workflow.yaml",
    //   id: "ai-agent",
    // },
  ];

  // Execute each YAML workflow
  for (const workflow of workflows) {
    console.log("=".repeat(60));
    console.log(`Workflow: ${workflow.name}`);
    console.log("=".repeat(60));

    try {
      // Load YAML content from file
      const yamlContent = readFileSync(workflow.file, "utf-8");

      // Create workflow args with YAML content
      const args: YamlWorkflowArgs = {
        input: {},
        treeRegistry,
        yamlContent,
      };

      // Execute workflow
      const result = await client.workflow.execute("yamlWorkflow", {
        taskQueue: "btree-workflows",
        workflowId: `${workflow.id}-${Date.now()}`,
        args: [args],
      });

      console.log("✅ Result:", result);
      console.log("\n");
    } catch (error) {
      console.error(`❌ Workflow failed:`, error);
      console.log("\n");
    }
  }

  console.log("=".repeat(60));
  console.log("🎉 All YAML workflows completed!");
  console.log("=".repeat(60));
}

run().catch((err) => {
  console.error("❌ Client error:", err);
  process.exit(1);
});
