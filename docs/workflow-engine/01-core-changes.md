# Core Library Changes (Direct Temporal Integration)

This document outlines the changes needed to make btree nodes execute natively as Temporal workflows.

## Overview

**Key Insight**: The existing `executeTick()` pattern is perfect - we just need to change what it executes.

**Current**: `executeTick()` returns `Effect.Effect<NodeStatus, Error>`
**Target**: `executeTick()` returns `Promise<NodeStatus>` and uses Temporal APIs

**Estimated Effort**: 1 week

---

## What Changes?

### Remove
- ❌ Effect-TS dependency
- ❌ TickEngine class (not needed - tree IS the workflow)
- ❌ Effect-based async patterns

### Add
- ✅ Temporal SDK imports
- ✅ `tree.toWorkflow()` method
- ✅ TemporalContext type

### Keep (No Changes!)
- ✅ Node hierarchy (BaseNode, CompositeNode, ActionNode, DecoratorNode)
- ✅ Tree structure and traversal
- ✅ Registry pattern
- ✅ YAML serialization
- ✅ Event system (for visual builder)

---

## 1. Update Base Node Classes

### Before (Effect-TS)

```typescript
// src/base-node.ts
import { Effect } from 'effect';

export abstract class BaseNode {
  abstract executeTick(
    context: EffectTickContext
  ): Effect.Effect<NodeStatus, Error, never>;
}
```

### After (Temporal)

```typescript
// src/base-node.ts
import type { TemporalContext } from './types';

export abstract class BaseNode {
  id: string;
  config: NodeConfiguration;
  children: BaseNode[] = [];

  /**
   * Execute this node using Temporal APIs
   */
  abstract executeTick(context: TemporalContext): Promise<NodeStatus>;

  /**
   * Add child node (for composites)
   */
  addChild(child: BaseNode): void {
    this.children.push(child);
  }
}
```

---

## 2. Update Context Type

### Before (Effect Context)

```typescript
export interface EffectTickContext extends TickContext {
  runningOps: Map<string, RunningOperation>;
  // Effect-specific fields
}
```

### After (Temporal Context)

```typescript
// src/types.ts
import type { WorkflowInfo } from '@temporalio/workflow';

/**
 * Execution context for Temporal workflows
 */
export interface TemporalContext {
  // Input data
  input: Record<string, unknown>;

  // Output accumulator
  output: Record<string, unknown>;

  // Proxied Temporal activities
  activities: any;

  // Workflow metadata
  workflowInfo: WorkflowInfo;

  // Signal state (for signal waiting)
  signals: Record<string, any>;
}
```

---

## 3. Update Composite Nodes

### Sequence: Sequential Execution

```typescript
// src/composites/sequence.ts
import type { TemporalContext } from '../types';
import { CompositeNode } from '../base-node';
import { NodeStatus } from '../types';

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

**That's it!** This IS how Temporal workflows execute sequential steps.

### Parallel: Concurrent Execution

```typescript
// src/composites/parallel.ts
export class Parallel extends CompositeNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // Native Temporal parallel execution
    const results = await Promise.all(
      this.children.map(child => child.executeTick(context))
    );

    // Policy: all must succeed or any must succeed
    const policy = this.config.policy || 'all';

    if (policy === 'all') {
      return results.every(s => s === NodeStatus.SUCCESS)
        ? NodeStatus.SUCCESS
        : NodeStatus.FAILURE;
    } else {
      return results.some(s => s === NodeStatus.SUCCESS)
        ? NodeStatus.SUCCESS
        : NodeStatus.FAILURE;
    }
  }
}
```

### Selector: Try Until Success

```typescript
// src/composites/selector.ts
export class Selector extends CompositeNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    for (const child of this.children) {
      const status = await child.executeTick(context);

      if (status === NodeStatus.SUCCESS) {
        return NodeStatus.SUCCESS;
      }
    }

    return NodeStatus.FAILURE;
  }
}
```

---

## 4. Update Action Nodes

### HTTP Request

```typescript
// src/actions/http-request.ts
import { ActionNode } from '../base-node';
import type { TemporalContext } from '../types';

export class HttpRequest extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // Call proxied activity
    const result = await context.activities.httpRequest({
      url: this.resolveTemplate(this.config.url, context.input),
      method: this.config.method || 'GET',
      headers: this.config.headers,
      body: this.config.body,
    });

    // Store in output
    const outputKey = this.config.outputKey || 'httpResponse';
    context.output[outputKey] = result;

    return NodeStatus.SUCCESS;
  }

  private resolveTemplate(template: string, data: any): string {
    return template.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
      return path.split('.').reduce((obj, key) => obj?.[key], data);
    });
  }
}

// Activity implementation (runs in worker, not workflow)
export const httpRequestActivity = async (params: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
}) => {
  const response = await fetch(params.url, {
    method: params.method,
    headers: params.headers,
    body: params.body ? JSON.stringify(params.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
};
```

### Delay (Durable Sleep)

```typescript
// src/actions/delay.ts
import { sleep } from '@temporalio/workflow';
import { ActionNode } from '../base-node';

export class Delay extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // Native Temporal durable sleep!
    await sleep(this.config.duration);

    return NodeStatus.SUCCESS;
  }
}
```

**No activity needed** - `sleep()` is deterministic and runs in the workflow.

### Script Node (Deterministic)

```typescript
// src/actions/script.ts
export class Script extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // Execute script deterministically
    const script = this.config.textContent;

    // Simple variable resolution (deterministic)
    const input = (key: string) => context.input[key];
    const output = (key: string, value: any) => {
      context.output[key] = value;
      return value;
    };

    // Evaluate (must be deterministic!)
    const fn = new Function('input', 'output', script);
    fn(input, output);

    return NodeStatus.SUCCESS;
  }
}
```

---

## 5. Update Decorators

### Retry Decorator

```typescript
// src/decorators/retry.ts
import { sleep } from '@temporalio/workflow';
import { DecoratorNode } from '../base-node';

