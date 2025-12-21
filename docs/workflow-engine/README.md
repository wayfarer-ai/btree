# Workflow Engine Transformation Guide

This directory contains documentation for transforming the btree library from a test automation framework into a general-purpose workflow engine similar to n8n, powered by **Temporal.io for durable execution**.

## Architecture Decision

This project uses **direct Temporal integration**: btree nodes natively execute as Temporal workflows, with no adapter layer needed.

### Why Direct Integration?

- **Simple**: Each node's `executeTick()` directly uses Temporal APIs - no translation layer
- **Native**: Behavior tree IS the Temporal workflow - parse YAML, get executable workflow
- **Cost Effective**: $100/month for Temporal Cloud vs $50k-200k to build custom
- **Production Ready**: Temporal powers Uber, Netflix, Stripe - proven at scale
- **Time to Market**: Ship in 4-6 weeks instead of 6+ months

## Documentation Overview

1. **[DIRECT-TEMPORAL-INTEGRATION.md](./DIRECT-TEMPORAL-INTEGRATION.md)** - Core concept: no adapter needed! ⭐
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture
3. **[01-core-changes.md](./01-core-changes.md)** - Replace Effect-TS with Temporal APIs
4. **[02-extra-capabilities.md](./02-extra-capabilities.md)** - Workflow nodes and visual builder
5. **[03-yaml-specification.md](./03-yaml-specification.md)** - YAML workflow format
6. **[04-react-flow-integration.md](./04-react-flow-integration.md)** - Visual builder guide
7. **[05-implementation-roadmap.md](./05-implementation-roadmap.md)** - 4-6 week implementation plan
8. **[06-long-running-architecture.md](./06-long-running-architecture.md)** - How Temporal solves long-running workflows

## Quick Start

The transformation is **simpler than building from scratch** because:

### What btree Provides ✅
- Visual workflow definition (behavior trees)
- YAML serialization format
- Rich control flow (sequence, parallel, conditional, loops)
- Script nodes for data transformation
- React Flow visual builder
- Type-safe node registry

### What Temporal Provides ✅
- Durable execution that survives crashes
- Long-running workflow support (days, weeks, months)
- Event-driven architecture
- Automatic retries and error handling
- Workflow versioning and migration
- Observability and debugging tools

### What We Build 🔨
- Nodes with native Temporal execution (`executeTick()` uses Temporal APIs)
- Workflow action nodes (HTTP, Database, Email, etc.) as Temporal Activities
- Visual builder UI (React Flow integration)
- Integration ecosystem (plugins)
- YAML import/export

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Visual Builder (React)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ React Flow   │  │ Node Palette │  │ Config Panel │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│         BTree = Temporal Workflow (Direct Integration)      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ YAML Parser  │  │ BehaviorTree │  │ Node Registry│      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         │          tree.toWorkflow()          │              │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            ▼                                 │
│              Returns Temporal Workflow Function             │
│                                                              │
│  Each node's executeTick() directly uses:                   │
│  • await sleep('7 days')  - Temporal durable sleep          │
│  • await activities.http() - Proxied activities             │
│  • await condition(...)    - Signal waiting                 │
│  • Promise.all([...])      - Parallel execution             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Temporal.io (Infrastructure)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Workflows    │  │ Activities   │  │ Signals      │      │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤      │
│  │ State Mgmt   │  │ HTTP Calls   │  │ Webhooks     │      │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤      │
│  │ Versioning   │  │ Retries      │  │ Schedules    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Integration Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ HTTP/API     │  │ Database     │  │ Email/Slack  │      │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤      │
│  │ AI Services  │  │ Webhooks     │  │ Custom Nodes │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Key Insight:**
- **No adapter layer!** BehaviorTree nodes execute directly as Temporal workflow code
- `tree.toWorkflow()` returns a Temporal workflow function you can register and run
- Nodes use Temporal APIs natively in their `executeTick()` methods

## Key Design Decisions

### 1. Direct Temporal Integration (No Adapter)
**Simplest possible approach:**
- Nodes execute directly as Temporal workflow code
- No translation/adapter layer needed
- Parse YAML → get executable Temporal workflow
- 4-6 weeks to ship vs 6+ months custom build

### 2. YAML as Source of Truth
Workflows are stored in YAML format, which can be:
- Generated by AI (LLMs understand YAML well)
- Hand-edited by developers
- Created via visual builder
- Version controlled in git

### 3. BehaviorTree as Executable Workflow
The tree structure IS the Temporal workflow:
- Composites execute as native control flow (sequential await, Promise.all)
- Decorators modify child execution (retry loops, timeouts)
- Action nodes call Temporal Activities
- Visual representation for non-technical users

### 4. Temporal for Runtime Execution
Temporal provides battle-tested infrastructure:
- Durable execution (survives crashes, restarts)
- Long-running workflows (days, weeks, months)
- Automatic retries and error handling
- Event-driven architecture (signals, webhooks)
- Observability and debugging

### 5. React Flow for Visual Builder
React Flow provides:
- Interactive drag-and-drop editing
- Real-time execution visualization
- Node palette and configuration UI
- Export to/from YAML

### 6. Plugin-Based Integration Ecosystem
Following n8n's model:
- Core library stays focused
- Integrations are plugins (Temporal Activities)
- Community can contribute nodes
- TypeScript SDK for custom nodes

## Example Workflow

```yaml
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
        
  - id: conditional
    type: Conditional
    config:
      condition: isValid
      
  - id: create-user
    type: HttpRequest
    config:
      url: "{{env.API_URL}}/users"
      method: POST
      body:
        email: "{{email}}"
        name: "{{name}}"
        
  - id: notifications
    type: Parallel
    config:
      strategy: any
      
  - id: send-email
    type: EmailSend
    config:
      to: "{{email}}"
      template: welcome
      
  - id: notify-slack
    type: SlackMessage
    config:
      channel: "#signups"
      message: "New user: {{name}}"

edges:
  - source: main
    target: validate
  - source: main
    target: conditional
  - source: main
    target: create-user
  - source: main
    target: notifications
  - source: notifications
    target: send-email
  - source: notifications
    target: notify-slack
```

## Getting Started

1. Read the documentation in order (01-05)
2. Review the implementation roadmap
3. Start with Phase 1: Core Adaptations
4. Build incrementally, testing each phase

## Contributing

This is a transformation guide. As you implement features:
- Update the docs with actual implementation details
- Add code examples and API references
- Document any deviations from the plan
- Keep the roadmap updated

## Questions?

Open an issue in the repository for:
- Clarification on design decisions
- Implementation questions
- Feature requests
- Bug reports
