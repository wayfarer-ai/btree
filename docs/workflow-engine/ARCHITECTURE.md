# Workflow Engine Architecture

This document provides a visual overview of the workflow engine architecture using **direct Temporal integration** (no adapter layer).

---

## System Architecture

### Direct Integration Overview

BehaviorTree nodes execute natively as Temporal workflows. Parse YAML → build tree → call `tree.toWorkflow()` → get executable Temporal workflow.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACES                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────┐ │
│  │  Visual Builder      │  │  CLI Tool            │  │  AI Agent    │ │
│  │  (React Flow)        │  │  (Node.js)           │  │  (GPT-4)     │ │
│  ├──────────────────────┤  ├──────────────────────┤  ├──────────────┤ │
│  │ • Drag & Drop        │  │ • workflow run       │  │ • Generate   │ │
│  │ • Live Execution     │  │ • workflow validate  │  │   YAML       │ │
│  │ • Node Config        │  │ • workflow deploy    │  │ • Modify     │ │
│  │ • YAML Import/Export │  │ • workflow logs      │  │   Workflows  │ │
│  └──────────────────────┘  └──────────────────────┘  └──────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     WORKFLOW DEFINITION LAYER                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────┐ │
│  │  YAML Parser         │  │  Workflow Metadata   │  │  Builder API │ │
│  ├──────────────────────┤  ├──────────────────────┤  ├──────────────┤ │
│  │ • Parse YAML         │  │ • Name, Version      │  │ • Fluent API │ │
│  │ • Validate Schema    │  │ • Trigger Config     │  │ • addNode()  │ │
│  │ • Build Tree         │  │ • Settings           │  │ • connect()  │ │
│  │ • Serialize YAML     │  │ • Input/Output       │  │ • build()    │ │
│  └──────────────────────┘  └──────────────────────┘  └──────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 WORKFLOW DEFINITION LAYER (btree)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      BehaviorTree                                 │  │
│  │                                                                    │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │  │
│  │  │   TreeNode     │  │   TreeNode     │  │   TreeNode     │     │  │
│  │  │  (Composite)   │  │  (Decorator)   │  │   (Action)     │     │  │
│  │  │                │  │                │  │                │     │  │
│  │  │  ┌──────────┐  │  │  ┌──────────┐  │  │  ┌──────────┐  │     │  │
│  │  │  │ Sequence │  │  │  │  Retry   │  │  │  │  Script  │  │     │  │
│  │  │  ├──────────┤  │  │  ├──────────┤  │  │  ├──────────┤  │     │  │
│  │  │  │ Selector │  │  │  │ Timeout  │  │  │  │   HTTP   │  │     │  │
│  │  │  ├──────────┤  │  │  ├──────────┤  │  │  ├──────────┤  │     │  │
│  │  │  │ Parallel │  │  │  │  Delay   │  │  │  │  Email   │  │     │  │
│  │  │  ├──────────┤  │  │  ├──────────┤  │  │  ├──────────┤  │     │  │
│  │  │  │  If/Else │  │  │  │  Invert  │  │  │  │  Slack   │  │     │  │
│  │  │  ├──────────┤  │  │  └──────────┘  │  │  ├──────────┤  │     │  │
│  │  │  │  ForEach │  │  │                │  │  │ Database │  │     │  │
│  │  │  ├──────────┤  │  │                │  │  ├──────────┤  │     │  │
│  │  │  │  While   │  │  │                │  │  │   AI     │  │     │  │
│  │  │  └──────────┘  │  │                │  │  └──────────┘  │     │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                         Registry                                  │  │
│  │  • Node Type Registration                                         │  │
│  │  • Metadata (Icons, Colors, Inputs, Outputs)                     │  │
│  │  • Factory Methods                                                │  │
│  │  • Plugin Management                                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              tree.toWorkflow() → Workflow Function                │  │
│  │                                                                    │  │
│  │  Nodes execute directly as Temporal code:                        │  │
│  │  • Sequence    → for..of loop with await                         │  │
│  │  • Parallel    → Promise.all()                                   │  │
│  │  • Conditional → if/else                                         │  │
│  │  • Delay       → await sleep() (durable!)                        │  │
│  │  • HttpRequest → await activities.http()                         │  │
│  │  • Script      → Execute inline (deterministic)                  │  │
│  │  • Approval    → await condition()                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                DURABLE EXECUTION LAYER (Temporal.io)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   Temporal Workflows                              │  │
│  │  • Deterministic execution                                        │  │
│  │  • Automatic state persistence                                    │  │
│  │  • Crash recovery                                                 │  │
│  │  • Durable timers (sleep for days/weeks)                          │  │
│  │  • Workflow versioning                                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   Temporal Activities                             │  │
│  │  • External operations (HTTP, DB, Email)                          │  │
│  │  • Automatic retries with exponential backoff                     │  │
│  │  • Timeout enforcement                                            │  │
│  │  • Failure handling                                               │  │
│  │  • Heartbeats for long-running operations                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   Event-Driven Features                           │  │
│  │  • Signals (external events to running workflows)                 │  │
│  │  • Queries (read workflow state without side effects)             │  │
│  │  • Webhooks (trigger workflow continuation)                       │  │
│  │  • Schedules (cron-like triggers)                                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                 Temporal Infrastructure                           │  │
│  │  • Workflow history (complete audit trail)                        │  │
│  │  • Visibility (search and filter workflows)                       │  │
│  │  • Observability (metrics, traces, logs)                          │  │
│  │  • Multi-tenancy and namespaces                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATION LAYER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │   HTTP   │  │ Database │  │ Messaging│  │  Storage │  │   AI    │ │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤  ├─────────┤ │
│  │ • REST   │  │ • Postgres│ │ • Email  │  │ • S3     │  │ • OpenAI│ │
│  │ • GraphQL│  │ • MongoDB│  │ • Slack  │  │ • GDrive │  │ • Claude│ │
│  │ • Webhook│  │ • Redis  │  │ • Discord│  │ • Local  │  │ • Gemini│ │
│  │ • SOAP   │  │ • MySQL  │  │ • SMS    │  │ • FTP    │  │ • Custom│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Plugin System                                 │  │
│  │  • Load/Unload Plugins                                            │  │
│  │  • Custom Node Registration                                       │  │
│  │  • Lifecycle Hooks (onLoad, onUnload)                            │  │
│  │  • Dependency Management                                          │  │
│  │  • Community Marketplace                                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Workflow Creation Flow

