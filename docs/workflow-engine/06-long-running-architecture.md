# Long-Running Workflow Architecture (Temporal Solution)

## Critical Architectural Difference

### Test Automation (Current btree Usage)
- **Lifetime**: Minutes (typically 1-10 minutes)
- **Execution Model**: Synchronous tick loop with tight polling
- **State**: In-memory, short-lived
- **Async Pattern**: Tight polling (0-16ms delays) until RUNNING → SUCCESS/FAILURE
- **Resource Model**: Keep process alive for entire execution

### Workflow Automation (Target with Temporal)
- **Lifetime**: Hours to days (potentially weeks/months)
- **Execution Model**: Event-driven, triggered by external events
- **State**: Temporal handles persistence automatically
- **Async Pattern**: Durable sleep until external event (no polling!)
- **Resource Model**: Zero compute cost while sleeping

---

## The Problem with Tick Loops

### Current btree Implementation
```typescript
// This works fine for 5-minute test runs
async tickWhileRunning(blackboard, maxTicks) {
  let status;
  do {
    status = await this.tick(blackboard);

    if (status === NodeStatus.RUNNING) {
      const delayMs = this.delayStrategy.getDelayAndAdvance();
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  } while (status === NodeStatus.RUNNING);

  return status;
}
```

### Problems for Long-Running Workflows

**Example Scenario**: 10,000 workflows each waiting 24 hours for user approval

| Metric | Tick Loop Approach | Cost |
|--------|-------------------|------|
| Compute Time | 10,000 × 24 hours = 240,000 hours | $24,000/day |
| Memory | 10,000 × 100MB = 1TB RAM | Not scalable |
| Reliability | Process crash = lost state | Manual recovery |

1. **Resource Waste**: Process sits idle for hours waiting for HTTP response or user input
2. **Memory Leak Risk**: Long-lived processes accumulate memory
3. **Scalability**: Can't run 10,000 concurrent workflows with this pattern
4. **Cost**: Serverless platforms charge for execution time (expensive for 24-hour workflows)
5. **Reliability**: Process crash = lost state, no automatic recovery

---

## How Temporal Solves This

### Durable Sleep (Zero Compute Cost)

```typescript
// btree node definition
- id: wait-approval
  type: Delay
  config:
    duration: "7 days"  // Wait 7 days for user approval

// Converts to Temporal workflow
import { sleep } from '@temporalio/workflow';

async function workflow() {
  await doSomething();

  // Durable sleep - ZERO compute cost!
  // Workflow state is persisted
  // Process exits and releases resources
  // Temporal wakes it up after 7 days
  await sleep('7 days');

  await doSomethingElse();
}
```

**How it works**:
1. Workflow executes until `sleep()`
2. Temporal persists workflow state to database
3. Process exits (releases CPU/memory)
4. Temporal timer service tracks the deadline
5. After 7 days, Temporal spawns new worker process
6. Worker loads workflow state from database
7. Execution continues from where it left off

**Cost Comparison**:
- Tick loop: 7 days × 24 hours × $0.10/hour = **$16.80 per workflow**
- Temporal sleep: ~2 seconds of compute = **$0.0001 per workflow**
- **Savings**: 99.999%

---

## Architecture Comparison

### OLD: Custom Tick Loop (What We're NOT Building)

```
┌─────────────────────────────────────────────────────┐
│  Workflow Process (Runs for days)                   │
│                                                      │
│  while (status === RUNNING) {                       │
│    tick();                                          │
│    if (RUNNING) sleep(100ms);  ← $$$$ Wasteful!    │
│  }                                                  │
│                                                      │
│  Problems:                                          │
│  - Process runs 24/7                                │
│  - High memory usage                                │
│  - No crash recovery                                │
│  - No scalability                                   │
└─────────────────────────────────────────────────────┘
```

### NEW: Direct Temporal Integration (What We're Building)

