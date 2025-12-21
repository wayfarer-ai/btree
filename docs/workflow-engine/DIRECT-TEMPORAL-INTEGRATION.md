# Direct Temporal Integration (No Adapter)

## Core Insight

**Current btree already has the right pattern** - each node has `executeTick()` that defines its execution logic. We just need to make `executeTick()` **natively use Temporal APIs** instead of Effect-TS.

## Architecture: Before vs After

### Before (Convoluted)
```
YAML → Parse → BehaviorTree → Adapter.convert() → Temporal Workflow
                    ↓
                executeTick() (Effect-TS)
                    ↓
                Adapter translates to Temporal
```

### After (Direct)
```
YAML → Parse → BehaviorTree → tree.toWorkflow() → Temporal Workflow
                    ↓
                executeTick() (Temporal APIs directly!)
```

**Key difference**: Nodes use `@temporalio/workflow` APIs directly in `executeTick()`, so the tree IS the workflow.

---

## Design: Direct Temporal Nodes

### Base Node Changes

```typescript
// src/base-node.ts
import { proxyActivities, sleep, condition } from '@temporalio/workflow';
import type { TemporalContext } from './types';

/**
 * Base node that executes directly in Temporal workflow
 */
export abstract class BaseNode {
  id: string;
  config: NodeConfiguration;
  children: BaseNode[] = [];

  /**
   * Execute this node in Temporal workflow context
   * Returns standard Temporal promise
   */
  abstract executeTick(context: TemporalContext): Promise<NodeStatus>;

  /**
   * Convert this node tree to executable Temporal workflow
   */
  toWorkflow(): WorkflowFunction {
    return async (input: any) => {
      const context = this.createContext(input);
      const status = await this.executeTick(context);
      return { status, output: context.output };
    };
  }
}
```

### Context Type (No Effect-TS)

```typescript
// src/types.ts
import type { WorkflowInfo } from '@temporalio/workflow';

/**
 * Execution context using Temporal primitives
 */
export interface TemporalContext {
  // Input data
  input: Record<string, unknown>;

  // Output accumulator
  output: Record<string, unknown>;

  // Temporal activities (proxied)
  activities: any; // proxyActivities result

  // Temporal workflow info
  workflowInfo: WorkflowInfo;

  // Signals state
  signals: Record<string, any>;
}
```

---

## Composites: Direct Temporal Patterns

### Sequence (Sequential Execution)

```typescript
// src/composites/sequence.ts
import type { TemporalContext } from '../types';

export class Sequence extends CompositeNode {
  /**
   * Execute children sequentially - native Temporal pattern
   */
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    for (const child of this.children) {
      const status = await child.executeTick(context);

      if (status === NodeStatus.FAILURE) {
        return NodeStatus.FAILURE;
      }
    }

    return NodeStatus.SUCCESS;
  }
}
```

**That's it!** No adapter needed - this IS how Temporal workflows work.

### Parallel (Concurrent Execution)

```typescript
// src/composites/parallel.ts
export class Parallel extends CompositeNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // Native Temporal parallel execution
    const results = await Promise.all(
      this.children.map(child => child.executeTick(context))
    );

    const failures = results.filter(s => s === NodeStatus.FAILURE);

    // Configurable policy
    if (this.config.policy === 'all') {
      return failures.length === 0 ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
    } else if (this.config.policy === 'one') {
      return results.some(s => s === NodeStatus.SUCCESS)
        ? NodeStatus.SUCCESS
        : NodeStatus.FAILURE;
    }
  }
}
```

### Conditional (If/Else)

```typescript
// src/composites/conditional.ts
export class Conditional extends CompositeNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // Evaluate condition (deterministic!)
    const conditionResult = this.evaluateCondition(
      this.config.condition,
      context.input,
      context.output
    );

    // Native if/else in Temporal workflow
    const branch = conditionResult ? this.children[0] : this.children[1];
    return branch ? await branch.executeTick(context) : NodeStatus.SUCCESS;
  }

  private evaluateCondition(expr: string, input: any, output: any): boolean {
    // Deterministic condition evaluation
    // Can use simple expressions or a safe eval
    return Function('input', 'output', `return ${expr}`)(input, output);
  }
}
```

---

## Action Nodes: Temporal Activities

### HTTP Request

```typescript
// src/actions/http-request.ts
export class HttpRequest extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // Activity is already proxied in context
    const result = await context.activities.httpRequest({
      url: this.resolveTemplate(this.config.url, context.input),
      method: this.config.method,
      headers: this.config.headers,
      body: this.config.body,
    });

    // Store result in output
    context.output[this.config.outputKey || 'httpResponse'] = result;

    return NodeStatus.SUCCESS;
  }

  private resolveTemplate(template: string, data: any): string {
    return template.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
      return path.split('.').reduce((obj, key) => obj?.[key], data);
    });
  }
}

// Activity implementation (runs in worker, not workflow!)
export const httpRequestActivity = async (params: HttpRequestParams) => {
  const response = await fetch(params.url, {
    method: params.method,
    headers: params.headers,
    body: params.body ? JSON.stringify(params.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
};
```

