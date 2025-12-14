# @wayfarer-ai/btree

Core behavior tree implementation for TypeScript, designed for AI-native test automation.

## Features

- ✅ **22 Production-Ready Nodes**: 11 composites + 10 decorators + 1 scripting node for comprehensive control flow
- ✅ **Full Async Support**: Effect-TS powered async operations with proper RUNNING state management
- ✅ **Hierarchical Blackboard**: Scoped data storage with inheritance and deep cloning
- ✅ **Resumable Execution**: Pause, modify, and resume execution mid-flight for debugging
- ✅ **Event System**: Observable node lifecycle events for real-time monitoring
- ✅ **Smart Execution Snapshots**: Capture-on-change with diffs & execution traces for efficient debugging
- ✅ **Type-Safe**: Strongly typed TypeScript with **595 tests passing** (95%+ coverage)

## Installation

```bash
npm install @wayfarer-ai/btree
```

## Quick Start

```typescript
import {
  Sequence,
  PrintAction,
  ScopedBlackboard,
  TickEngine
} from '@wayfarer-ai/btree';

// Create a behavior tree
const sequence = new Sequence({ id: 'main' });
sequence.addChildren([
  new PrintAction({ id: 'hello', message: 'Hello' }),
  new PrintAction({ id: 'world', message: 'World!' })
]);

// Execute it
const blackboard = new ScopedBlackboard();
const engine = new TickEngine(sequence);
await engine.tick(blackboard);
```

## Node Types

### Core Composites (11)
| Node | Purpose | Use Case |
|------|---------|----------|
| `Sequence` | Execute in order | Happy path flows |
| `Selector` | Try until success | Fallback strategies |
| `Parallel` | Execute concurrently | Parallel operations |
| `Step` | Organize & scope | Test step isolation |
| `StepGroup` | Reference reusable steps | DRY step sequences |
| `MemorySequence` | Skip completed | Expensive retries |
| `ReactiveSequence` | Always restart | Reactive monitoring |
| `Conditional` | If-then-else | Branching logic |
| `ForEach` | Iterate collection | Data-driven tests |
| `While` | Loop until false | Polling & waiting |
| `Recovery` | Try-catch-finally | Error handling |

### Advanced Decorators (7)
| Node | Purpose | Use Case |
|------|---------|----------|
| `Invert` | Flip result | Negate conditions |
| `Retry` | Retry on failure | Flaky operations |
| `Timeout` | Time limit | Prevent hangs |
| `Delay` | Add delay | Rate limiting |
| `Repeat` | Execute N times | Loops |
| `RunOnce` | Execute once | Expensive init |
| `ForceSuccess/Failure` | Override result | Graceful degradation |
| `KeepRunningUntilFailure` | Loop while success | Pagination |
| `Precondition` | Check prerequisites | Validation |
| `SoftAssert` | Non-critical checks | Continue on failure |

### Scripting Node (1)
| Node | Purpose | Use Case |
|------|---------|----------|
| `Script` | Execute scripts | Blackboard manipulation, calculations, validations |

The **Script** node enables blackboard manipulation through a simple scripting DSL:

**Supported Operations:**
- ✅ Variable assignments (`x = 10`)
- ✅ Arithmetic (`+`, `-`, `*`, `/`, `%`)
- ✅ Comparisons (`==`, `!=`, `>`, `<`, `>=`, `<=`)
- ✅ Logical operators (`&&`, `||`, `!`)
- ✅ String concatenation
- ✅ Property access (`user.profile.name`)

**Example: Store and Verify Pattern**
```typescript
// Store values
const storeScript = new Script({
  id: 'store-data',
  textContent: `
    pageTitle = "Shopping Cart"
    elementCount = 5
    total = price * quantity
  `
});

// Verify stored values
const verifyScript = new Script({
  id: 'verify-data',
  textContent: `
    titleMatches = pageTitle == "Shopping Cart"
    hasItems = elementCount > 0
    isValid = titleMatches && hasItems
  `
});
```