```
┌──────────────────────────────────────────────────────────┐
│  btree Visual Definition                                 │
│  ┌────────────────────────────────────────────┐         │
│  │  - Send Email                               │         │
│  │  - Wait 7 days (Delay node)                │         │
│  │  - Wait for approval (HumanApproval node)  │         │
│  │  - Send followup email                     │         │
│  └────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────┘
                      │
                      ▼ tree.toWorkflow() (direct!)
┌──────────────────────────────────────────────────────────┐
│  Temporal Workflow (Direct Execution)                    │
│                                                           │
│  // Each node's executeTick() uses Temporal APIs:        │
│                                                           │
│  async executeTick(context) {                            │
│    await context.activities.sendEmail();                 │
│                                                           │
│    await sleep('7 days');  ← DURABLE! Zero cost!        │
│                                                           │
│    await condition(() => approved, '30 days');           │
│    ↑ Waits for signal, zero compute while waiting       │
│                                                           │
│    await context.activities.sendFollowupEmail();         │
│  }                                                       │
│                                                           │
│  Benefits:                                               │
│  ✅ State auto-persisted by Temporal                    │
│  ✅ Crash recovery automatic                            │
│  ✅ Scales to millions of workflows                     │
│  ✅ Zero compute cost while sleeping/waiting            │
│  ✅ Built-in observability (Temporal UI)                │
│  ✅ No adapter layer needed                             │
└──────────────────────────────────────────────────────────┘
```

---

## Temporal Features for Long-Running Workflows

### 1. Durable Sleep

```typescript
// Sleep for any duration - zero compute cost
await sleep('5 minutes');
await sleep('2 hours');
await sleep('7 days');
await sleep('30 days');
await sleep('1 year');  // Yes, really!
```

**How it works**: Temporal persists state, exits process, restarts after duration.

### 2. Signals (External Events)

```typescript
// Wait for external approval signal
import { condition, defineSignal, setHandler } from '@temporalio/workflow';

const approvalSignal = defineSignal('approval');
let approved = false;

setHandler(approvalSignal, () => {
  approved = true;
});

// Wait for signal (or timeout after 30 days)
await condition(() => approved, '30 days');

// Continue execution after signal received
```

**How it works**: Workflow waits, process exits, Temporal receives signal, restarts workflow.

### 3. Cron/Schedules

```typescript
// Run workflow on a schedule
client.schedule.create({
  scheduleId: 'daily-report',
  spec: {
    cronExpressions: ['0 9 * * *'],  // Every day at 9am
  },
  action: {
    type: 'startWorkflow',
    workflowType: 'generateReport',
  },
});
```

**How it works**: Temporal scheduler triggers workflow at specified times.

### 4. Automatic State Persistence

```typescript
async function workflow(input: any) {
  let state = { step: 0, data: [] };

  state.step = 1;
  await doStep1();  // State auto-saved

  await sleep('1 day');  // Process exits, state persisted

  state.step = 2;  // Workflow resumes here after 1 day
  await doStep2();  // State still intact!

  return state;  // Complete audit trail in Temporal
}
```

**How it works**: Temporal records every state change in event history, can replay to any point.

### 5. Crash Recovery

```typescript
// Worker crashes during workflow execution
async function workflow() {
  await step1();  // ✅ Completed
  await step2();  // ✅ Completed
  await step3();  // ⚡ Worker crashes here!
  // ... workflow was executing step3 when crash occurred
}

// Temporal automatically:
// 1. Detects worker is down
// 2. Spawns new worker
// 3. Replays workflow from event history
// 4. Resumes from step3 (doesn't re-run step1, step2)
```

**How it works**: Temporal's event sourcing + deterministic replay ensures exactly-once execution.

---

## Cost Comparison: Real Numbers

### Scenario: User Onboarding Workflow

```yaml
# Workflow definition
workflow:
  - Send welcome email (5 seconds)
  - Wait 24 hours for email verification
  - Send reminder if not verified (5 seconds)
  - Wait 7 days
  - Send survey (5 seconds)
```

### Cost Analysis (10,000 concurrent workflows)

