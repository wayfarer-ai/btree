# Implementation Roadmap (Direct Temporal Integration)

## ✅ Current Status

**Core Integration** - ✅ **COMPLETE**
- Temporal integration working natively with btree nodes
- YAML workflows execute in Temporal
- `tree.toWorkflow()` converts behavior trees to Temporal workflows
- Universal `yamlWorkflow` loader for all YAML workflows
- All 534 tests passing

**YAML System** - ✅ **COMPLETE**
- Zod schema validation for all 32 node types
- 4-stage validation pipeline (syntax, structure, config, semantic)
- `registerStandardNodes()` utility for easy setup
- Working examples running in Temporal

**Examples & Documentation** - ✅ **COMPLETE**
- 3 working YAML examples: simple-sequence, parallel-timeout, order-processing
- 2 reference examples: ecommerce-checkout, ai-agent-workflow
- Complete documentation in README and yaml-specification.md
- Temporal integration examples in examples/temporal/

**Next Steps** (Future Work):
- Phase 3: Workflow Nodes (HTTP, Database, Email, etc.)
- Phase 4: Visual Builder (React Flow integration)
- Phase 5: Production deployment and monitoring

---

This document outlines the implementation plan for **direct Temporal integration** - where btree nodes execute natively as Temporal workflows.

**Original Timeline**: 4-6 weeks
**Actual Timeline**: Phase 1-2 complete (2 weeks)
**Team Size**: 2-3 developers
**Delivery**: Production-ready workflow automation platform

---

## Executive Summary

### What Makes This Faster?

| Approach | Build | Timeline | Cost |
|----------|-------|----------|------|
| **Custom** | Everything from scratch | 6+ months | $50k-200k eng time |
| **Direct Integration** (btree + Temporal) | Update executeTick() + workflow nodes | 4-6 weeks | $100/mo + eng time |

**Key Insight**: We're making nodes execute natively as Temporal code, not building a translation layer.

---

## Phase 1: Core Changes (Week 1-2)

### Week 1: Update Base Classes

**Goal**: Change btree core to use Temporal APIs directly

**Tasks**:
1. Update `src/types.ts` with TemporalContext
   - Define `TemporalContext` interface
   - Remove Effect-TS types
   - Duration: 0.5 days

2. Update base node classes
   - Change `executeTick()` signature: `Effect.Effect<NodeStatus>` → `Promise<NodeStatus>`
   - Update `BaseNode`, `CompositeNode`, `DecoratorNode`, `ActionNode`
   - Duration: 1 day

3. Update composite nodes to use Temporal patterns
   - **Sequence**: Sequential `await` calls
   - **Parallel**: `Promise.all()`
   - **Selector**: Try each until success
   - **Conditional**: Native `if/else`
   - Duration: 1.5 days

4. Update decorator nodes
   - **Retry**: Loop with durable `sleep()` for backoff
   - **Timeout**: `CancellationScope.cancellable()`
   - **Invert**: Flip status
   - Duration: 1 day

5. Add `tree.toWorkflow()` method to BehaviorTree
   - Returns Temporal workflow function
   - Creates TemporalContext
   - Executes root node
   - Duration: 1 day

**Deliverable**: btree v2.0.0 with direct Temporal integration

---

### Week 2: Testing & Package Updates

**Goal**: Ensure core changes work correctly

**Tasks**:
1. Remove Effect-TS dependency
   - Update `package.json`
   - Add Temporal SDK dependencies
   - Duration: 0.5 days

2. Update all existing tests
   - Change from Effect.runPromise() to direct await
   - Update test fixtures
   - Duration: 2 days

3. Write integration tests
   - Test `tree.toWorkflow()` output
   - Test TemporalContext handling
   - Test all composite/decorator nodes
   - Duration: 2 days

4. Remove TickEngine (no longer needed)
   - Delete `src/tick-engine.ts`
   - Update imports across codebase
   - Duration: 0.5 days

**Deliverable**: All tests passing with Temporal integration

---

## Phase 2: Workflow Nodes (Week 3-4)

### Week 3: Core Action Nodes

**Goal**: Implement essential workflow nodes as Temporal Activities

**Tasks**:
1. Create new package: `packages/workflow-nodes/`
   - Duration: 0.5 days

2. Implement HTTP Request node
   - GET, POST, PUT, DELETE, PATCH
   - Template variable substitution (`{{var}}`)
   - Headers, body, authentication
   - Activity implementation with retry policy
   - Duration: 1.5 days