**More Examples:**
```typescript
// Calculate order total with discount
new Script({
  id: 'calculate',
  textContent: `
    subtotal = price * quantity
    discount = subtotal * 0.1
    total = subtotal - discount
  `
});

// Validate form data
new Script({
  id: 'validate',
  textContent: `
    hasUsername = username != null
    isAdult = age >= 18
    isValid = hasUsername && isAdult
  `
});

// Format display strings
new Script({
  id: 'format',
  textContent: `
    fullName = firstName + " " + lastName
    greeting = "Hello, " + fullName + "!"
  `
});
```

## Key Concepts

### Node Status
```typescript
enum NodeStatus {
  SUCCESS,   // Completed successfully
  FAILURE,   // Failed
  RUNNING,   // Still executing (async)
  IDLE,      // Not started
  SKIPPED    // Skipped execution
}
```

### Blackboard (Scoped State)
```typescript
const blackboard = new ScopedBlackboard('root');
blackboard.set('userId', 123);

// Create child scope with inheritance
const stepScope = blackboard.createScope('step1');
stepScope.get('userId');  // Returns 123 (inherited)
stepScope.set('token', 'abc');  // Local to step1

// Parent doesn't see child values
blackboard.get('token');  // undefined
```

### Step Nodes (Scoped Blackboard)
```typescript
const loginStep = new Step({
  id: 'login',
  name: 'Login',
  nlDescription: 'Login with valid credentials',
  generated: false
});

// Variables set in loginStep are isolated from other steps
loginStep.addChild(new SetVariable({ key: 'sessionToken', value: 'xyz' }));
```

### Async Execution
```typescript
const engine = new TickEngine(tree);

// Single tick
await engine.tick(blackboard);

// Tick until non-RUNNING (for async operations)
await engine.tickWhileRunning(blackboard, maxTicks);
```

### Tick Loop Optimization

By default, the TickEngine uses auto exponential backoff for optimal performance:

```typescript
// Default: Auto mode (exponential backoff)
const engine = new TickEngine(tree);
// Tick delays: 0→0→0→0→0→1→2→4→8→16ms (capped)
```

The delay strategy automatically resets when:
- **Node completes**: Status changes from RUNNING → SUCCESS/FAILURE
- **New operation starts**: Status changes from SUCCESS/FAILURE → RUNNING

This ensures each operation gets optimal performance regardless of previous operation timing.

For debugging or specific requirements, use fixed delays:

```typescript
// Fixed delay mode
const engine = new TickEngine(tree, { tickDelayMs: 10 });

// Immediate mode (legacy behavior)
const engine = new TickEngine(tree, { tickDelayMs: 0 });
```

**Benefits of Auto Mode:**
- Fast operations (< 200ms): Complete quickly with minimal overhead
- Slow operations (> 1s): Reduce CPU usage by ~80%
- Polling scenarios: Automatically adapt to operation timing

## Loading External Data with Script Node

The **Script node** provides built-in functions to load test data and environment variables into the blackboard. This enables clean separation: Script handles external data, atoms consume from blackboard.

### Built-in Functions

#### `param(key)` - Load Test Data
Access test parameters from CSV files, data tables, or test runs:

```typescript
import { Script } from '@wayfarer-ai/btree';

// Setup test data
const context = {
  blackboard: new ScopedBlackboard(),
  timestamp: Date.now(),
  testData: new Map([
    ['username', 'john.doe'],
    ['password', 'secret123'],
    ['age', 25]
  ])
};

// Load test data into blackboard
const script = new Script({
  id: 'load-data',
  textContent: `
    username = param("username")
    password = param("password")
    age = param("age")
  `
});

await script.tick(context);

// Now atoms can access from blackboard
console.log(context.blackboard.get('username')); // 'john.doe'
console.log(context.blackboard.get('age'));      // 25
```

#### `env(key)` - Load Environment Variables
Access environment configuration at runtime:

```typescript
process.env.BASE_URL = 'https://staging.example.com';
process.env.API_KEY = 'test-key-123';

const script = new Script({
  id: 'load-env',
  textContent: `
    baseUrl = env("BASE_URL")
    apiKey = env("API_KEY")
  `
});

await script.tick(context);

console.log(context.blackboard.get('baseUrl')); // 'https://staging.example.com'
console.log(context.blackboard.get('apiKey'));  // 'test-key-123'
```

