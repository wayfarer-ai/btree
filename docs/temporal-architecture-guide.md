# Temporal Architecture Guide for btree Workflows

## Understanding the Temporal Sandbox

### The Determinism Requirement

Temporal workflows must be **deterministic** - they produce the same output for the same input, even when replayed from event history. This enables:
- **Automatic resumability** after crashes
- **Durable execution** that survives process restarts
- **Time-travel debugging** by replaying workflow history

### What's Blocked vs Allowed

| Operation | Workflow (Sandboxed) | Activity (Full Access) |
|-----------|---------------------|----------------------|
| Filesystem access | ❌ Blocked | ✅ Allowed |
| Network calls | ❌ Blocked | ✅ Allowed |
| Database queries | ❌ Blocked | ✅ Allowed |
| Random numbers | ❌ Blocked | ✅ Allowed |
| Current time | ❌ Use `workflow.now()` | ✅ Allowed |
| Control flow logic | ✅ Allowed | ✅ Allowed |
| Temporal APIs | ✅ Allowed | ❌ Not available |

---

## Architecture Patterns for btree Nodes

### Pattern 1: Pure Control Flow Nodes (Workflow-Only)

These nodes only orchestrate execution and can run entirely in the workflow sandbox:

```typescript
// ✅ Safe in workflow - no external I/O
import { Sequence, Parallel, Selector, Conditional } from '@wayfarer-ai/btree';

export async function myWorkflow(args: WorkflowArgs): Promise<WorkflowResult> {
  const root = new Sequence({ id: 'root' });

  // These are just control flow - perfectly safe in workflows
  root.addChild(new Parallel({ id: 'parallel', strategy: 'strict' }));
  root.addChild(new Conditional({ id: 'if-then' }));

  const tree = new BehaviorTree(root);
  return tree.toWorkflow()(args);
}
```

**Examples**:
- Sequence, Selector, Parallel - orchestration only
- Timeout, Delay - use Temporal APIs (`sleep`)
- Repeat, ForEach, While - just loops
- Invert, ForceSuccess - just status manipulation

---

### Pattern 2: Hybrid Nodes (Workflow + Activity)

These nodes need external I/O, so they call Activities from within the workflow:

```typescript
// src/actions/http-request.ts
import { ActionNode } from '@wayfarer-ai/btree';
import { proxyActivities } from '@temporalio/workflow';
import type { NodeStatus, TemporalContext } from '@wayfarer-ai/btree';

// Define activity interface
interface HttpActivities {
  fetchUrl(url: string, options: RequestOptions): Promise<Response>;
}

// Proxy activities (available in workflow sandbox)
const activities = proxyActivities<HttpActivities>({
  startToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s',
    maximumInterval: '60s',
    maximumAttempts: 3,
  },
});

export class HttpRequest extends ActionNode {
  constructor(
    config: NodeConfiguration & {
      url: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      headers?: Record<string, string>;
      body?: any;
    }
  ) {
    super(config);
    this.url = config.url;
    this.method = config.method;
    this.headers = config.headers;
    this.body = config.body;
  }

  protected async executeTick(context: TemporalContext): Promise<NodeStatus> {
    try {
      // ✅ Call activity - runs outside sandbox with full network access
      const response = await activities.fetchUrl(this.url, {
        method: this.method,
        headers: this.headers,
        body: this.body,
      });

      // Store response in blackboard for downstream nodes
      context.blackboard.set('httpResponse', response);

      return NodeStatus.SUCCESS;
    } catch (error) {
      this._lastError = `HTTP request failed: ${error.message}`;
      return NodeStatus.FAILURE;
    }
  }
}
```

```typescript
// activities/http-activities.ts (runs on worker, full Node.js access)
import fetch from 'node-fetch';

export async function fetchUrl(
  url: string,
  options: RequestOptions
): Promise<Response> {
  // ✅ Full network access - this runs outside the sandbox
  const response = await fetch(url, {
    method: options.method,
    headers: options.headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    data: await response.json(),
  };
}
```

---

### Pattern 3: Interpreter Nodes (Activity-Heavy)

For running user code (Python, JavaScript), the **entire execution happens in an Activity**:

```typescript
// src/actions/python-interpreter.ts
import { ActionNode } from '@wayfarer-ai/btree';
import { proxyActivities } from '@temporalio/workflow';
import type { NodeStatus, TemporalContext } from '@wayfarer-ai/btree';

interface InterpreterActivities {
  executePython(script: string, context: Record<string, any>): Promise<any>;
  executeJavaScript(script: string, context: Record<string, any>): Promise<any>;
}

const activities = proxyActivities<InterpreterActivities>({
  startToCloseTimeout: '5m',  // Long timeout for script execution
  heartbeatTimeout: '30s',    // Heartbeat for long-running scripts
});

export class PythonInterpreter extends ActionNode {
  private script: string;
  private outputKey: string;

  constructor(config: NodeConfiguration & { script: string; outputKey: string }) {
    super(config);
    this.script = config.script;
    this.outputKey = config.outputKey;
  }

  protected async executeTick(context: TemporalContext): Promise<NodeStatus> {
    try {
      // Gather input variables from blackboard
      const scriptContext = {
        // Pass blackboard data as variables
        ...context.blackboard.toJSON(),
      };

      // ✅ Execute Python in activity (full subprocess access)
      const result = await activities.executePython(this.script, scriptContext);

      // Store result
      context.blackboard.set(this.outputKey, result);

      return NodeStatus.SUCCESS;
    } catch (error) {
      this._lastError = `Python execution failed: ${error.message}`;
      return NodeStatus.FAILURE;
    }
  }
}
```

```typescript
// activities/interpreter-activities.ts
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export async function executePython(
  script: string,
  context: Record<string, any>
): Promise<any> {
  // ✅ Full filesystem and subprocess access

  // 1. Write script to temp file
  const scriptPath = join(tmpdir(), `script-${Date.now()}.py`);
  const fullScript = `
import json
import sys

# Inject context variables
${Object.entries(context)
  .map(([key, val]) => `${key} = ${JSON.stringify(val)}`)
  .join('\n')}

# User script
${script}

# Capture all variables after execution
result = {k: v for k, v in locals().items() if not k.startswith('_')}
print(json.dumps(result))
`;

  writeFileSync(scriptPath, fullScript);

  try {
    // 2. Execute Python subprocess
    const output = await new Promise<string>((resolve, reject) => {
      const python = spawn('python3', [scriptPath]);
      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
    });

    // 3. Parse output
    return JSON.parse(output.trim());
  } finally {
    // Cleanup
    unlinkSync(scriptPath);
  }
}

export async function executeJavaScript(
  script: string,
  context: Record<string, any>
): Promise<any> {
  // Option 1: Use vm module (lightweight, same process)
  const vm = require('vm');

  const sandbox = {
    ...context,
    console,  // Allow console.log
    result: undefined,
  };

  try {
    vm.createContext(sandbox);
    vm.runInContext(script, sandbox, {
      timeout: 30000,  // 30 second timeout
    });

    return sandbox.result || sandbox;
  } catch (error) {
    throw new Error(`JavaScript execution failed: ${error.message}`);
  }

  // Option 2: Use child process for full isolation (like Python)
  // Similar to executePython but with node instead of python3
}
```

---

## YAML Configuration Examples

### HTTP Request Node

```yaml
type: Sequence
id: api-workflow
children:
  - type: HttpRequest
    id: fetch-user
    props:
      url: "https://api.example.com/users/{{userId}}"
      method: "GET"
      headers:
        Authorization: "Bearer {{apiToken}}"

  - type: HttpRequest
    id: update-user
    props:
      url: "https://api.example.com/users/{{userId}}"
      method: "PUT"
      headers:
        Content-Type: "application/json"
      body:
        name: "{{userName}}"
        email: "{{userEmail}}"
```

### Python Interpreter Node

```yaml
type: Sequence
id: data-processing
children:
  # Load data
  - type: HttpRequest
    id: fetch-data
    props:
      url: "https://api.example.com/data"
      method: "GET"

  # Process with Python
  - type: PythonInterpreter
    id: analyze-data
    props:
      outputKey: "analysis"
      script: |
        import numpy as np
        import pandas as pd

        # httpResponse comes from blackboard (set by fetch-data)
        data = pd.DataFrame(httpResponse['data'])

        # Perform analysis
        mean_value = data['value'].mean()
        std_value = data['value'].std()
        outliers = data[data['value'] > mean_value + 2 * std_value]

        # Result stored in blackboard under 'analysis' key
        result = {
            'mean': mean_value,
            'std': std_value,
            'outlier_count': len(outliers),
            'outlier_ids': outliers['id'].tolist()
        }

  # Send results
  - type: HttpRequest
    id: send-results
    props:
      url: "https://api.example.com/results"
      method: "POST"
      body:
        analysis: "{{analysis}}"
```

