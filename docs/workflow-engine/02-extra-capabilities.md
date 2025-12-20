# Extra Capabilities for Workflow Engine (Direct Temporal Integration)

This document outlines the new components to build on top of btree for **direct Temporal integration**.

**Key Insight**: We're building workflow nodes that natively use Temporal APIs - no adapter or translation layer needed.

---

## What We Build vs What Temporal Provides

### We Build 🔨
1. **Workflow Action Nodes** - HTTP, Database, Email (as Temporal Activities)
2. **Visual Builder** - React Flow UI for workflow design
3. **YAML Parser** - For AI-generated workflows
4. **tree.toWorkflow()** - Method that returns executable Temporal workflow function

### Temporal Provides ✅
- Durable execution engine
- State persistence
- Long-running workflow support
- Automatic retries
- Event-driven architecture
- Observability & debugging

---

## 1. Workflow Action Nodes (Temporal Activities)

**Location**: `packages/workflow-nodes/`

These nodes become **Temporal Activities** - fault-tolerant external operations.

### 1.1 HTTP Request Node

```typescript
// packages/workflow-nodes/src/http-request.ts
import { ActionNode } from '@wayfarer-ai/btree';
import type { TemporalContext } from '@wayfarer-ai/btree';
import { NodeStatus } from '@wayfarer-ai/btree';

export class HttpRequest extends ActionNode {
  /**
   * Execute HTTP request using Temporal Activity
   */
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

  private resolveTemplate(template: string, input: any): string {
    return template.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
      return path.split('.').reduce((obj, key) => obj?.[key], input);
    });
  }
}

// Activity implementation (runs in worker, not workflow!)
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

### 1.2 Database Query Node

```typescript
// packages/workflow-nodes/src/database-query.ts
export class DatabaseQuery extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    const result = await context.activities.databaseQuery({
      connectionString: this.config.connectionString,
      query: this.resolveTemplate(this.config.query, context.input),
      parameters: this.config.parameters,
    });

    context.output[this.config.outputKey || 'queryResult'] = result;
    return NodeStatus.SUCCESS;
  }

  private resolveTemplate(template: string, input: any): string {
    return template.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
      return path.split('.').reduce((obj, key) => obj?.[key], input);
    });
  }
}

// Activity implementation
export const databaseQueryActivity = async (params: {
  connectionString: string;
  query: string;
  parameters?: any[];
}) => {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: params.connectionString });

  await client.connect();

  try {
    const result = await client.query(params.query, params.parameters);
    return result.rows;
  } finally {
    await client.end();
  }
};
```

### 1.3 Email Send Node

```typescript
// packages/workflow-nodes/src/email-send.ts
export class EmailSend extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    await context.activities.emailSend({
      to: this.resolveTemplate(this.config.to, context.input),
      subject: this.resolveTemplate(this.config.subject, context.input),
      body: this.resolveTemplate(this.config.body, context.input),
      template: this.config.template,
    });

    return NodeStatus.SUCCESS;
  }

  private resolveTemplate(template: string, input: any): string {
    return template.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
      return path.split('.').reduce((obj, key) => obj?.[key], input);
    });
  }
}

// Activity implementation
export const emailSendActivity = async (params: {
  to: string;
  subject: string;
  body: string;
  template?: string;
}) => {
  const sgMail = await import('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

  await sgMail.send({
    to: params.to,
    from: process.env.FROM_EMAIL!,
    subject: params.subject,
    html: params.body,
  });

  return { sent: true, timestamp: Date.now() };
};
```

### 1.4 Delay/Sleep Node

```typescript
// packages/workflow-nodes/src/delay.ts
import { sleep } from '@temporalio/workflow';
import { ActionNode } from '@wayfarer-ai/btree';

export class Delay extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // Native Temporal durable sleep!
    // No activity needed - sleep is deterministic
    await sleep(this.config.duration);

    return NodeStatus.SUCCESS;
  }
}
```

**Note**: No activity implementation needed - `sleep()` runs in the workflow itself!

### 1.5 Human Approval Node

```typescript
// packages/workflow-nodes/src/human-approval.ts
import { condition, defineSignal, setHandler } from '@temporalio/workflow';
import { ActionNode } from '@wayfarer-ai/btree';