### Computed Values

Scripts can build derived values from test data and environment:

```typescript
const script = new Script({
  id: 'build-url',
  textContent: `
    // Load external data
    baseUrl = env("BASE_URL")
    userId = param("userId")
    postId = param("postId")

    // Build computed URL
    apiUrl = baseUrl + "/users/" + userId + "/posts/" + postId

    // Conditional logic
    timeout = userId > 1000 ? 30000 : 5000
  `
});

await script.tick(context);

// Atoms read computed values from blackboard
console.log(context.blackboard.get('apiUrl'));
// Result: 'https://staging.example.com/users/123/posts/456'
```

### Benefits

**✅ Separation of Concerns**
- Script: External data access (`param()`, `env()`)
- Atoms: Browser automation (click, fill, navigate)
- Blackboard: Data exchange layer

**✅ Explicit Data Flow**
- Easy to debug: inspect blackboard after Script execution
- No hidden resolution in atoms

**✅ Powerful Transformations**
- Build URLs from multiple sources
- Perform calculations with test data
- Apply conditional logic
- String concatenation and formatting

**✅ Extensible**
- Easy to add more built-in functions: `localStorage()`, `fetch()`
- Future: async functions for API calls

## Advanced Features

### 🔄 Resumable Execution

Pause execution, modify the behavior tree, and resume from a specific node - perfect for debugging and AI-assisted test correction:

```typescript
const engine = new TickEngine(testTree);

// First attempt - might fail
await engine.tick(blackboard);

// Resume from a specific node (e.g., after fixing a bug)
const resumeContext = engine.createResumeContext(
  blackboard,
  'step_3',  // Node ID to resume from
  'session_123'
);

await engine.tick(resumeContext.blackboard);
```

**Use Cases:**
- **Debugging**: Pause at failure, inspect state, resume after fix
- **Dry-Run Agents**: AI generates BT → executes → corrects mistakes → resumes
- **Test Maintenance**: Fix broken tests without re-running entire flow

See [`examples/resumable-execution.ts`](./examples/resumable-execution.ts) for complete examples.

### 📡 Event System

Subscribe to node lifecycle events for real-time monitoring and observability:

```typescript
import { NodeEventEmitter } from '@wayfarer-ai/btree';

const eventEmitter = new NodeEventEmitter();

// Subscribe to events
eventEmitter.on('TICK_START', (event) => {
  console.log(`Node ${event.nodeId} starting...`);
});

eventEmitter.on('TICK_END', (event) => {
  console.log(`Node ${event.nodeId} completed with ${event.status}`);
});

eventEmitter.on('ERROR', (event) => {
  console.error(`Node ${event.nodeId} errored:`, event.error);
});

// Create engine with event emitter
const engine = new TickEngine(tree, { eventEmitter });
await engine.tick(blackboard);
```

**Available Events:**
- `TICK_START` - Node begins execution
- `TICK_END` - Node completes (SUCCESS/FAILURE/RUNNING)
- `ERROR` - Node throws an error
- `HALT` - Node is halted/cancelled
- `RESET` - Node is reset
- `STATUS_CHANGE` - Node status changes

**Use Cases:**
- Real-time test execution monitoring
- Performance profiling
- Custom logging and analytics
- Integration with external monitoring tools

See [`examples/event-monitoring.ts`](./examples/event-monitoring.ts) for complete examples.

### 📸 Smart Execution Snapshots

**⚡ Efficient**: Snapshots captured ONLY when blackboard state changes (not every tick!)

```typescript
const engine = new TickEngine(tree, {
  captureSnapshots: true  // Auto-creates event emitter if needed
});

await engine.tick(blackboard);

// Get captured snapshots (only when state changed)
const snapshots = engine.getSnapshots();

snapshots.forEach(snap => {
  console.log(`Tick #${snap.tickNumber}:`);

  // See exactly what changed
  console.log('Added:', snap.blackboardDiff.added);
  console.log('Modified:', snap.blackboardDiff.modified);
  console.log('Deleted:', snap.blackboardDiff.deleted);

  // See which nodes executed
  snap.executionTrace.forEach(node => {
    console.log(`  ${node.nodeName}: ${node.status} (${node.duration}ms)`);
  });

  // Access full state
  console.log('Total state:', snap.blackboard.toJSON());
});