```
User Action (Visual Builder)
    │
    ▼
Drag Node from Palette
    │
    ▼
Create Node Instance (Registry)
    │
    ▼
Configure Node (Config Panel)
    │
    ▼
Connect Nodes (Edges)
    │
    ▼
Build BehaviorTree (Builder API)
    │
    ▼
Serialize to YAML (YamlSerializer)
    │
    ▼
Save to Storage (File/Database)
```

### 2. Workflow Execution Flow (Direct Integration)

```
Load YAML
    │
    ▼
Parse YAML (YamlParser)
    │
    ▼
Build BehaviorTree
    │
    ▼
tree.toWorkflow()  ← Returns Temporal workflow function
    │              ← No conversion/adapter needed!
    ▼
┌─────────────────────────────────────────┐
│  Generated Temporal Workflow             │
│                                          │
│  async function workflow(input) {        │
│    const ctx = createContext(input);    │
│                                          │
│    // Root node executes directly       │
│    return await root.executeTick(ctx);  │
│  }                                      │
│                                          │
│  Each node's executeTick() uses         │
│  Temporal APIs directly:                │
│                                          │
│  Sequence.executeTick():                │
│    for (const child of this.children) { │
│      await child.executeTick(ctx);     │
│    }                                    │
│                                          │
│  Parallel.executeTick():                │
│    await Promise.all(                   │
│      children.map(c => c.executeTick()) │
│    );                                   │
│                                          │
│  Delay.executeTick():                   │
│    await sleep("24 hours");  ← DURABLE!│
│                                          │
│  HttpRequest.executeTick():             │
│    return await ctx.activities.http();  │
│                                          │
│  State persisted automatically          │
│  Survives crashes/restarts              │
│  Can run for days/weeks/months          │
└─────────────────────────────────────────┘
    │
    ▼
Register with Temporal Worker
    │
    ├─ workflows: { myWorkflow: tree.toWorkflow() }
    └─ activities: tree.getActivities()
    │
    ▼
Start Workflow (via Temporal Client)
    │
    ▼
Temporal Activities Execute
    │
    ├─ HTTP requests (with retries)
    ├─ Database operations
    ├─ Email/Slack notifications
    └─ External integrations
    │
    ▼
Return Result
    │
    ▼
Temporal Workflow History (automatic audit trail)
```

