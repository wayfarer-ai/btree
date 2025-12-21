# Temporal Behavior Tree Examples

This directory contains E2E examples demonstrating behavior trees running as **Temporal workflows** with native durable execution.

## Why Temporal?

Temporal provides **automatic resumability** through event sourcing and deterministic replay:

- **✅ Automatic Recovery**: Workflows resume after crashes without manual intervention
- **✅ Event Sourcing**: Every step is recorded in the event history
- **✅ Deterministic Replay**: Temporal replays events to restore exact state
- **✅ No Manual Resume**: Unlike standalone execution, no `resumeFromNodeId` needed
- **✅ Long-Running**: Workflows can run for days, weeks, or months
- **✅ Observability**: Full execution history visible in Temporal UI

**Key Insight**: Behavior tree nodes execute deterministically, making them perfect for Temporal's replay mechanism. When a workflow resumes, Temporal replays the event history and the behavior tree executes identically, restoring state to the exact point of failure.

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

## Production Best Practices

### Temporal Architecture Benefits

**Deterministic Execution**
- Behavior tree nodes are deterministic (same inputs → same outputs)
- Perfect match for Temporal's replay mechanism
- No need for manual checkpointing or state management

**Automatic State Management**
- Temporal persists workflow state automatically
- Blackboard state survives crashes via event history
- No external database needed for workflow state

**Fault Tolerance**
- Worker crashes: Temporal reschedules on healthy workers
- Process failures: Workflow resumes from last event
- Network issues: Automatic retries with backoff

**When to Use Activities**
- **Non-deterministic operations**: API calls, database queries, external services
- **Side effects**: Sending emails, creating resources, billing operations
- **Long-running work**: File processing, ML model inference, video encoding
- **Expensive operations**: Heavy computations that should be cached

**Example: Mixing Nodes and Activities**
```typescript
import { proxyActivities } from '@temporalio/workflow';

const activities = proxyActivities<MyActivities>({
  startToCloseTimeout: '1 minute',
});

export async function myWorkflow(args: WorkflowArgs) {
  const root = new Sequence({ id: 'root' });

  // Use behavior tree nodes for control flow
  root.addChild(new ValidateInput({ id: 'validate' }));

  // Use activities for external calls
  const result = await activities.callExternalAPI();

  // Use Script node to process results
  root.addChild(new Script({
    id: 'process',
    textContent: `status = "${result.status}"`
  }));

  const tree = new BehaviorTree(root);
  return tree.toWorkflow()(args);
}
```

## Next Steps

- **Modify workflows**: Edit the workflow files to experiment with different node combinations
- **Add activities**: Integrate Temporal activities for external API calls, database operations, and side effects
- **Add signals**: Use Temporal signals for runtime control and human-in-the-loop workflows
- **Monitor executions**: Use the Temporal UI to inspect workflow behavior and debug issues
- **Scale workers**: Add more workers to handle increased load
- **Deploy to production**: Use Temporal Cloud or self-hosted Temporal Server