export class Retry extends DecoratorNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    const maxAttempts = this.config.maxAttempts || 3;
    const initialBackoff = this.config.initialBackoff || 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const status = await this.child.executeTick(context);

      if (status === NodeStatus.SUCCESS) {
        return NodeStatus.SUCCESS;
      }

      // Exponential backoff (durable!)
      if (attempt < maxAttempts) {
        await sleep(initialBackoff * Math.pow(2, attempt - 1));
      }
    }

    return NodeStatus.FAILURE;
  }
}
```

### Timeout Decorator

```typescript
// src/decorators/timeout.ts
import { CancellationScope, sleep } from '@temporalio/workflow';
import { DecoratorNode } from '../base-node';

export class Timeout extends DecoratorNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    const timeoutMs = this.config.timeoutMs || 30000;

    try {
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

## 6. Add tree.toWorkflow() Method

```typescript
// src/behavior-tree.ts
import { proxyActivities, workflowInfo } from '@temporalio/workflow';
import type { TemporalContext } from './types';

export class BehaviorTree {
  constructor(private root: BaseNode) {}

  /**
   * Convert this tree to an executable Temporal workflow
   */
  toWorkflow(): (input: any) => Promise<any> {
    return async (input: any) => {
      // Proxy activities
      const activities = proxyActivities({
        startToCloseTimeout: '5 minutes',
        retry: {
          maximumAttempts: 3,
          initialInterval: '1s',
          backoffCoefficient: 2,
        },
      });

      // Create context
      const context: TemporalContext = {
        input,
        output: {},
        activities,
        workflowInfo: workflowInfo(),
        signals: {},
      };

      // Execute root node
      const status = await this.root.executeTick(context);

      // Return result
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
      if (node.type === 'HttpRequest') {
        activities['httpRequest'] = httpRequestActivity;
      } else if (node.type === 'DatabaseQuery') {
        activities['databaseQuery'] = databaseQueryActivity;
      }
      // ... add other activities
    });

    return activities;
  }

  /**
   * Traverse tree and call fn on each node
   */
  private traverse(fn: (node: BaseNode) => void): void {
    const visit = (node: BaseNode) => {
      fn(node);
      node.children?.forEach(visit);
    };
    visit(this.root);
  }
}
```

---

## 7. Remove TickEngine

The `TickEngine` class is no longer needed. Temporal handles execution.

```typescript
// ❌ DELETE src/tick-engine.ts
```

Instead, use:

```typescript
const tree = yamlParser.parse('workflow.yaml');
const workflow = tree.toWorkflow();  // This IS the execution engine
```

---

## 8. Update Package Dependencies

```json
{
  "dependencies": {
    // REMOVE:
    // "effect": "^3.0.0",

    // ADD:
    "@temporalio/workflow": "^1.10.0",
    "@temporalio/activity": "^1.10.0",
    "@temporalio/client": "^1.10.0",
    "@temporalio/worker": "^1.10.0",

    // KEEP:
    "yaml": "^2.3.4",
    "antlr4": "^4.13.0"
  }
}
```

---

## 9. Migration Path

### Phase 1: Update Signatures (Breaking Change)
```typescript
// Change all executeTick() signatures
- executeTick(context: EffectTickContext): Effect.Effect<NodeStatus, Error>
+ executeTick(context: TemporalContext): Promise<NodeStatus>
```

### Phase 2: Replace Effect with Temporal
```typescript
// Before:
import { Effect } from 'effect';
return Effect.succeed(NodeStatus.SUCCESS);

// After:
return NodeStatus.SUCCESS;
```

### Phase 3: Add tree.toWorkflow()
```typescript
export class BehaviorTree {
  toWorkflow() { /* implementation */ }
  getActivities() { /* implementation */ }
}
```

### Phase 4: Update Tests
```typescript
// Before:
const effect = node.executeTick(context);
const status = await Effect.runPromise(effect);

// After:
const status = await node.executeTick(context);
```

---

## 10. What Stays the Same

- ✅ Node types (Sequence, Parallel, HttpRequest, etc.)
- ✅ Tree structure (parent-child relationships)
- ✅ YAML format
- ✅ Registry pattern
- ✅ Visual builder integration
- ✅ Event emission (for UI updates)

---

## Summary

**Changes**:
1. Replace Effect-TS with Temporal imports
2. Change `executeTick()` to return `Promise<NodeStatus>`
3. Use Temporal APIs directly (`sleep`, `proxyActivities`, `condition`)
4. Add `tree.toWorkflow()` method
5. Remove `TickEngine`

**Result**:
- Parse YAML → Build tree → Call `tree.toWorkflow()` → Get Temporal workflow
- No adapter, no translation layer
- Nodes execute natively as Temporal code

**Code Reduction**: ~300 lines removed (Effect wrapper code, TickEngine)
**Code Addition**: ~100 lines added (tree.toWorkflow(), TemporalContext)
**Net**: Simpler, more direct integration