### 3. Event Flow

```
Node Execution
    │
    ├─▶ TICK_START ───▶ EventEmitter ───▶ Subscribers
    │                                      │
    │                                      ├─▶ Visual Builder (Highlight Node)
    │                                      ├─▶ Logger (Write Log)
    │                                      └─▶ Metrics (Track Duration)
    │
    ├─▶ TICK_END ─────▶ EventEmitter ───▶ Subscribers
    │                                      │
    │                                      ├─▶ Visual Builder (Update Status)
    │                                      ├─▶ Execution Tracker (Record)
    │                                      └─▶ Snapshot System (Capture State)
    │
    └─▶ ERROR ────────▶ EventEmitter ───▶ Subscribers
                                           │
                                           ├─▶ Visual Builder (Show Error)
                                           ├─▶ Logger (Log Error)
                                           └─▶ Alerting (Notify Admin)
```

---

## Component Interactions

### Visual Builder ↔ Core Engine

```
┌─────────────────────┐                    ┌─────────────────────┐
│  Visual Builder     │                    │   Core Engine       │
│  (React Flow)       │                    │   (btree)           │
├─────────────────────┤                    ├─────────────────────┤
│                     │                    │                     │
│  Export YAML        │───────────────────▶│  Parse YAML         │
│                     │                    │  Build Tree         │
│                     │                    │                     │
│  Import YAML        │◀───────────────────│  Serialize Tree     │
│                     │                    │  to YAML            │
│                     │                    │                     │
│  Start Execution    │───────────────────▶│  engine.execute()   │
│                     │                    │                     │
│  Subscribe Events   │◀───────────────────│  Emit Events        │
│  • TICK_START       │                    │  • Node Status      │
│  • TICK_END         │                    │  • Errors           │
│  • STATUS_CHANGE    │                    │  • Logs             │
│                     │                    │                     │
│  Update Node Colors │◀───────────────────│  Event Stream       │
│  (Green/Red/Orange) │                    │  (Real-time)        │
│                     │                    │                     │
└─────────────────────┘                    └─────────────────────┘
```

### Plugin System

```
┌─────────────────────┐
│  Plugin Manager     │
├─────────────────────┤
│                     │
│  loadPlugin()       │──┐
│      │              │  │
│      ▼              │  │
│  ┌───────────────┐ │  │
│  │ Plugin Hooks  │ │  │
│  │               │ │  │
│  │ onLoad() ────────┼──┼──▶ Register Nodes with Registry
│  │               │ │  │
│  │ onUnload() ──────┼──┼──▶ Cleanup Resources
│  │               │ │  │
│  └───────────────┘ │  │
│                     │  │
└─────────────────────┘  │
                         │
                         ▼
                    ┌─────────────────────┐
                    │   Registry          │
                    ├─────────────────────┤
                    │                     │
                    │ registerWorkflowNode│
                    │ (type, ctor, meta)  │
                    │                     │
                    │ create(type, config)│
                    │                     │
                    └─────────────────────┘
```

---

## State Management

### Workflow Context Hierarchy

```
WorkflowContext (root)
│
├─ inputs: { email: "user@example.com", name: "John" }
│
├─ outputs: { userId: "123", status: "completed" }
│
├─ errors: []
│
├─ env: { API_URL: "https://api.example.com", API_TOKEN: "..." }
│
└─ scopes:
    │
    ├─ step1 (child scope)
    │   ├─ localVar1: "value"
    │   └─ inherits from root (can read inputs, env)
    │
    ├─ step2 (child scope)
    │   ├─ localVar2: "value"
    │   └─ inherits from root
    │
    └─ step3 (child scope)
        └─ ...
```

### Execution State Machine

