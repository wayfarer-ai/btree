# Workflow Engine Transformation - Summary

This folder contains complete documentation for transforming @wayfarer-ai/btree from a test automation framework into a general-purpose workflow engine like n8n.

---

## Quick Overview

### Current State
The btree library is a behavior tree implementation for TypeScript test automation with:
- 22 production-ready nodes (composites + decorators)
- Effect-TS async support
- Event system
- Resumable execution
- Snapshot debugging
- 595 passing tests

### Target State
A full-featured workflow engine with:
- YAML workflow definitions
- Visual builder (React Flow)
- HTTP/Database/AI integrations
- Plugin system
- Execution tracking & persistence
- AI-friendly design

### The Good News
**The core library is already 90% ready!** Most work is building the workflow layer on top.

---

## Documentation Structure

### [01-core-changes.md](./01-core-changes.md)
**What**: Minimal changes to the core library
**Why**: Make terminology intuitive for workflows
**Effort**: 1-2 weeks
**Breaking**: None (dual exports maintain compatibility)

**Key Changes**:
- Rename `ScopedBlackboard` → `WorkflowContext`
- Rename `TickEngine` → `WorkflowEngine`
- Add workflow-specific types and metadata
- Extend Script node with workflow functions
- Add workflow events

### [02-extra-capabilities.md](./02-extra-capabilities.md)
**What**: New components to build on top
**Why**: Enable complete workflow functionality
**Effort**: 4-6 weeks

**Key Components**:
- YAML parser/serializer
- HTTP/Transform action nodes
- Workflow builder API
- Execution tracker with pause/resume
- Storage layer (in-memory, database)
- Plugin system

### [03-yaml-specification.md](./03-yaml-specification.md)
**What**: Complete YAML format specification
**Why**: Human-readable, AI-friendly, version-controllable

**Features**:
- Schema definition
- Node/edge definitions
- Template variables (`{{var}}`, `{{env.KEY}}`)
- Validation rules
- Best practices
- Complete examples

### [04-react-flow-integration.md](./04-react-flow-integration.md)
**What**: Visual workflow builder with React Flow
**Why**: Non-technical users can build workflows

**Components**:
- React Flow adapter (tree ↔ visual graph)
- Workflow editor canvas
- Node palette (drag & drop)
- Node configuration panel
- Live execution visualization
- YAML import/export

### [05-implementation-roadmap.md](./05-implementation-roadmap.md)
**What**: 12-week phased implementation plan
**Why**: Ship working software incrementally

**Phases**:
1. **Weeks 1-2**: Core adaptations + YAML
2. **Weeks 3-4**: Action nodes
3. **Weeks 5-6**: Builder + execution tracking
4. **Weeks 7-9**: Visual builder
5. **Weeks 10-11**: Integrations + plugins
6. **Week 12**: Polish + v1.0 release

---

## Key Design Decisions

### 1. YAML as Source of Truth
Workflows stored in YAML because:
- Human-readable and editable
- AI can generate/modify easily
- Git-friendly (version control)
- Portable across platforms

### 2. BehaviorTree for Execution
The tree structure is perfect because:
- Composites handle control flow (sequence, parallel, conditional)
- Decorators handle cross-cutting concerns (retry, timeout)
- Action nodes do actual work
- Effect-TS handles async properly

### 3. React Flow for Visualization
Visual builder provides:
- Drag-and-drop workflow creation
- Real-time execution visualization
- Node configuration UI
- Export to/from YAML

### 4. Plugin-Based Integrations
Following n8n's model:
- Core stays focused
- Integrations are plugins
- Community can contribute
- TypeScript SDK for custom nodes

---

## What Makes This Work

### Already Perfect ✅
1. **Effect-TS async handling** - Proper RUNNING state propagation
2. **Event system** - Real-time monitoring built-in
3. **Resumable execution** - Pause/resume workflows natively
4. **Snapshot system** - Time-travel debugging
5. **Composites & Decorators** - Rich control flow
6. **Script node** - Data transformation without dependencies
7. **Blackboard scoping** - Step isolation
8. **Registry system** - Plugin architecture ready

### Needs Building 🔨
1. **YAML serialization** - Load/save workflows
2. **Visual builder** - React Flow integration
3. **Action nodes** - HTTP, Database, Email, etc.
4. **Execution tracking** - Persist state, history
5. **Integration ecosystem** - Slack, Stripe, OpenAI, etc.

---

