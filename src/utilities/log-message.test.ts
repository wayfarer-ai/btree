/**
 * Tests for LogMessage Node
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import * as Effect from "effect/Effect";
import { NodeEventEmitter, NodeEventType } from "../events.js";
import {
  type EffectTickContext,
  NodeStatus,
  ScopedBlackboard,
} from "../index.js";
import { LogMessage } from "./log-message.js";

describe("LogMessage", () => {
  let blackboard: ScopedBlackboard;
  let context: EffectTickContext;
  let consoleLogSpy: unknown;
  let consoleWarnSpy: unknown;
  let consoleErrorSpy: unknown;
  let consoleDebugSpy: unknown;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    blackboard = new ScopedBlackboard();
    context = {
      blackboard: blackboard,
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  it.effect("should log a simple message", () =>
    Effect.gen(function* (_) {
      const node = new LogMessage({
        id: "log-1",
        message: "Test message",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[LogMessage:log-1] Test message"),
      );
    }),
  );

  it.effect("should log message with blackboard value placeholder", () =>
    Effect.gen(function* (_) {
      blackboard.set("username", "testuser");
      blackboard.set("count", 42);

      const node = new LogMessage({
        id: "log-2",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: This is intentional - LogMessage processes ${} syntax
        message: "User: ${username}, Count: ${count}",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[LogMessage:log-2] User: testuser, Count: 42"),
      );
    }),
  );

  it.effect("should handle missing blackboard values", () =>
    Effect.gen(function* (_) {
      const node = new LogMessage({
        id: "log-3",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: This is intentional - LogMessage processes ${} syntax
        message: "Value: ${missingKey}",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      // Should keep the placeholder if value is missing
      expect(consoleLogSpy).toHaveBeenCalledWith(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: This is intentional - testing placeholder syntax
        expect.stringContaining("[LogMessage:log-3] Value: ${missingKey}"),
      );
    }),
  );

  it.effect("should handle null values", () =>
    Effect.gen(function* (_) {
      blackboard.set("nullValue", null);

      const node = new LogMessage({
        id: "log-4",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: This is intentional - LogMessage processes ${} syntax
        message: "Null value: ${nullValue}",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[LogMessage:log-4] Null value: null"),
      );
    }),
  );

  it.effect("should handle object values", () =>
    Effect.gen(function* (_) {
      blackboard.set("user", { name: "John", age: 30 });

      const node = new LogMessage({
        id: "log-5",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: This is intentional - LogMessage processes ${} syntax
        message: "User: ${user}",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[LogMessage:log-5] User: {"name":"John","age":30}',
        ),
      );
    }),
  );

  it.effect("should log with warn level", () =>
    Effect.gen(function* (_) {
      const node = new LogMessage({
        id: "log-6",
        message: "Warning message",
        level: "warn",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    }),
  );

  it.effect("should log with error level", () =>
    Effect.gen(function* (_) {
      const node = new LogMessage({
        id: "log-7",
        message: "Error message",
        level: "error",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    }),
  );

  it.effect("should log with debug level", () =>
    Effect.gen(function* (_) {
      const node = new LogMessage({
        id: "log-8",
        message: "Debug message",
        level: "debug",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      expect(consoleDebugSpy).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    }),
  );

  it.effect("should default to info level", () =>
    Effect.gen(function* (_) {
      const node = new LogMessage({
        id: "log-9",
        message: "Info message",
        // level not specified
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalled();
    }),
  );

  it.effect("should handle multiple placeholders", () =>
    Effect.gen(function* (_) {
      blackboard.set("name", "Alice");
      blackboard.set("age", 25);
      blackboard.set("city", "New York");

      const node = new LogMessage({
        id: "log-10",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: This is intentional - LogMessage processes ${} syntax
        message: "${name} is ${age} years old and lives in ${city}",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "[LogMessage:log-10] Alice is 25 years old and lives in New York",
        ),
      );
    }),
  );

  it.effect("should handle array values", () =>
    Effect.gen(function* (_) {
      blackboard.set("items", ["apple", "banana", "cherry"]);

      const node = new LogMessage({
        id: "log-11",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: This is intentional - LogMessage processes ${} syntax
        message: "Items: ${items}",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[LogMessage:log-11] Items: ["apple","banana","cherry"]',
        ),
      );
    }),
  );

  describe("LOG event emission", () => {
    it.effect("should emit LOG event when executed with event emitter", () =>
      Effect.gen(function* (_) {
        const eventEmitter = new NodeEventEmitter();
        const receivedEvents: unknown[] = [];

        eventEmitter.on(NodeEventType.LOG, (event) => {
          receivedEvents.push(event);
        });

        const contextWithEmitter: EffectTickContext = {
          ...context,
          eventEmitter,
        };

        const node = new LogMessage({
          id: "log-event",
          name: "EventTest",
          message: "Event test message",
          level: "warn",
        });

        yield* _(node.tick(contextWithEmitter));

        expect(receivedEvents).toHaveLength(1);
        const event = receivedEvents[0] as {
          type: string;
          nodeId: string;
          data: { level: string; message: string };
        };
        expect(event.type).toBe(NodeEventType.LOG);
        expect(event.nodeId).toBe("log-event");
        expect(event.data.level).toBe("warn");
        expect(event.data.message).toBe("Event test message");
      }),
    );

    it.effect("should not fail when no event emitter present", () =>
      Effect.gen(function* (_) {
        const node = new LogMessage({
          id: "log-no-emitter",
          message: "No emitter test",
        });

        // Context without eventEmitter
        const result = yield* _(node.tick(context));

        expect(result).toBe(NodeStatus.SUCCESS);
      }),
    );
  });
});
