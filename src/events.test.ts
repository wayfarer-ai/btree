/**
 * Tests for event system
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "./blackboard.js";
import { Sequence } from "./composites/sequence.js";
import { type NodeEvent, NodeEventEmitter, NodeEventType } from "./events.js";
import { Registry } from "./registry.js";
import { RunningNode, SuccessNode } from "./test-nodes.js";
import { TickEngine } from "./tick-engine.js";
import { type EffectTickContext, NodeStatus } from "./types.js";

describe("NodeEventEmitter", () => {
  let emitter: NodeEventEmitter;

  beforeEach(() => {
    emitter = new NodeEventEmitter();
  });

  describe("Basic Functionality", () => {
    it("should emit events to registered listeners", () => {
      const events: NodeEvent[] = [];

      emitter.on(NodeEventType.TICK_START, (event) => {
        events.push(event);
      });

      emitter.emit({
        type: NodeEventType.TICK_START,
        nodeId: "test",
        nodeName: "Test",
        nodeType: "TestNode",
        timestamp: Date.now(),
      });

      expect(events.length).toBe(1);
      expect(events[0]?.type).toBe(NodeEventType.TICK_START);
    });

    it("should support multiple listeners for same event type", () => {
      let count1 = 0;
      let count2 = 0;

      emitter.on(NodeEventType.TICK_START, () => count1++);
      emitter.on(NodeEventType.TICK_START, () => count2++);

      emitter.emit({
        type: NodeEventType.TICK_START,
        nodeId: "test",
        nodeName: "Test",
        nodeType: "TestNode",
        timestamp: Date.now(),
      });

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    it("should support onAll for listening to all events", () => {
      const events: NodeEvent[] = [];

      emitter.onAll((event) => events.push(event));

      emitter.emit({
        type: NodeEventType.TICK_START,
        nodeId: "test",
        nodeName: "Test",
        nodeType: "TestNode",
        timestamp: Date.now(),
      });

      emitter.emit({
        type: NodeEventType.TICK_END,
        nodeId: "test",
        nodeName: "Test",
        nodeType: "TestNode",
        timestamp: Date.now(),
        data: { status: NodeStatus.SUCCESS },
      });

      expect(events.length).toBe(2);
      expect(events[0]?.type).toBe(NodeEventType.TICK_START);
      expect(events[1]?.type).toBe(NodeEventType.TICK_END);
    });

    it("should remove listeners with off()", () => {
      let count = 0;
      const callback = () => count++;

      emitter.on(NodeEventType.TICK_START, callback);

      emitter.emit({
        type: NodeEventType.TICK_START,
        nodeId: "test",
        nodeName: "Test",
        nodeType: "TestNode",
        timestamp: Date.now(),
      });

      expect(count).toBe(1);

      emitter.off(NodeEventType.TICK_START, callback);

      emitter.emit({
        type: NodeEventType.TICK_START,
        nodeId: "test",
        nodeName: "Test",
        nodeType: "TestNode",
        timestamp: Date.now(),
      });

      expect(count).toBe(1); // Should not increment
    });

    it("should clear all listeners", () => {
      let count = 0;

      emitter.on(NodeEventType.TICK_START, () => count++);
      emitter.onAll(() => count++);

      emitter.clear();

      emitter.emit({
        type: NodeEventType.TICK_START,
        nodeId: "test",
        nodeName: "Test",
        nodeType: "TestNode",
        timestamp: Date.now(),
      });

      expect(count).toBe(0);
    });

    it("should handle errors in callbacks gracefully", () => {
      const events: NodeEvent[] = [];

      // This callback throws an error
      emitter.on(NodeEventType.TICK_START, () => {
        throw new Error("Test error");
      });

      // This callback should still execute
      emitter.on(NodeEventType.TICK_START, (event) => {
        events.push(event);
      });

      // Should not throw
      expect(() => {
        emitter.emit({
          type: NodeEventType.TICK_START,
          nodeId: "test",
          nodeName: "Test",
          nodeType: "TestNode",
          timestamp: Date.now(),
        });
      }).not.toThrow();

      // Second callback should have executed
      expect(events.length).toBe(1);
    });
  });

  describe("Listener Counting", () => {
    it("should report correct listener counts", () => {
      expect(emitter.listenerCount(NodeEventType.TICK_START)).toBe(0);
      expect(emitter.allListenerCount()).toBe(0);
      expect(emitter.hasListeners()).toBe(false);

      emitter.on(NodeEventType.TICK_START, () => {});
      emitter.on(NodeEventType.TICK_START, () => {});
      emitter.onAll(() => {});

      expect(emitter.listenerCount(NodeEventType.TICK_START)).toBe(2);
      expect(emitter.allListenerCount()).toBe(1);
      expect(emitter.hasListeners()).toBe(true);
    });
  });
});

describe("Event Integration with Nodes", () => {
  let blackboard: ScopedBlackboard;
  let emitter: NodeEventEmitter;

  beforeEach(() => {
    blackboard = new ScopedBlackboard("root");
    emitter = new NodeEventEmitter();
  });

  describe("TICK Events", () => {
    it.effect(
      "should emit TICK_START and TICK_END for successful execution",
      () =>
        Effect.gen(function* (_) {
          const events: NodeEvent[] = [];
          emitter.onAll((event) => events.push(event));

          const node = new SuccessNode({ id: "success" });
          const context: EffectTickContext = {
            blackboard,
            timestamp: Date.now(),
            deltaTime: 0,
            runningOps: new Map(),
            eventEmitter: emitter,
          };
          yield* _(node.tick(context));

          expect(events.length).toBe(2);
          expect(events[0]?.type).toBe(NodeEventType.TICK_START);
          expect(events[0]?.nodeId).toBe("success");
          expect(events[1]?.type).toBe(NodeEventType.TICK_END);
          expect(events[1]?.data?.status).toBe(NodeStatus.SUCCESS);
        }),
    );

    it.effect("should emit events for all nodes in a tree", () =>
      Effect.gen(function* (_) {
        const events: NodeEvent[] = [];
        emitter.onAll((event) => events.push(event));

        const sequence = new Sequence({ id: "seq" });
        sequence.addChildren([
          new SuccessNode({ id: "child1" }),
          new SuccessNode({ id: "child2" }),
        ]);

        const context: EffectTickContext = {
          blackboard,
          timestamp: Date.now(),
          deltaTime: 0,
          runningOps: new Map(),
          eventEmitter: emitter,
        };
        yield* _(sequence.tick(context));

        // Sequence starts, child1 starts/ends, child2 starts/ends, sequence ends
        const nodeIds = events.map((e) => e.nodeId);
        expect(nodeIds).toContain("seq");
        expect(nodeIds).toContain("child1");
        expect(nodeIds).toContain("child2");
      }),
    );
  });

  describe("ERROR Events", () => {
    it.effect("should emit ERROR event when node throws", () =>
      Effect.gen(function* (_) {
        const events: NodeEvent[] = [];
        emitter.on(NodeEventType.ERROR, (event) => events.push(event));

        class ThrowingNode extends SuccessNode {
          executeTick(_context: EffectTickContext) {
            return Effect.fail(new Error("Test error"));
          }
        }

        const node = new ThrowingNode({ id: "throwing" });
        const context: EffectTickContext = {
          blackboard,
          timestamp: Date.now(),
          deltaTime: 0,
          runningOps: new Map(),
          eventEmitter: emitter,
        };

        // With Effect.catchAll, errors are converted to FAILURE status
        const status = yield* _(node.tick(context));
        expect(status).toBe(NodeStatus.FAILURE);
        expect(node.lastError).toBe("Test error");

        // ERROR events are now emitted for Effect.fail() via Effect.catchAll
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(NodeEventType.ERROR);
        expect(events[0].nodeId).toBe("throwing");
        expect(events[0].data).toEqual({ error: "Test error" });
      }),
    );
  });

  describe("HALT Events", () => {
    it("should emit HALT event when node is halted", () => {
      const events: NodeEvent[] = [];
      emitter.on(NodeEventType.HALT, (event) => events.push(event));

      const node = new RunningNode({ id: "running" });
      // Store emitter reference
      node._eventEmitter = emitter;
      node._status = NodeStatus.RUNNING;

      node.halt();

      expect(events.length).toBe(1);
      expect(events[0]?.type).toBe(NodeEventType.HALT);
      expect(events[0]?.nodeId).toBe("running");
    });
  });

  describe("RESET Events", () => {
    it("should emit RESET event when node is reset", () => {
      const events: NodeEvent[] = [];
      emitter.on(NodeEventType.RESET, (event) => events.push(event));

      const node = new SuccessNode({ id: "node" });
      // Store emitter reference
      node._eventEmitter = emitter;

      node.reset();

      expect(events.length).toBe(1);
      expect(events[0]?.type).toBe(NodeEventType.RESET);
      expect(events[0]?.nodeId).toBe("node");
    });
  });
});

describe("Event Integration with TickEngine", () => {
  it.effect("should pass eventEmitter from engine options to nodes", () =>
    Effect.gen(function* (_) {
      const events: NodeEvent[] = [];
      const emitter = new NodeEventEmitter();
      emitter.onAll((event) => events.push(event));

      const root = new Sequence({ id: "root" });
      root.addChild(new SuccessNode({ id: "child" }));

      const treeRegistry = new Registry();
      const engine = new TickEngine(root, {
        eventEmitter: emitter,
        treeRegistry,
      });

      yield* _(Effect.promise(() => engine.tick()));

      expect(events.length).toBeGreaterThan(0);
      const nodeIds = events.map((e) => e.nodeId);
      expect(nodeIds).toContain("root");
      expect(nodeIds).toContain("child");
    }),
  );

  it.effect("should work without eventEmitter (optional)", () =>
    Effect.gen(function* (_) {
      const root = new Sequence({ id: "root" });
      root.addChild(new SuccessNode({ id: "child" }));

      const treeRegistry = new Registry();
      const engine = new TickEngine(root, { treeRegistry }); // No eventEmitter

      // Should execute normally without errors
      const result = yield* _(Effect.promise(() => engine.tick()));
      expect(result).toBe(NodeStatus.SUCCESS);
    }),
  );
});

describe("Event Data Validation", () => {
  it.effect("should include all required fields in events", () =>
    Effect.gen(function* (_) {
      const events: NodeEvent[] = [];
      const emitter = new NodeEventEmitter();
      emitter.onAll((event) => events.push(event));

      const node = new SuccessNode({ id: "test", name: "TestNode" });
      const context: EffectTickContext = {
        blackboard: new ScopedBlackboard("root"),
        timestamp: Date.now(),
        deltaTime: 0,
        runningOps: new Map(),
        eventEmitter: emitter,
      };
      yield* _(node.tick(context));

      for (const event of events) {
        expect(event.type).toBeDefined();
        expect(event.nodeId).toBeDefined();
        expect(event.nodeName).toBeDefined();
        expect(event.nodeType).toBeDefined();
        expect(event.timestamp).toBeGreaterThan(0);
      }
    }),
  );

  it.effect("should include status in TICK_END data", () =>
    Effect.gen(function* (_) {
      const emitter = new NodeEventEmitter();
      let tickEndEvent: NodeEvent | undefined;

      emitter.on(NodeEventType.TICK_END, (event) => {
        tickEndEvent = event;
      });

      const node = new SuccessNode({ id: "test" });
      const context: EffectTickContext = {
        blackboard: new ScopedBlackboard("root"),
        timestamp: Date.now(),
        deltaTime: 0,
        runningOps: new Map(),
        eventEmitter: emitter,
      };
      yield* _(node.tick(context));

      expect(tickEndEvent).toBeDefined();
      expect(tickEndEvent?.data?.status).toBe(NodeStatus.SUCCESS);
    }),
  );
});