### Delay (Durable Sleep)

```typescript
// src/actions/delay.ts
import { sleep } from '@temporalio/workflow';

export class Delay extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // Native Temporal durable sleep!
    await sleep(this.config.duration);

    return NodeStatus.SUCCESS;
  }
}
```

**No activity needed** - sleep is deterministic and runs in workflow.

### Human Approval (Signal Wait)

```typescript
// src/actions/human-approval.ts
import { condition, defineSignal, setHandler } from '@temporalio/workflow';

export class HumanApproval extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    const signalName = this.config.signalName || `approval_${this.id}`;

    // Check if signal already received (for replays)
    if (context.signals[signalName]) {
      return NodeStatus.SUCCESS;
    }

    // Define signal handler
    const approvalSignal = defineSignal<[boolean]>(signalName);

    setHandler(approvalSignal, (approved) => {
      context.signals[signalName] = approved;
    });

    // Wait for signal with timeout
    const timeout = this.config.timeout || '30 days';
    await condition(() => context.signals[signalName] !== undefined, timeout);

    // Check approval value
    return context.signals[signalName]
      ? NodeStatus.SUCCESS
      : NodeStatus.FAILURE;
  }
}
```

---

## Decorators: Modify Child Execution

### Retry Decorator

```typescript
// src/decorators/retry.ts
export class Retry extends DecoratorNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    const maxAttempts = this.config.maxAttempts || 3;
    const backoff = this.config.backoffMs || 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const status = await this.child.executeTick(context);

      if (status === NodeStatus.SUCCESS) {
        return NodeStatus.SUCCESS;
      }

      // Wait before retry (durable!)
      if (attempt < maxAttempts) {
        await sleep(backoff * attempt); // Exponential backoff
      }
    }

    return NodeStatus.FAILURE;
  }
}
```

### Timeout Decorator

```typescript
// src/decorators/timeout.ts
import { CancellationScope } from '@temporalio/workflow';

export class Timeout extends DecoratorNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    const timeoutMs = this.config.timeoutMs || 30000;

    try {
      // Temporal's native timeout using cancellation
      return await CancellationScope.cancellable(async () => {
        const timer = sleep(timeoutMs).then(() => {
          throw new Error('Timeout');
        });

        const execution = this.child.executeTick(context);

        return await Promise.race([execution, timer]);
      });
    } catch (error) {
      if (error.message === 'Timeout') {
        return NodeStatus.FAILURE;
      }
      throw error;
    }
  }
}
```

---

## Building and Running

### 1. Parse YAML → BehaviorTree

```typescript
// src/yaml/parser.ts
import { Sequence, Parallel, HttpRequest, Delay } from './nodes';

export class YamlParser {
  parse(yamlString: string): BehaviorTree {
    const def = yaml.parse(yamlString);

    const nodes = new Map<string, BaseNode>();

    // Create nodes
    for (const nodeDef of def.nodes) {
      const node = this.createNode(nodeDef.type, nodeDef.config);
      node.id = nodeDef.id;
      nodes.set(nodeDef.id, node);
    }

    // Connect edges (build tree)
    for (const edge of def.edges) {
      const parent = nodes.get(edge.source);
      const child = nodes.get(edge.target);
      parent.addChild(child);
    }

    return new BehaviorTree(nodes.get('root'));
  }

  private createNode(type: string, config: any): BaseNode {
    switch (type) {
      case 'Sequence': return new Sequence(config);
      case 'Parallel': return new Parallel(config);
      case 'HttpRequest': return new HttpRequest(config);
      case 'Delay': return new Delay(config);
      // ... etc
    }
  }
}
```

### 2. Tree → Temporal Workflow (Direct!)

```typescript
// src/behavior-tree.ts
export class BehaviorTree {
  constructor(private root: BaseNode) {}

  /**
   * Convert tree to Temporal workflow function
   * No adapter needed!
   */
  toWorkflow(): WorkflowFunction {
    return async (input: any) => {
      // Setup context with proxied activities
      const activities = proxyActivities({
        startToCloseTimeout: '5 minutes',
        retry: { maximumAttempts: 3 },
      });

      const context: TemporalContext = {
        input,
        output: {},
        activities,
        workflowInfo: workflowInfo(),
        signals: {},
      };

      // Execute root node
      const status = await this.root.executeTick(context);

      return {
        status,
        output: context.output,
      };
    };
  }

  /**
   * Get all activities needed by this tree
   */
  getActivities(): Record<string, Function> {
    const activities = {};

    this.traverse(node => {
      if (node instanceof HttpRequest) {
        activities['httpRequest'] = httpRequestActivity;
      } else if (node instanceof DatabaseQuery) {
        activities['databaseQuery'] = databaseQueryActivity;
      }
      // ... etc
    });

    return activities;
  }
}
```

### 3. Usage (Clean!)