3. Implement Database nodes
   - PostgreSQL query node
   - MongoDB query node
   - Generic SQL node
   - Duration: 2 days

4. Implement Email node
   - SendGrid integration
   - Template support
   - Duration: 1 day

5. Implement Delay/Sleep node
   - Uses Temporal's durable `sleep()`
   - Support for "5m", "2 hours", "3 days" format
   - Duration: 0.5 days

**Deliverable**: 5 core workflow nodes ready for use

---

### Week 4: Event-Driven Nodes

**Goal**: Implement nodes that leverage Temporal's event-driven capabilities

**Tasks**:
1. Implement Human Approval node
   - Wait for approval signal
   - Timeout support
   - Send approval email activity
   - Duration: 1.5 days

2. Implement Webhook node
   - Trigger workflow via webhook
   - Wait for webhook callback
   - Duration: 1.5 days

3. Implement Schedule/Cron node
   - Temporal schedule integration
   - Cron expression support
   - Duration: 1 day

4. Write integration tests
   - Test each node in isolation
   - Test combinations
   - End-to-end workflow test
   - Duration: 1.5 days

**Deliverable**: Complete set of workflow nodes

**Validation**: End-to-end workflow test
```yaml
version: "1.0"
name: "User Onboarding"
nodes:
  - id: sequence
    type: Sequence
  - id: create-user
    type: HttpRequest
    config:
      url: "{{env.API_URL}}/users"
      method: POST
  - id: send-email
    type: EmailSend
    config:
      to: "{{user.email}}"
      template: "welcome"
  - id: wait-verification
    type: HumanApproval
    config:
      timeout: "7 days"
edges:
  - source: sequence
    target: create-user
  - source: sequence
    target: send-email
  - source: sequence
    target: wait-verification
```

---

## Phase 3: Visual Builder (Week 5)

### Week 5: React Flow Integration

**Goal**: Build visual workflow editor

**Tasks**:
1. Create new package: `packages/visual-builder/`
   - Setup Vite + React + TypeScript
   - Add React Flow dependency
   - Duration: 0.5 days

2. Implement `BTreeToReactFlow` adapter
   - Convert btree → React Flow nodes/edges
   - Convert React Flow nodes/edges → btree
   - Duration: 1.5 days

3. Build core components
   - `WorkflowEditor` - main editor component
   - `CustomNode` - styled workflow node component
   - `NodePalette` - drag-and-drop node library
   - `NodeConfigPanel` - edit node properties
   - Duration: 2 days

4. Implement YAML import/export
   - Load YAML → display in editor
   - Export editor → YAML file
   - Duration: 0.5 days

5. Add execution button
   - Call `tree.toWorkflow()` directly
   - Start Temporal workflow
   - Display workflow ID
   - Duration: 0.5 days

**Deliverable**: Functional visual editor that generates Temporal workflows

---

## Phase 4: Integration & Polish (Week 6)

### Week 6: Temporal Cloud Setup & Documentation

**Goal**: Deploy to Temporal Cloud and finalize

**Tasks**:
1. Setup Temporal Cloud account
   - Create namespace
   - Configure workers
   - Duration: 0.5 days

2. Build execution viewer
   - Subscribe to Temporal workflow events
   - Highlight nodes as they execute
   - Show success/failure states
   - Duration: 1.5 days

3. Write deployment guide
   - Local development setup
   - Temporal Cloud deployment
   - Self-hosted Temporal
   - Duration: 1 day

4. Write user documentation
   - Getting started guide
   - Node reference
   - YAML specification
   - Examples
   - Duration: 1.5 days

5. Polish and testing
   - UI/UX polish
   - End-to-end testing
   - Performance testing
   - Duration: 1.5 days

**Deliverable**: Production-ready v1.0

---

## Resource Requirements

### Team Composition

**Option 1: 3 developers (4 weeks)**
- Developer 1: Core btree changes (Weeks 1-2)
- Developer 2: Workflow nodes (Weeks 3-4)
- Developer 3: Visual builder (Weeks 5-6)

**Option 2: 2 developers (6 weeks)**
- Developer 1: Core + workflow nodes
- Developer 2: Visual builder + docs

### Infrastructure

