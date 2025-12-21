/**
 * Temporal Worker
 * Registers and runs behavior tree workflows
 */

import { NativeConnection, Worker, bundleWorkflowCode } from "@temporalio/worker";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  console.log("🚀 Starting Temporal worker for behavior tree workflows...");

  const connection = await NativeConnection.connect({
    address: "localhost:7233",
  });

  // Bundle workflows ahead of time with better control
  console.log("📦 Bundling workflows...");
  const { code } = await bundleWorkflowCode({
    workflowsPath: join(__dirname, "workflows.ts"),
    webpackConfigHook: (config) => {
      config.target = "webworker";
      if (config.output) {
        config.output.publicPath = "";
        config.output.globalObject = "globalThis";
      }
      // Force single bundle without code splitting
      config.optimization = {
        minimize: false,
        splitChunks: false,
        runtimeChunk: false,
      };
      // Ensure all modules are bundled inline
      config.externals = [];
      return config;
    },
  });

  console.log("✅ Workflows bundled successfully");

  const worker = await Worker.create({
    connection,
    namespace: "default",
    workflowBundle: { code },
    taskQueue: "btree-workflows",
  });

  console.log("✅ Worker started successfully!");
  console.log("📋 Task Queue: btree-workflows");
  console.log("🔄 Listening for workflow tasks...\n");

  await worker.run();
}

run().catch((err) => {
  console.error("❌ Worker error:", err);
  process.exit(1);
});
