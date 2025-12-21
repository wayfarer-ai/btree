# Temporal Behavior Tree Examples

This directory contains E2E examples demonstrating behavior trees running as Temporal workflows.

## Prerequisites

1. **Temporal Server** running locally on port 7233
   ```bash
   # Start Temporal dev server (if not already running)
   temporal server start-dev
   ```

2. **Build the package**
   ```bash
   # From the project root
   npm run build
   ```

## Workflow Examples

### 01-simple-sequence.ts
Basic sequence of actions demonstrating fundamental workflow execution.

### 02-parallel-timeout.ts
Parallel task execution with timeout protection.

### 03-retry-backoff.ts
Retry logic with delays, demonstrating resilient workflows.

### 04-complex-workflow.ts
Complex nested behavior tree showcasing:
- Nested sequences and selectors
- Parallel execution
- Retry logic
- Timeouts and delays
- Blackboard data flow between nodes

## Running the Examples

### Step 1: Start the Worker

In one terminal:
```bash
cd examples/temporal
npx tsx worker.ts
```

You should see:
```
🚀 Starting Temporal worker for behavior tree workflows...
✅ Worker started successfully!
📋 Task Queue: btree-workflows
🔄 Listening for workflow tasks...
```

### Step 2: Execute Workflows

In another terminal:
```bash
cd examples/temporal
npx tsx client.ts
```

This will execute all 4 example workflows and display their results.

## Viewing Workflows in Temporal UI

Open http://localhost:8233 in your browser to see:
- Workflow execution history
- Event timelines
- Input/output data
- Node execution traces

## Workflow Structure

All workflows follow this pattern:

```typescript
import { BehaviorTree, ... } from "@wayfarer-ai/btree";

export async function myWorkflow(args: WorkflowArgs): Promise<WorkflowResult> {
  // 1. Build behavior tree
  const root = new Sequence({ id: "root" });
  root.addChild(...);

  // 2. Convert to workflow
  const tree = new BehaviorTree(root);
  const workflow = tree.toWorkflow();

  // 3. Execute
  return workflow(args);
}
```

## Next Steps

- **Modify workflows**: Edit the workflow files to experiment with different node combinations
- **Add activities**: Integrate Temporal activities for external API calls
- **Add signals**: Use Temporal signals for runtime control
- **Monitor executions**: Use the Temporal UI to inspect workflow behavior