| Service | Purpose | Cost |
|---------|---------|------|
| Temporal Cloud | Workflow execution | $100-200/month |
| Vercel | Visual builder hosting | $0-20/month |
| GitHub | Code hosting | $0 |
| NPM | Package registry | $0 |

**Total Monthly**: ~$100-220/month

### Dependencies

- `@temporalio/client` - Temporal client SDK
- `@temporalio/worker` - Temporal worker SDK
- `@temporalio/workflow` - Temporal workflow SDK
- `@temporalio/activity` - Temporal activity SDK
- `react-flow` - Visual workflow editor
- `yaml` - YAML parsing
- `zod` - Schema validation

---

## Migration Path

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

## Risk Mitigation

### Risk 1: Temporal Learning Curve

**Mitigation**:
- Week 1: Team does Temporal tutorials
- Consult Temporal documentation
- Join Temporal Slack community

### Risk 2: Complex Workflows Edge Cases

**Mitigation**:
- Start with simple workflows
- Incrementally add complexity
- Comprehensive test suite

### Risk 3: Breaking Changes

**Mitigation**:
- This is a major version bump (v2.0.0)
- Clear migration guide
- Provide both versions temporarily

---

## Success Metrics

### Week 2 Milestone
- ✅ Core btree updated to use Temporal APIs
- ✅ All tests passing
- ✅ `tree.toWorkflow()` returns executable workflow

### Week 4 Milestone
- ✅ 8+ workflow nodes implemented
- ✅ End-to-end workflow executes on Temporal
- ✅ All nodes tested

### Week 6 (Launch)
- ✅ Visual builder can create workflows
- ✅ Documentation complete
- ✅ 5+ example workflows
- ✅ Deployed to Temporal Cloud

---

## Post-Launch Roadmap (Future)

### Month 2-3: Integration Ecosystem
- Slack, Discord, Twilio nodes
- AWS S3, Google Drive nodes
- Stripe, PayPal payment nodes
- OpenAI, Anthropic AI nodes

### Month 4-6: Advanced Features
- Workflow versioning
- A/B testing workflows
- Workflow analytics
- Marketplace for community nodes

### Month 6+: Enterprise Features
- Multi-tenancy
- RBAC and permissions
- Audit logging
- SLA monitoring

---

## Comparison: Adapter vs Direct Integration

| Feature | With Adapter | Direct Integration |
|---------|-------------|-------------------|
| **Timeline** | 6-8 weeks | 4-6 weeks |
| **Code to Write** | ~15k lines | ~10k lines |
| **Mental Model** | Tree → Adapter → Temporal | Tree IS Temporal |
| **Adapter Code** | ~500 lines | 0 lines (removed!) |
| **Debugging** | 3 layers | 2 layers |
| **Maintenance** | Higher | Lower |

---

## Detailed Week-by-Week Breakdown

### Week 1
- Day 1-2: Update type definitions and base classes
- Day 3-4: Update composite nodes (Sequence, Parallel, etc.)
- Day 5: Update decorator nodes (Retry, Timeout)

### Week 2
- Day 1-2: Add tree.toWorkflow() and remove Effect-TS
- Day 3-4: Update all tests
- Day 5: Integration testing

### Week 3
- Day 1-2: HTTP Request node + activity
- Day 3-4: Database nodes + activities
- Day 5: Email + Delay nodes

### Week 4
- Day 1-2: Human Approval + Webhook nodes
- Day 3: Schedule/Cron node
- Day 4-5: Integration testing

### Week 5
- Day 1: Setup visual builder project
- Day 2-3: React Flow integration
- Day 4: Build UI components
- Day 5: YAML import/export + execution button

### Week 6
- Day 1: Temporal Cloud setup
- Day 2-3: Build execution viewer
- Day 4: Write documentation
- Day 5: Polish and final testing

---

## Conclusion

The direct integration approach delivers a **production-ready workflow automation platform in 4-6 weeks** instead of 6+ months by:

1. **Removing the adapter layer** - nodes execute natively as Temporal code
2. **Leveraging Temporal** for durable execution (don't rebuild the wheel)
3. **Focusing on UX** - visual builder + YAML format
4. **Native execution** - `tree.toWorkflow()` returns executable workflow

**Next Steps**:
1. Get team onboarded with Temporal
2. Start Phase 1: Core changes
3. Setup Temporal Cloud account (free tier for development)
4. Weekly demos to stakeholders

**Result**: Ship faster, simpler codebase, native Temporal integration.
