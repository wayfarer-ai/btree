/**
 * Workflow exports for Temporal worker
 * All workflows are now YAML-based for declarative workflow definitions
 */

export { yamlWorkflow } from "./yaml-workflow-loader.js";

// Old programmatic workflows (deprecated - converted to YAML)
// See yaml-workflows/ directory for YAML versions:
// - 01-simple-sequence.yaml
// - 02-parallel-timeout.yaml
// - 06-temporal-demo.yaml (order processing)