// Always clear when done
engine.clearSnapshots();
```

**📊 Rich Snapshot Data:**
```typescript
interface ExecutionSnapshot {
  timestamp: number;              // When captured
  tickNumber: number;             // Which tick
  blackboard: IScopedBlackboard;  // Deep clone of full state
  blackboardDiff: {               // What changed
    added: Record<string, any>;
    modified: Record<string, { from: any; to: any }>;
    deleted: string[];
  };
  executionTrace: Array<{         // Which nodes ran
    nodeId: string;
    nodeName: string;
    nodeType: string;
    status: NodeStatus;
    startTime: number;
    duration: number;
  }>;
  rootNodeId: string;
  rootStatus: NodeStatus;
}
```

**🎯 Key Benefits:**
- **Efficient**: Only capture when state changes (not on every tick)
- **Precise Diffs**: See exactly what was added/modified/deleted
- **Execution Context**: Know which nodes executed in each snapshot
- **Time-Travel**: Jump to any point and inspect full state
- **AI-Ready**: Perfect for feeding to LLMs for root cause analysis
- **Zero Overhead When Disabled**: No performance impact when `captureSnapshots: false`

**💡 Use Cases:**
```typescript
// 1. Find when a value was set
const snapshot = snapshots.find(s =>
  s.blackboardDiff.added.hasOwnProperty('username')
);

// 2. Track value evolution
snapshots.forEach(s => {
  if (s.blackboard.has('counter')) {
    console.log(`Tick #${s.tickNumber}: counter = ${s.blackboard.get('counter')}`);
  }
});

// 3. Identify which action caused the bug
const bugSnapshot = snapshots[snapshots.length - 1];
console.log('Last executed nodes:', bugSnapshot.executionTrace);