### Database Query Node

```yaml
type: Sequence
id: user-registration
children:
  - type: DatabaseQuery
    id: check-user-exists
    props:
      connection: "postgres"
      query: "SELECT * FROM users WHERE email = $1"
      params:
        - "{{userEmail}}"
      outputKey: "existingUser"

  - type: Conditional
    id: user-check
    children:
      # Condition: user doesn't exist
      - type: Script
        id: check-not-exists
        props:
          textContent: "notExists = existingUser == null"

      # Then: Create user
      - type: DatabaseQuery
        id: create-user
        props:
          connection: "postgres"
          query: "INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id"
          params:
            - "{{userEmail}}"
            - "{{userName}}"
          outputKey: "newUserId"

      # Else: Return error
      - type: Script
        id: set-error
        props:
          textContent: "error = 'User already exists'"
```

---

## Activity Best Practices

### 1. Idempotency

Activities may be retried, so make them idempotent:

```typescript
export async function createUser(email: string, name: string): Promise<string> {
  // ✅ GOOD: Check if user exists first
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return existing.rows[0].id;  // Return existing ID, don't error
  }

  // Create new user
  const result = await db.query(
    'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
    [email, name]
  );
  return result.rows[0].id;
}
```

### 2. Heartbeats for Long Operations

For long-running activities (>30s), send heartbeats:

```typescript
import { Context } from '@temporalio/activity';

export async function processBigFile(filePath: string): Promise<void> {
  const lines = await readFileLines(filePath);

  for (let i = 0; i < lines.length; i++) {
    await processLine(lines[i]);

    // ✅ Send heartbeat every 100 lines
    if (i % 100 === 0) {
      Context.current().heartbeat({ progress: i / lines.length });
    }
  }
}
```

### 3. Timeouts and Retries

Configure appropriate timeouts:

```typescript
const activities = proxyActivities<MyActivities>({
  startToCloseTimeout: '5m',      // Total time allowed
  scheduleToCloseTimeout: '10m',  // Including retry time
  heartbeatTimeout: '30s',        // Max time between heartbeats
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '60s',
    maximumAttempts: 5,
  },
});
```

---

## Architecture Decision Guide

### When to Use Workflow Code

Use workflow code (btree nodes in `executeTick`) for:
- ✅ Control flow (Sequence, Selector, Parallel)
- ✅ Conditionals (Conditional, While)
- ✅ Timing (Timeout using `CancellationScope`, Delay using `sleep`)
- ✅ Blackboard manipulation (Script node with simple operations)
- ✅ Pure computation with blackboard data

### When to Use Activities

Use activities for:
- ✅ External API calls (HTTP, GraphQL)
- ✅ Database queries (SELECT, INSERT, UPDATE)
- ✅ File operations (read, write, process)
- ✅ Email sending
- ✅ Running subprocesses (Python, shell commands)
- ✅ Any non-deterministic operation
- ✅ Long-running computations (ML inference, video processing)

### Hybrid Approach Example

```typescript
export class DataPipeline extends CompositeNode {
  protected async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // ✅ Workflow: Control flow and orchestration
    const steps = [
      'extract',   // Activity: Fetch from API
      'transform', // Activity: Run Python transformation
      'validate',  // Workflow: Simple validation logic
      'load',      // Activity: Write to database
    ];

    for (const step of steps) {
      const child = this.getChild(step);
      const status = await child.tick(context);

      if (status === NodeStatus.FAILURE) {
        // ✅ Workflow: Error handling logic
        await this.handleError(context, step);
        return NodeStatus.FAILURE;
      }
    }

    return NodeStatus.SUCCESS;
  }
}
```

---

## Limits and Considerations

### Temporal Workflow Limits

- **Event history size**: ~50MB (after that, use Continue-As-New)
- **Execution time**: Unlimited (but use Continue-As-New for very long workflows)
- **Concurrent activities**: Worker configuration determines parallelism

### Activity Limits

- **Execution time**: Configure with `startToCloseTimeout` (can be hours/days)
- **Payload size**: 2MB per argument (use S3 for larger data)
- **Concurrency**: Worker maxConcurrentActivityTaskExecutions (default: 200)

### Interpreter Node Limits

For Python/JS interpreters, consider:

1. **Execution time**: Set reasonable timeouts (default: 5 minutes)
2. **Memory**: Limit subprocess memory usage
3. **Security**: Sandbox user code (no network, filesystem restrictions)
4. **Package management**:
   - Python: Pre-install allowed packages in worker environment
   - JS: Use allowlist of require() modules

```typescript
// Example: Restricted JavaScript interpreter
export async function executeJavaScript(
  script: string,
  context: Record<string, any>
): Promise<any> {
  const allowedModules = ['lodash', 'moment', 'date-fns'];

  const sandbox = {
    ...context,
    require: (moduleName: string) => {
      if (!allowedModules.includes(moduleName)) {
        throw new Error(`Module ${moduleName} not allowed`);
      }
      return require(moduleName);
    },
    console: {
      log: (...args: any[]) => {
        // Log to activity context instead of stdout
        Context.current().log.info('Script log:', ...args);
      },
    },
  };

  // Execute with timeout and memory limit
  const vm = require('vm');
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, {
    timeout: 30000,
    // memory limit requires custom Node.js build
  });

  return sandbox.result || sandbox;
}
```

---

## Complete Example: Multi-Node Workflow

```yaml
type: Sequence
id: ai-content-pipeline
name: AI-Powered Content Generation Pipeline

children:
  # 1. Fetch topic from API
  - type: HttpRequest
    id: fetch-topic
    props:
      url: "https://api.example.com/topics/next"
      method: "GET"

  # 2. Generate content with Python (calls OpenAI)
  - type: PythonInterpreter
    id: generate-content
    props:
      outputKey: "generatedContent"
      script: |
        import openai

        topic = httpResponse['topic']

        response = openai.ChatCompletion.create(
          model="gpt-4",
          messages=[
            {"role": "user", "content": f"Write about {topic}"}
          ]
        )

        result = {
          'content': response.choices[0].message.content,
          'tokens': response.usage.total_tokens
        }

  # 3. Validate content quality with JavaScript
  - type: JavaScriptInterpreter
    id: validate-quality
    props:
      outputKey: "qualityScore"
      script: |
        const content = generatedContent.content;

        // Simple quality checks
        const wordCount = content.split(/\s+/).length;
        const hasIntro = content.toLowerCase().includes('introduction');
        const hasConclusion = content.toLowerCase().includes('conclusion');

        result = {
          score: (wordCount > 500 ? 50 : wordCount / 10) +
                 (hasIntro ? 25 : 0) +
                 (hasConclusion ? 25 : 0),
          passThreshold: 70
        };

  # 4. Conditional: Only publish if quality is high
  - type: Conditional
    id: quality-check
    children:
      # Condition
      - type: Script
        id: check-quality
        props:
          textContent: "isQualityGood = qualityScore.score >= qualityScore.passThreshold"

      # Then: Publish
      - type: Sequence
        id: publish-sequence
        children:
          - type: DatabaseQuery
            id: save-content
            props:
              connection: "postgres"
              query: "INSERT INTO articles (topic, content, quality_score) VALUES ($1, $2, $3) RETURNING id"
              params:
                - "{{httpResponse.topic}}"
                - "{{generatedContent.content}}"
                - "{{qualityScore.score}}"
              outputKey: "articleId"

          - type: HttpRequest
            id: notify-slack
            props:
              url: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
              method: "POST"
              body:
                text: "New article published! ID: {{articleId}}"

      # Else: Queue for review
      - type: HttpRequest
        id: queue-review
        props:
          url: "https://api.example.com/review-queue"
          method: "POST"
          body:
            topic: "{{httpResponse.topic}}"
            content: "{{generatedContent.content}}"
            reason: "Low quality score: {{qualityScore.score}}"
```

This workflow:
1. **Workflow code** handles orchestration (Sequence, Conditional)
2. **Activities** handle external I/O (HTTP, Database, Python, JavaScript)
3. **Blackboard** passes data between nodes
4. **Deterministic** - can be replayed safely

---

## Summary

| Feature | Implementation | Runs In | Access Level |
|---------|---------------|---------|--------------|
| **Control Flow Nodes** | Workflow code | Sandbox | Temporal APIs only |
| **HTTP/Database Nodes** | Activity calls | Worker | Full Node.js access |
| **Interpreter Nodes** | Activity with subprocess | Worker | Subprocess with limits |
| **Data Passing** | Blackboard (workflow state) | Sandbox | Full access |

The key insight: **Workflows orchestrate, Activities execute**. Behavior tree nodes use this pattern naturally - control flow runs in workflows, I/O happens in activities.