export class HumanApproval extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    const signalName = this.config.signalName || `approval_${this.id}`;

    // Check if signal already received (for replays)
    if (context.signals[signalName] !== undefined) {
      return context.signals[signalName]
        ? NodeStatus.SUCCESS
        : NodeStatus.FAILURE;
    }

    // Define signal handler
    const approvalSignal = defineSignal<[boolean]>(signalName);

    setHandler(approvalSignal, (approved: boolean) => {
      context.signals[signalName] = approved;
    });

    // Send approval email via activity
    await context.activities.sendApprovalEmail({
      to: this.config.approvers,
      approvalLink: this.config.approvalLink,
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

// Activity for sending approval email
export const sendApprovalEmailActivity = async (params: {
  to: string[];
  approvalLink: string;
}) => {
  // Send email with approval link
  const sgMail = await import('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

  await sgMail.send({
    to: params.to,
    from: process.env.FROM_EMAIL!,
    subject: 'Approval Required',
    html: `Please approve: <a href="${params.approvalLink}">Click here</a>`,
  });
};
```

---

## 2. Visual Builder (React Flow)

**Location**: `packages/visual-builder/`

### 2.1 Component Structure

```
packages/visual-builder/
├── src/
│   ├── components/
│   │   ├── WorkflowEditor.tsx      # Main editor component
│   │   ├── NodePalette.tsx         # Drag-and-drop node library
│   │   ├── CustomNode.tsx          # Styled workflow node
│   │   ├── NodeConfigPanel.tsx     # Node property editor
│   │   └── ExecutionViewer.tsx     # Live execution visualization
│   ├── hooks/
│   │   ├── useWorkflowExecution.ts # Subscribe to Temporal events
│   │   └── useYamlSync.ts          # Sync tree ↔ YAML
│   └── utils/
│       ├── reactflow-adapter.ts    # Convert tree ↔ React Flow
│       └── temporal-client.ts      # Temporal client wrapper
```

### 2.2 Key Component: WorkflowEditor

```tsx
// packages/visual-builder/src/components/WorkflowEditor.tsx
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import { useCallback, useState } from 'react';
import { BTreeToReactFlow } from '../utils/reactflow-adapter';

export function WorkflowEditor({ tree, registry }) {
  const adapter = new BTreeToReactFlow(tree, registry);
  const [nodes, setNodes] = useState(adapter.toReactFlowNodes());
  const [edges, setEdges] = useState(adapter.toReactFlowEdges());

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const handleExportYAML = () => {
    const tree = adapter.fromReactFlow(nodes, edges);
    const yaml = serializer.serialize(tree);
    downloadFile('workflow.yaml', yaml);
  };

  const handleExecute = async () => {
    const tree = adapter.fromReactFlow(nodes, edges);
    const workflow = tree.toWorkflow();  // Direct workflow function!

    // Execute via Temporal
    const client = new WorkflowClient();
    await client.start(workflow, {
      taskQueue: 'workflows',
      args: [{ /* input data */ }],
    });
  };

  return (
    <div className="workflow-editor">
      <NodePalette registry={registry} />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={customNodeTypes}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      <NodeConfigPanel selectedNode={selectedNode} />

      <button onClick={handleExportYAML}>Export YAML</button>
      <button onClick={handleExecute}>Execute Workflow</button>
    </div>
  );
}
```

---

## 3. YAML Parser/Serializer

**Location**: `packages/btree/src/yaml/`

AI-generated workflows and storage format.

```typescript
// src/yaml/parser.ts
import yaml from 'yaml';
import { BehaviorTree } from '../behavior-tree.js';

export class YamlParser {
  constructor(private registry: Registry) {}

  parse(yamlString: string): BehaviorTree {
    const definition = yaml.parse(yamlString);

    // Build node map
    const nodes = new Map();
    for (const nodeDef of definition.nodes) {
      const node = this.registry.create(nodeDef.type, nodeDef.config);
      node.id = nodeDef.id;
      nodes.set(nodeDef.id, node);
    }

    // Connect edges to build tree structure
    for (const edge of definition.edges) {
      const parent = nodes.get(edge.source);
      const child = nodes.get(edge.target);
      parent.addChild(child);
    }

    return new BehaviorTree(nodes.get('root'));
  }

  serialize(tree: BehaviorTree): string {
    const nodes = [];
    const edges = [];

    tree.traverse((node, parent) => {
      nodes.push({
        id: node.id,
        type: node.constructor.name,
        config: node.config,
      });

      if (parent) {
        edges.push({
          source: parent.id,
          target: node.id,
        });
      }
    });

    return yaml.stringify({
      version: '1.0',
      nodes,
      edges,
    });
  }
}
```

---

## 4. Temporal Workflow Executor

**Location**: `packages/btree/src/workflow-executor.ts`

Convenience wrapper for executing workflows.

```typescript
// src/workflow-executor.ts
import { WorkflowClient, Worker } from '@temporalio/client';
import type { BehaviorTree } from './behavior-tree';

export class WorkflowExecutor {
  constructor(
    private client: WorkflowClient,
    private tree: BehaviorTree
  ) {}

  /**
   * Execute workflow and wait for result
   */
  async execute(input: any, options?: { workflowId?: string }) {
    const workflow = this.tree.toWorkflow();

    const handle = await this.client.start(workflow, {
      taskQueue: 'workflow-queue',
      workflowId: options?.workflowId || `workflow-${Date.now()}`,
      args: [input],
    });

    return handle.result();
  }

  /**
   * Start workflow asynchronously
   */
  async executeAsync(input: any) {
    const workflow = this.tree.toWorkflow();

    const handle = await this.client.start(workflow, {
      taskQueue: 'workflow-queue',
      args: [input],
    });

    return {
      workflowId: handle.workflowId,
      query: (name: string) => handle.query(name),
      signal: (name: string, data: any) => handle.signal(name, data),
      result: () => handle.result(),
    };
  }

  /**
   * Create Temporal worker
   */
  static async createWorker(tree: BehaviorTree, taskQueue: string) {
    const workflow = tree.toWorkflow();
    const activities = tree.getActivities();

    return await Worker.create({
      taskQueue,
      workflows: { workflow },
      activities,
    });
  }
}
```

---

## 5. Usage Example

### Complete Flow

```typescript
// 1. Define workflow in YAML
const yamlContent = `
version: "1.0"
name: "User Signup Flow"

nodes:
  - id: main
    type: Sequence

  - id: validate
    type: Script
    config:
      textContent: |
        isValid = email != null && name != null

  - id: create-user
    type: HttpRequest
    config:
      url: "{{env.API_URL}}/users"
      method: POST
      body:
        email: "{{email}}"
        name: "{{name}}"

  - id: send-email
    type: EmailSend
    config:
      to: "{{email}}"
      subject: "Welcome!"
      template: welcome

edges:
  - source: main
    target: validate
  - source: main
    target: create-user
  - source: main
    target: send-email
`;

// 2. Parse YAML to BehaviorTree
const parser = new YamlParser(registry);
const tree = parser.parse(yamlContent);

// 3. Get workflow function directly!
const workflow = tree.toWorkflow();
const activities = tree.getActivities();

// 4. Start Temporal worker
const worker = await Worker.create({
  taskQueue: 'workflows',
  workflows: { userSignup: workflow },
  activities,
});

await worker.run();

// 5. Execute workflow
const client = new WorkflowClient();
const handle = await client.start('userSignup', {
  taskQueue: 'workflows',
  args: [{ email: 'user@example.com', name: 'John' }],
});

const result = await handle.result();
console.log(result); // { status: 'SUCCESS', output: { ... } }
```

---

## Summary: What We Build

| Component | Purpose | Effort |
|-----------|---------|--------|
| **Workflow Nodes** | HTTP, DB, Email, etc. as Activities | 2 weeks |
| **Visual Builder** | React Flow UI | 2 weeks |
| **YAML Parser** | Parse/serialize workflows | 1 week |
| **tree.toWorkflow()** | Convert tree to executable workflow | Included in core |

**Total**: ~5 weeks

**What we DON'T build**:
- ❌ Adapter/translation layer (not needed!)
- ❌ Execution engine (Temporal provides)
- ❌ State persistence (Temporal provides)
- ❌ Retry logic (Temporal provides)
- ❌ Event system (Temporal provides)
- ❌ Observability (Temporal UI provides)

**Result**: Production-ready workflow automation platform in 4-6 weeks instead of 6+ months.
