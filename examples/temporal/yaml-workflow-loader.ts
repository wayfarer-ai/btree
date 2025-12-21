/**
 * Universal YAML Workflow Loader
 * Executes any YAML-defined workflow in Temporal
 */

import {
  BehaviorTree,
  Registry,
  registerStandardNodes,
  loadTreeFromYaml,
  type WorkflowArgs,
  type WorkflowResult,
} from "../../dist/index.js";

/**
 * Extended workflow args with YAML content
 */
export interface YamlWorkflowArgs extends WorkflowArgs {
  yamlContent: string;
}

/**
 * Universal YAML workflow executor
 * Loads and executes any YAML workflow definition
 *
 * Usage:
 * ```typescript
 * const result = await client.workflow.execute(yamlWorkflow, {
 *   args: [{
 *     input: {},
 *     treeRegistry: new Registry(),
 *     yamlContent: readFileSync('./my-workflow.yaml', 'utf-8')
 *   }]
 * });
 * ```
 */
export async function yamlWorkflow(
  args: YamlWorkflowArgs,
): Promise<WorkflowResult> {
  if (!args.yamlContent) {
    throw new Error("yamlContent is required in workflow arguments");
  }

  // Create registry and register all standard built-in nodes
  const registry = new Registry();
  registerStandardNodes(registry);

  // Users can register custom nodes here:
  // registry.register("MyCustomNode", MyCustomNode, { category: "action" });

  // Parse and validate YAML
  const root = loadTreeFromYaml(args.yamlContent, registry);

  // Convert to Temporal workflow
  const tree = new BehaviorTree(root);
  const workflow = tree.toWorkflow();

  // Execute with original args (without yamlContent)
  return workflow({ input: args.input, treeRegistry: args.treeRegistry });
}