| Component | Tick Loop | Temporal | Savings |
|-----------|-----------|----------|---------|
| **Compute Time** | 10,000 × 192 hours | 10,000 × 15 seconds | 99.998% |
| **Daily Cost (AWS Lambda)** | $24,000 | $0.83 | 99.997% |
| **Memory Used** | 1TB RAM | 0 (between events) | 100% |
| **Infrastructure** | Custom DB, queue, workers | Temporal Cloud $100/mo | 99.6% |
| **Engineering Time** | 6 months to build | 6-8 weeks | 67-83% |

---

## What We DON'T Need to Build

Because Temporal provides these features, we **skip building**:

- ❌ Custom state persistence layer
- ❌ Message queue for resume events
- ❌ Webhook service for external triggers
- ❌ Scheduler service for cron jobs
- ❌ Worker orchestration
- ❌ Failure recovery logic
- ❌ Execution history tracking
- ❌ Observability dashboard
- ❌ Adapter/translation layer (direct integration!)

**Estimated savings**: 4-5 months of engineering time + $50k-150k in development costs

---

## What We DO Build

Focus on the **user experience**:

1. **tree.toWorkflow()** - Method that returns executable Temporal workflow
2. **Visual Builder** - React Flow UI for workflow design
3. **Workflow Nodes** - HTTP, Email, Database, etc. (as Temporal Activities)
4. **YAML Parser** - AI-friendly workflow format

**Estimated effort**: 4-6 weeks

---

## Migration Path

### Phase 1: Update executeTick() (Week 1)
```typescript
// Update nodes to use Temporal APIs directly
export class Delay extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    await sleep(this.config.duration);  // Native Temporal!
    return NodeStatus.SUCCESS;
  }
}
```

### Phase 2: Add tree.toWorkflow() (Week 1-2)
```typescript
// BehaviorTree method that returns Temporal workflow
const workflow = tree.toWorkflow();
const activities = tree.getActivities();
```

### Phase 3: Deploy to Temporal Cloud (Week 6)
```bash
# Setup Temporal Cloud account
# Deploy workers
# Start executing workflows
```

---

## Example: Before vs After

### Before (Tick Loop)
```typescript
// Runs for 7 days straight
async function userOnboarding(email: string) {
  await sendWelcomeEmail(email);

  // Wasteful: process runs for 7 days checking every 100ms
  const start = Date.now();
  while (Date.now() - start < 7 * 24 * 60 * 60 * 1000) {
    await sleep(100);  // Tick delay
    // Check if user verified? (not even implemented!)
  }

  await sendSurvey(email);
}
```

### After (Temporal - Direct Integration)
```typescript
// From btree Delay node
import { sleep } from '@temporalio/workflow';

export class Delay extends ActionNode {
  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    // Durable sleep - zero compute cost for 7 days!
    await sleep('7 days');
    return NodeStatus.SUCCESS;
  }
}

// tree.toWorkflow() creates:
async function userOnboarding(input: any) {
  await emailNode.executeTick(context);  // Send welcome email
  await delayNode.executeTick(context);  // Sleep 7 days (durable!)
  await surveyNode.executeTick(context); // Send survey
}

// Temporal handles:
// - State persistence
// - Process management
// - Crash recovery
// - Observability
```

---

## Conclusion

### Key Insight

**Building custom durable execution is hard and expensive. Temporal solved this problem at scale (Uber, Netflix, Stripe use it). We should leverage it.**

### Decision

Use **direct Temporal integration**:
- btree: Visual workflow definition (YAML + behavior trees)
- Temporal: Durable execution infrastructure
- Direct: Nodes execute natively as Temporal code (no adapter!)

### Result

Production-ready workflow automation platform in **4-6 weeks** instead of **6+ months**, at **$100/month** instead of **$5k-20k/month**.

---

## References

- [Temporal Documentation](https://docs.temporal.io/)
- [Temporal TypeScript SDK](https://typescript.temporal.io/)
- [Why Temporal?](https://temporal.io/blog/why-temporal)
- [Durable Execution](https://docs.temporal.io/workflows#durable-execution)