```
                ┌─────────┐
                │  IDLE   │
                └────┬────┘
                     │
              engine.execute()
                     │
                     ▼
                ┌─────────┐
           ┌───▶│ RUNNING │◀──┐
           │    └────┬────┘   │
           │         │        │
           │    Child Returns │
           │     RUNNING      │
           │         │        │
           │         └────────┘
           │
           │    Child Returns
           │    SUCCESS/FAILURE
           │         │
           │         ▼
           │    More Children?
           │         │
           │    Yes──┘
           │
           │    No
           │         │
           │         ▼
           │   ┌──────────┐
           └───│ COMPLETED│
               └──────────┘
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Authentication & Authorization                     │    │
│  │  • API Keys (Webhook triggers)                      │    │
│  │  • OAuth tokens (Integrations)                      │    │
│  │  • RBAC (User permissions)                          │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Secrets Management                                 │    │
│  │  • Environment variables ({{env.SECRET}})           │    │
│  │  • Encrypted storage                                │    │
│  │  • Vault integration                                │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Sandboxing                                         │    │
│  │  • Script node execution limits                     │    │
│  │  • Timeout enforcement                              │    │
│  │  • Resource quotas                                  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Input Validation                                   │    │
│  │  • Schema validation (JSON Schema)                  │    │
│  │  • Type checking                                    │    │
│  │  • Sanitization                                     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Scalability Architecture

### Development Setup

```
┌─────────────────────────────────────────────────────────────┐
│                Single Instance (Development)                 │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Web UI       │  │ Workflow     │  │ Temporal     │      │
│  │ (React Flow) │  │ Builder      │  │ Dev Server   │      │
│  │              │  │ (btree)      │  │ (Local)      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Production Setup (Temporal Cloud)

```
┌─────────────────────────────────────────────────────────────┐
│                      YOUR INFRASTRUCTURE                     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Load Balancer                                     │    │
│  └──────┬──────────────────┬──────────────────────────┘    │
│         │                  │                                │
│    ┌────▼────┐        ┌────▼────┐                          │
│    │ Web UI  │        │ Web UI  │  (Stateless)             │
│    │ Builder │        │ Builder │                           │
│    └────┬────┘        └────┬────┘                          │
│         │                  │                                │
│         └──────────┬───────┘                                │
│                    │                                        │
│         ┌──────────▼────────────┐                          │
│         │  API Server           │                          │
│         │  • YAML Parser        │                          │
│         │  • BTree Builder      │                          │
│         │  • tree.toWorkflow()  │                          │
│         └──────────┬────────────┘                          │
│                    │                                        │
│    ┌───────────────┼───────────────┐                       │
│    │               │               │                       │
│ ┌──▼────────┐ ┌───▼────────┐ ┌───▼────────┐              │
│ │ Temporal  │ │ Temporal   │ │ Temporal   │              │
│ │ Worker 1  │ │ Worker 2   │ │ Worker 3   │              │
│ │           │ │            │ │            │              │
│ │ Executes  │ │ Executes   │ │ Executes   │              │
│ │ Activities│ │ Activities │ │ Activities │              │
│ └──┬────────┘ └───┬────────┘ └───┬────────┘              │
│    │              │              │                         │
│    └──────────────┼──────────────┘                        │
│                   │                                        │
│                   ▼                                        │
│         ┌─────────────────────┐                           │
│         │   Postgres/MySQL    │                           │
│         │   (Your Data)       │                           │
│         └─────────────────────┘                           │
│                                                            │
└────────────┬───────────────────────────────────────────────┘
             │
             │ gRPC Connection
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│              TEMPORAL CLOUD (Managed Service)                │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Temporal Server (Managed)                         │    │
│  │  • Workflow orchestration                          │    │
│  │  • State persistence                               │    │
│  │  • Event history                                   │    │
│  │  • Scheduling & timers                             │    │
│  │  • Multi-region replication                        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Observability (Built-in)                          │    │
│  │  • Web UI for workflow visibility                  │    │
│  │  • Metrics & monitoring                            │    │
│  │  • Search & filtering                              │    │
│  │  • Audit logs                                      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Cost: ~$100-200/month (vs $50k-200k to build custom)
Scales automatically to millions of workflows
```

---

## Technology Stack Summary

### Core Library
- **Language**: TypeScript
- **Runtime**: Node.js / Bun
- **Workflow Definition**: btree (behavior trees)
- **Testing**: Vitest
- **Build**: tsup

### Durable Execution
- **Platform**: Temporal.io
- **SDK**: @temporalio/client, @temporalio/worker, @temporalio/workflow
- **Deployment**: Temporal Cloud (managed) or self-hosted
- **Cost**: ~$100-200/month (Cloud) vs $50k-200k (custom build)