// 4. Compare expected vs actual
if (testFailed) {
  const finalSnapshot = snapshots[snapshots.length - 1];
  console.log('Expected total:', expectedTotal);
  console.log('Actual total:', finalSnapshot.blackboard.get('total'));
  console.log('Diff:', finalSnapshot.blackboardDiff);
}
```

**⚠️ Important:**
- Snapshots accumulate across ticks - clear regularly for long sessions
- Each snapshot is a deep clone - memory grows with blackboard size
- Disable in production, enable only for debugging/test analysis

See [`examples/snapshot-debugging.ts`](./examples/snapshot-debugging.ts) for complete debugging workflow.

## Development

### Running Tests
```bash
npm test                # Run all tests with coverage
npm run test:watch      # Watch mode
npm run test:ui         # UI mode
```

Current status: **595 tests passing** across 38 test files with **95%+ coverage**

### Building
```bash
npm run build           # Production build
npm run dev             # Watch mode
npm run typecheck       # Type checking
```

### Modifying the Script Grammar

The Script node uses ANTLR4 to parse scripts. Generated parser files are committed to avoid Java dependency for users.

**To modify the grammar (`src/scripting/ScriptLang.g4`):**

1. **Install Java** (required for ANTLR)
   ```bash
   # macOS
   brew install openjdk

   # Ubuntu
   apt install default-jre
   ```

2. **Regenerate parser**
   ```bash
   npm run scripting:generate
   ```

3. **Commit generated files**
   ```bash
   git add src/scripting/generated/
   ```

**Note**: Regular users don't need Java - only developers modifying the grammar.

### Project Structure
```
src/
├── base-node.ts              # BaseNode abstract class
├── types.ts                  # Core types & enums
├── blackboard.ts             # ScopedBlackboard
├── tick-engine.ts            # TickEngine
├── registry.ts               # Node registry
├── composites/               # Composite nodes
│   ├── sequence.ts
│   ├── selector.ts
│   ├── parallel.ts
│   ├── step.ts              # ✨ NEW
│   ├── memory-sequence.ts   # ✨ NEW
│   ├── reactive-sequence.ts # ✨ NEW
│   ├── conditional.ts       # ✨ NEW
│   ├── for-each.ts          # ✨ NEW
│   ├── while.ts             # ✨ NEW
│   └── recovery.ts          # ✨ NEW
├── decorators/               # Decorator nodes
│   ├── invert.ts
│   ├── retry.ts
│   ├── timeout.ts
│   ├── delay.ts
│   ├── force-result.ts      # ✨ NEW
│   ├── repeat.ts            # ✨ NEW
│   ├── keep-running.ts      # ✨ NEW
│   ├── run-once.ts          # ✨ NEW
│   ├── precondition.ts      # ✨ NEW
│   └── soft-assert.ts       # ✨ NEW
└── test-nodes.ts             # Helper nodes for testing
```

## Contributing

### Adding New Nodes

1. **Create node file** in `src/composites/` or `src/decorators/`
2. **Extend base class**:
   ```typescript
   import * as Effect from 'effect/Effect'
   import { EffectTickContext } from '@wayfarer-ai/btree'

   export class MyNode extends CompositeNode {
     protected executeTick(context: EffectTickContext): Effect.Effect<NodeStatus, Error, never> {
       return Effect.gen(function* (_) {
         // Implementation using Effect.gen
         const status = yield* _(this.child.tick(context));
         return status;
       });
     }

     protected onHalt(): void { /* cleanup */ }
     protected onReset(): void { /* reset state */ }
   }
   ```

3. **Write tests** in `*.test.ts`:
   - Basic success/failure cases
   - RUNNING state handling
   - Edge cases
   - Reset/halt behavior
   - Blackboard integration

4. **Export** in `src/index.ts` and update indexes

5. **Document** in examples/README.md

### Testing Guidelines

- Use `describe/it` structure with clear test names
- Test all status transitions (SUCCESS, FAILURE, RUNNING)
- Test edge cases (empty children, null values)
- Test state cleanup (halt, reset)
- Use helper nodes from `src/test-nodes.ts`
- Aim for >90% coverage

### Code Style

- Follow existing patterns in the codebase
- Use async/await for async operations
- Implement lifecycle methods (onHalt, onReset)
- Add logging with `this.log()`
- Document complex logic with comments
- Keep nodes focused (single responsibility)

### Error Handling with `_lastError`

Nodes that fail should provide meaningful error context via the `_lastError` property when the default error isn't descriptive enough:

```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  this._lastError = `Verification failed: expected "${expected}" within ${timeout}ms: ${errorMessage}`;
  this.log(this._lastError);
  return NodeStatus.FAILURE;
}
```

**When to use:**
- Verification/assertion nodes (ExpectText, ExpectVisible, etc.)
- Nodes where users need to understand expected vs actual
- Any node where debugging requires clearer context

**When NOT needed:**
- Action nodes (Click, Fill) - underlying errors are usually descriptive
- Control flow nodes - children fail, not the composite itself

The `_lastError` is automatically surfaced via `tickWhileRunning()` result and the execution feedback system. See `.cursor/rules/node-error-handling.mdc` for detailed guidelines.

## Architecture Overview

**Core Principles:**
- **Nodes**: All nodes inherit from `BaseNode` and implement `tick(context)`
- **Status**: Every tick returns `SUCCESS | FAILURE | RUNNING | IDLE | SKIPPED`
- **State**: `ScopedBlackboard` provides hierarchical data with inheritance
- **Execution**: `TickEngine` coordinates ticking with cancellation support
- **Async**: Effect-TS powered async operations with proper RUNNING status propagation (parents observe RUNNING across ticks)

**Design Patterns:**
- **Composite Pattern**: Nodes contain child nodes
- **Visitor Pattern**: TickEngine visits tree during execution
- **Strategy Pattern**: Different node types implement different behaviors
- **Factory Pattern**: Registry creates nodes from definitions
- **Observer Pattern**: TickEngine callbacks (onTick, onError)

**Integration:**
- Registry pattern enables dynamic tree creation from JSON
- Scoped blackboard enables step isolation for test authoring

## License

MIT

## Credits

Inspired by [BehaviorTree.CPP](https://github.com/BehaviorTree/BehaviorTree.CPP) with adaptations for TypeScript.