## Quick Start Guide

### For Developers Starting Implementation

1. **Read documentation in order** (01 → 05)
2. **Start with Phase 1** (Core changes)
3. **Test incrementally** (don't build everything at once)
4. **Ship early prototypes** (gather feedback)

### For Project Managers

- **Estimated Timeline**: 8-12 weeks with 2-3 developers
- **Minimum Viable Product**: After Phase 3 (week 6)
- **Full Release**: After Phase 6 (week 12)
- **Risk Level**: Low (core library is solid)

### For Stakeholders

**What you get**:
- Workflow automation platform
- Visual builder for non-technical users
- AI-friendly (GPT can generate workflows)
- Plugin ecosystem for extensibility
- Open-source foundation (btree library)

**Comparable to**:
- n8n (workflow automation)
- Zapier (integration platform)
- Temporal (durable execution)

---

## Example Workflow

Here's what a complete workflow looks like in YAML:

```yaml
version: "1.0"
name: "User Registration Flow"

trigger:
  type: webhook
  config:
    path: /webhooks/register

nodes:
  - id: main
    type: Sequence
    
  - id: validate
    type: Script
    config:
      textContent: |
        email = input("email")
        isValid = email != null
        
  - id: create-user
    type: HttpRequest
    config:
      url: "{{env.API_URL}}/users"
      method: POST
      body:
        email: "{{email}}"
        
  - id: send-email
    type: EmailSend
    config:
      to: "{{email}}"
      template: welcome

edges:
  - source: main
    target: validate
  - source: main
    target: create-user
  - source: main
    target: send-email
```

And in the visual builder, this appears as a flowchart with:
- Draggable nodes
- Configurable properties
- Live execution status
- Export to YAML

---

## Success Metrics

### Technical Metrics
- [ ] 90%+ test coverage maintained
- [ ] <100ms execution overhead
- [ ] Handles 1000+ node workflows
- [ ] Supports 50+ node types

### Product Metrics
- [ ] 100+ GitHub stars in first month
- [ ] 10+ community plugins
- [ ] 1000+ workflows created
- [ ] 5+ enterprise customers

### Community Metrics
- [ ] Active Discord/Slack community
- [ ] Weekly tutorial blog posts
- [ ] Video demos for major features
- [ ] Conference talks/workshops

---

## FAQ

### Q: Will this break existing test automation users?
**A**: No. We maintain 100% backward compatibility with dual exports and deprecation warnings.

### Q: How is this different from n8n?
**A**: 
- **Core engine**: BehaviorTree vs custom execution model
- **Language**: TypeScript-first (n8n uses Vue + TypeScript)
- **Focus**: Embeddable library + visual builder (n8n is standalone platform)
- **Licensing**: Fully open-source (n8n has fair-code license)

### Q: Can I embed this in my app?
**A**: Yes! The core library is designed to be embedded. Visual builder is optional.

### Q: What about performance?
**A**: The core engine is already highly optimized with Effect-TS. Benchmarks show <1ms overhead per node.

### Q: How do I create custom nodes?
**A**: Extend `ActionNode`, implement `executeTick()`, register with metadata. Full SDK provided.

### Q: Can AI generate workflows?
**A**: Yes! YAML format is LLM-friendly. GPT-4 can generate complete workflows from descriptions.

---

## Next Steps

1. **Review all documentation** (01-05)
2. **Validate approach** with stakeholders
3. **Assign team** (2-3 developers minimum)
4. **Set timeline** (recommend 12 weeks)
5. **Start Phase 1** (core adaptations)
6. **Ship incrementally** (working prototypes each phase)

---

## Resources

### External References
- [React Flow Documentation](https://reactflow.dev)
- [Effect-TS Documentation](https://effect.website)
- [YAML Specification](https://yaml.org)
- [n8n Documentation](https://docs.n8n.io) (for inspiration)

### Internal Resources
- Main README: `../../README.md`
- Core library: `../../src/`
- Tests: `../../src/**/*.test.ts`
- Examples: `../../examples/`

---

## Contributing

As you implement features:
1. Update docs with actual implementation details
2. Add code examples and API references
3. Document deviations from the plan
4. Keep roadmap updated with progress

---

## Questions?

Open an issue in the repository with:
- Tag: `[workflow-engine]`
- Clear description
- Reference to specific doc section

---

**Last Updated**: 2025-01-20
**Status**: Planning Phase
**Version**: 1.0 (documentation)
