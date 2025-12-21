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

All workflows are now defined in YAML for better readability and AI-friendliness. The workflows are located in `examples/yaml-workflows/`:

### 01-simple-sequence.yaml
Basic sequence of actions demonstrating fundamental workflow execution.
- 3 sequential print actions
- Simplest possible workflow pattern

### 02-parallel-timeout.yaml
Parallel task execution with timeout protection.
- 3 tasks running concurrently
- 5-second timeout wrapper
- Demonstrates strict parallel strategy (all must succeed)

### 06-temporal-demo.yaml
**Complex e-commerce order processing workflow:**
- **Phase 1**: Parallel validation (inventory, payment, shipping)
- **Phase 2**: Payment processing with 1s simulated delay
- **Phase 3**: Parallel fulfillment (inventory, shipping, email)
- Demonstrates: Sequence, Parallel, Timeout, Delay nodes
- Realistic production workflow pattern

### Legacy Programmatic Workflows (Deprecated)

The following TypeScript workflows have been converted to YAML:
- ~~01-simple-sequence.ts~~ → `01-simple-sequence.yaml`
- ~~02-parallel-timeout.ts~~ → `02-parallel-timeout.yaml`
- ~~05-yaml-workflow.ts~~ → Replaced by universal `yaml-workflow-loader.ts`
- ~~03-retry-backoff.ts~~ → Deprecated (use Temporal RetryPolicy)
- ~~04-complex-workflow.ts~~ → Deprecated (use Temporal RetryPolicy)

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

All workflows are defined in YAML and loaded via the universal `yamlWorkflow` loader.

### YAML Workflow Format

```yaml
type: Sequence
id: my-workflow
name: My Workflow
children:
  - type: PrintAction
    id: start
    props:
      message: "Starting..."

  - type: Timeout
    id: timeout-wrapper
    props:
      timeoutMs: 10000
    children:
      - type: Parallel
        id: parallel-tasks
        props:
          strategy: "strict"
        children:
          - type: PrintAction
            id: task1
            props:
              message: "Task 1"
          - type: PrintAction
            id: task2
            props:
              message: "Task 2"
```

### Universal YAML Workflow Loader

The `yamlWorkflow` function loads any YAML workflow:

```typescript
// yaml-workflow-loader.ts
import { registerStandardNodes } from '@wayfarer-ai/btree';

export async function yamlWorkflow(args: YamlWorkflowArgs): Promise<WorkflowResult> {
  // 1. Setup registry with all built-in nodes
  const registry = new Registry();
  registerStandardNodes(registry);

  // Optionally register custom nodes:
  // registry.register("MyCustomNode", MyCustomNode, { category: "action" });

  // 2. Parse YAML from workflow args
  const root = loadTreeFromYaml(args.yamlContent, registry);

  // 3. Convert to Temporal workflow and execute
  const tree = new BehaviorTree(root);
  return tree.toWorkflow()(args);
}
```

**`registerStandardNodes()` includes:**
- **Composites**: Sequence, Selector, Parallel, Conditional, ForEach, While, Recovery, ReactiveSequence, MemorySequence, SubTree
- **Decorators**: Timeout, Delay, Repeat, Invert, ForceSuccess, ForceFailure, RunOnce, KeepRunningUntilFailure, Precondition, SoftAssert
- **Actions/Conditions**: PrintAction, MockAction, CounterAction, CheckCondition, AlwaysCondition, WaitAction, Script, LogMessage, RegexExtract
- **Test Nodes**: SuccessNode, FailureNode, RunningNode

### Client Usage

Load YAML files and pass content as workflow arguments:

```typescript
// client.ts
const yamlContent = readFileSync('./my-workflow.yaml', 'utf-8');

const result = await client.workflow.execute("yamlWorkflow", {
  taskQueue: "btree-workflows",
  workflowId: `my-workflow-${Date.now()}`,
  args: [{
    input: {},
    treeRegistry: new Registry(),
    yamlContent  // Pass YAML content to workflow
  }]
});
```

**Benefits:**
- ✅ Single universal loader for all workflows
- ✅ YAML files are version controlled
- ✅ Client loads files (no filesystem access in Temporal sandbox)
- ✅ Easy to add new workflows without code changes
- ✅ AI-friendly declarative format

See [`yaml-workflow-loader.ts`](./yaml-workflow-loader.ts) for the complete implementation.

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

## Migration Guide: Retry Decorator Removed

The `Retry` decorator has been removed from the library. Use Temporal's native **RetryPolicy** instead, which provides deterministic, server-managed retries.

### Before (Retry Decorator - Removed)
```typescript
import { RetryUntilSuccessful } from "@wayfarer-ai/btree";

const retry = new RetryUntilSuccessful({
  id: "retry",
  maxAttempts: 3,
  retryDelay: 1000
});
retry.setChild(new FlakeyAction());
```

### After (Temporal RetryPolicy - Recommended)

**Option 1: Use Temporal Activities with RetryPolicy** (Best for external operations)
```typescript
import { proxyActivities } from '@temporalio/workflow';

const activities = proxyActivities({
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '1s',      // First retry after 1 second
    backoffCoefficient: 2.0,    // Double delay each retry
    maximumInterval: '60s',     // Max delay between retries
    maximumAttempts: 3,         // Try up to 3 times
  }
});

// Call activity - Temporal handles retries automatically
const result = await activities.flakeyOperation();
```

**Option 2: Manual Retry with Temporal Sleep** (For workflow-level logic)
```typescript
import { sleep } from '@temporalio/workflow';

let attempt = 0;
let result;

while (attempt < 3) {
  try {
    result = await someOperation();
    break; // Success - exit loop
  } catch (error) {
    attempt++;
    if (attempt >= 3) throw error; // Max attempts reached
    await sleep(`${1000 * Math.pow(2, attempt)}ms`); // Exponential backoff
  }
}
```

### Why This Change?

- **Deterministic**: Temporal's RetryPolicy respects replay boundaries
- **Server-Managed**: Retries are enforced by Temporal server, not client code
- **Better Observability**: Retry attempts visible in Temporal UI
- **Less Code**: No need for custom retry decorators

### Updating Example Workflows

> **Note**: The example files `03-retry-backoff.ts` and `04-complex-workflow.ts` still reference the removed `Retry` decorator and will not run. These examples are preserved for reference but should be updated to use Temporal's RetryPolicy as shown above.

## Next Steps

- **Modify workflows**: Edit the workflow files to experiment with different node combinations
- **Add activities**: Integrate Temporal activities for external API calls, database operations, and side effects
- **Add signals**: Use Temporal signals for runtime control and human-in-the-loop workflows
- **Monitor executions**: Use the Temporal UI to inspect workflow behavior and debug issues
- **Scale workers**: Add more workers to handle increased load
- **Deploy to production**: Use Temporal Cloud or self-hosted Temporal Server
