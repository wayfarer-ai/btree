/**
 * Test loading YAML workflows
 */

import { Registry } from "../src/registry.js";
import { Sequence } from "../src/composites/sequence.js";
import { Timeout } from "../src/decorators/timeout.js";
import { PrintAction } from "../src/test-nodes.js";
import { loadTreeFromYaml } from "../src/yaml/index.js";
import { readFileSync } from "fs";

// Setup registry with required node types
const registry = new Registry();
registry.register("Sequence", Sequence as any, { category: "composite" });
registry.register("Timeout", Timeout as any, { category: "decorator" });
registry.register("PrintAction", PrintAction as any, { category: "action" });

// Test 1: Load from YAML string
const yamlString = `
type: Sequence
id: simple-notification
name: Send Notification

children:
  - type: PrintAction
    id: log-start
    props:
      message: "Starting notification workflow..."

  - type: Timeout
    id: notification-timeout
    props:
      timeoutMs: 5000
    children:
      - type: PrintAction
        id: send-notification
        props:
          message: "Sending notification to user..."

  - type: PrintAction
    id: log-success
    props:
      message: "Notification sent successfully!"
`;

console.log("Test 1: Loading from YAML string...");
try {
  const tree = loadTreeFromYaml(yamlString, registry);
  console.log("✓ Tree loaded successfully!");
  console.log("  Root type:", tree.type);
  console.log("  Root ID:", tree.id);
  console.log("  Root name:", tree.name);
} catch (error) {
  console.error("✗ Failed to load tree:", error);
  process.exit(1);
}

// Test 2: Load from YAML file
console.log("\nTest 2: Loading from YAML file...");
try {
  const yamlFile = readFileSync(
    "./examples/yaml-workflows/01-simple-notification.yaml",
    "utf-8",
  );
  const tree = loadTreeFromYaml(yamlFile, registry);
  console.log("✓ Tree loaded from file successfully!");
  console.log("  Root type:", tree.type);
  console.log("  Root ID:", tree.id);
} catch (error) {
  console.error("✗ Failed to load tree from file:", error);
  if (error instanceof Error) {
    console.error("  Error:", error.message);
  }
  process.exit(1);
}

// Test 3: Invalid YAML (should fail)
console.log("\nTest 3: Testing invalid YAML (negative timeout)...");
const invalidYaml = `
type: Timeout
id: invalid
props:
  timeoutMs: -100
`;

try {
  const tree = loadTreeFromYaml(invalidYaml, registry);
  console.error("✗ Should have thrown validation error!");
  process.exit(1);
} catch (error) {
  console.log("✓ Correctly caught validation error");
  if (error instanceof Error) {
    console.log("  Error:", error.message);
  }
}

console.log("\n✓ All tests passed!");