### Visual Builder
- **Framework**: React 18
- **Visualization**: React Flow
- **Build**: Vite
- **Styling**: TailwindCSS
- **State**: Zustand/Jotai

### Storage (Your Application Data)
- **Development**: SQLite, In-Memory
- **Production**: PostgreSQL, MySQL, MongoDB
- **Note**: Workflow state managed by Temporal

### Integrations (Temporal Activities)
- **HTTP**: fetch API, axios
- **Email**: SendGrid, Nodemailer
- **Messaging**: Slack SDK, Discord.js
- **Database**: pg, mongodb, redis
- **Storage**: AWS SDK (S3), Google Cloud Storage
- **AI**: OpenAI SDK, Anthropic SDK

### DevOps
- **CI/CD**: GitHub Actions
- **Container**: Docker
- **Registry**: NPM
- **Monitoring**: Temporal UI (built-in), Datadog integration
- **Logging**: Temporal handles workflow logs

---

## Deployment Options

### 1. Development (Local Temporal Server)
```bash
# Terminal 1: Start Temporal dev server
temporal server start-dev

# Terminal 2: Start worker
npm run worker

# Terminal 3: Run workflow
npm run dev
```

### 2. Production (Temporal Cloud)
```typescript
// worker.ts
import { NativeConnection, Worker } from '@temporalio/worker';
import { YamlParser } from './yaml/parser';
import fs from 'fs';

// Parse YAML workflows
const yaml = fs.readFileSync('workflows/*.yaml', 'utf-8');
const tree = new YamlParser().parse(yaml);

// Get workflow function directly!
const workflows = {
  myWorkflow: tree.toWorkflow()
};

const activities = tree.getActivities();

// Connect to Temporal Cloud
const connection = await NativeConnection.connect({
  address: 'your-namespace.tmprl.cloud:7233',
  tls: true,
});

// Start worker
const worker = await Worker.create({
  connection,
  namespace: 'your-namespace',
  taskQueue: 'workflow-queue',
  workflows,  // Direct! No adapter needed
  activities,
});

await worker.run();
```

### 3. Self-Hosted Temporal
```yaml
# docker-compose.yml
version: '3.5'
services:
  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - 7233:7233

  worker:
    build: .
    environment:
      TEMPORAL_ADDRESS: temporal:7233
```

### 4. Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: workflow-worker
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: worker
        image: your-org/workflow-worker:latest
        env:
        - name: TEMPORAL_ADDRESS
          value: "namespace.tmprl.cloud:7233"
```

---

## Performance Characteristics

### Workflow Execution (with Temporal)
- **Workflow Start Latency**: ~50-100ms (Temporal overhead)
- **Activity Execution**: Variable (HTTP: 100ms+, DB: 10-50ms)
- **State Persistence**: Automatic (no cost to you)
- **Durable Sleep**: Zero compute cost (can sleep for months!)

### Scalability (Temporal Cloud)
- **Concurrent Workflows**: Millions (limited by your workers)
- **Workflow History Size**: Up to 50MB (50K events)
- **Execution Rate**: 1000s per second per worker
- **Workers**: Scale horizontally (add more workers)

### Cost Efficiency
- **Long-Running Workflows**: 99.99% cost reduction vs tick loops
  - Example: 10,000 workflows sleeping 24h
  - Tick loop: Continuous CPU = $24,000/day
  - Temporal sleep: Zero compute = $0/day
  - Only pay for Temporal Cloud (~$100/month)

### Memory Usage
- **Worker Memory**: ~100-200MB per worker
- **Workflow State**: Managed by Temporal (persisted to database)
- **Your Code**: Standard Node.js/TypeScript overhead

### Reliability
- **Durability**: Workflows survive crashes, restarts, deployments
- **Retries**: Automatic with exponential backoff
- **Timeouts**: Configurable at workflow and activity level
- **Versioning**: Update workflow code without breaking running instances

---

## Summary

This hybrid architecture provides:
- **Visual workflow builder** (btree + React Flow)
- **Battle-tested durable execution** (Temporal.io)
- **Cost effective** ($100/month vs $50k-200k custom build)
- **Time to market** (6-8 weeks vs 6+ months)
- **Enterprise ready** (powers Uber, Netflix, Stripe)

The combination of btree's intuitive behavior tree model with Temporal's proven infrastructure delivers a production-ready workflow automation platform without the complexity of building custom durable execution.