```typescript
// main.ts
import { WorkflowClient, Worker } from '@temporalio/client';
import { YamlParser } from './yaml/parser';

// Parse YAML
const yamlContent = fs.readFileSync('workflow.yaml', 'utf-8');
const tree = new YamlParser().parse(yamlContent);

// Get workflow function directly!
const workflow = tree.toWorkflow();
const activities = tree.getActivities();

// Start worker
const worker = await Worker.create({
  taskQueue: 'workflows',
  workflows: { myWorkflow: workflow },  // Direct!
  activities,
});

await worker.run();

// Start workflow
const client = new WorkflowClient();
const handle = await client.start('myWorkflow', {
  taskQueue: 'workflows',
  args: [{ userId: '123', email: 'user@example.com' }],
});

const result = await handle.result();
console.log(result); // { status: 'SUCCESS', output: { ... } }
```

---

## Benefits of Direct Integration

### 1. Simpler Mental Model
```typescript
// Adapter approach (convoluted):
Node.executeTick() → Effect → Adapter.translateToTemporal() → Temporal

// Direct approach (clean):
Node.executeTick() → Temporal directly
```

### 2. No Translation Layer
- No `BTreeToTemporalAdapter` class
- No `getTemporalMetadata()`
- No `toTemporalActivity()` conversion
- Just: `tree.toWorkflow()` returns a function

### 3. Native Temporal Features
```typescript
// Nodes use Temporal APIs directly
await sleep('7 days');           // Not translated - native!
await condition(() => approved); // Not translated - native!
await Promise.all([...]);        // Not translated - native!
```

### 4. Type Safety
```typescript
// context is TemporalContext, not generic
async executeTick(context: TemporalContext): Promise<NodeStatus> {
  // TypeScript knows about context.activities, context.signals, etc.
  const result = await context.activities.httpRequest(...);
}
```

---

## What Changes in btree Core?

### Minimal Breaking Changes

1. **Replace Effect-TS with Temporal imports**
```typescript
// Before:
import { Effect } from 'effect';

// After:
import { sleep, condition, proxyActivities } from '@temporalio/workflow';
```

2. **Change executeTick signature**
```typescript
// Before:
abstract executeTick(context: EffectTickContext): Effect.Effect<NodeStatus, Error>

// After:
abstract executeTick(context: TemporalContext): Promise<NodeStatus>
```

3. **Remove TickEngine** (not needed - tree IS the workflow)

4. **Add toWorkflow() to BehaviorTree**

That's it! The rest stays the same:
- ✅ Node types (Sequence, Parallel, etc.)
- ✅ Tree structure
- ✅ YAML format
- ✅ Registry pattern
- ✅ Visual builder

---

## Composites Rethink

### Keep These (Map Directly to Temporal)

| Composite | Temporal Pattern | Keep? |
|-----------|------------------|-------|
| **Sequence** | Sequential await | ✅ Yes |
| **Parallel** | Promise.all() | ✅ Yes |
| **Selector** | Try each until success | ✅ Yes |
| **Conditional** | if/else | ✅ Yes |
| **ForEach** | for loop | ✅ Yes |
| **While** | while loop | ✅ Yes |

### Decorators - Some Become Native

| Decorator | Temporal Equivalent | Keep as Node? |
|-----------|---------------------|---------------|
| **Retry** | Activity retry policy OR Retry decorator node | ✅ Keep node (more flexible) |
| **Timeout** | Activity timeout OR CancellationScope | ✅ Keep node |
| **Delay** | sleep() | ✅ Keep as action node |
| **Invert** | Flip status | ✅ Keep |
| **AlwaysSucceed** | Catch and return SUCCESS | ✅ Keep |

### New Nodes for Temporal Features

```typescript
// Signal wait
class WaitForSignal extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    await condition(() => context.signals[this.config.signalName]);
    return NodeStatus.SUCCESS;
  }
}

// Query handler
class QueryHandler extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // Register query that returns current output
    setHandler(defineQuery(this.config.queryName), () => context.output);
    return NodeStatus.SUCCESS;
  }
}

// Child workflow
class ChildWorkflow extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    const { executeChild } = await import('@temporalio/workflow');

    const result = await executeChild(this.config.workflowType, {
      args: [this.config.input],
    });

    context.output[this.config.outputKey] = result;
    return NodeStatus.SUCCESS;
  }
}
```

---

## Summary

### What We Remove
- ❌ BTreeToTemporalAdapter class (500+ lines)
- ❌ getTemporalMetadata() methods
- ❌ toTemporalActivity() methods
- ❌ Effect-TS dependency
- ❌ TickEngine class

### What We Add
- ✅ Direct Temporal imports in nodes
- ✅ tree.toWorkflow() method (~50 lines)
- ✅ TemporalContext type
- ✅ Few new nodes (WaitForSignal, ChildWorkflow)

### Result
```
Before: YAML → Tree → Adapter → Workflow (3 layers)
After:  YAML → Tree → Workflow (2 layers)

Code reduction: ~500 lines
Mental model: Much simpler
Integration: Native Temporal
```

**When you parse YAML, you get a tree. When you call tree.toWorkflow(), you get a Temporal workflow function. That's it.**
