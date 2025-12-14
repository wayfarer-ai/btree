/**
 * Tests for ForEach node
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { SuccessNode } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { ForEach } from "./for-each.js";

describe("ForEach", () => {
  let blackboard: ScopedBlackboard;
  let context: EffectTickContext;

  beforeEach(() => {
    blackboard = new ScopedBlackboard("root");
    context = {
      blackboard,
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };
  });

  describe("Basic Functionality", () => {
    it.effect("should iterate over collection", () =>
      Effect.gen(function* (_) {
        const forEach = new ForEach({
          id: "forEach1",
          collectionKey: "items",
          itemKey: "currentItem",
        });

        const items = ["a", "b", "c"];
        blackboard.set("items", items);

        const processedItems: string[] = [];
        class RecordingNode extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              const item = context.blackboard.get("currentItem");
              processedItems.push(item);
              return yield* _(superTick(context));
            });
          }
        }

        forEach.addChild(new RecordingNode({ id: "body" }));

        const result = yield* _(forEach.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(processedItems).toEqual(["a", "b", "c"]);
      }),
    );

    it.effect("should set item and index in blackboard", () =>
      Effect.gen(function* (_) {
        const forEach = new ForEach({
          id: "forEach1",
          collectionKey: "numbers",
          itemKey: "num",
          indexKey: "i",
        });

        blackboard.set("numbers", [10, 20, 30]);

        const recorded: Array<{ item: number; index: number }> = [];
        class RecordingNode extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              recorded.push({
                item: context.blackboard.get("num"),
                index: context.blackboard.get("i"),
              });
              return yield* _(superTick(context));
            });
          }
        }

        forEach.addChild(new RecordingNode({ id: "body" }));

        yield* _(forEach.tick(context));

        expect(recorded).toEqual([
          { item: 10, index: 0 },
          { item: 20, index: 1 },
          { item: 30, index: 2 },
        ]);
      }),
    );
  });

  describe("Failure Handling", () => {
    it.effect("should fail on first failure", () =>
      Effect.gen(function* (_) {
        const forEach = new ForEach({
          id: "forEach1",
          collectionKey: "items",
          itemKey: "item",
        });

        blackboard.set("items", ["a", "b", "c"]);

        let tickCount = 0;
        class FailOnSecond extends SuccessNode {
          tick(context: EffectTickContext) {
            const self = this;
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              tickCount++;
              if (tickCount === 2) {
                self._status = NodeStatus.FAILURE;
                return yield* _(Effect.succeed(NodeStatus.FAILURE));
              }
              return yield* _(superTick(context));
            });
          }
        }

        forEach.addChild(new FailOnSecond({ id: "body" }));

        const result = yield* _(forEach.tick(context));
        expect(result).toBe(NodeStatus.FAILURE);
        expect(tickCount).toBe(2); // Only processed 2 items
      }),
    );

    it.effect("should fail if collection not found", () =>
      Effect.gen(function* (_) {
        const forEach = new ForEach({
          id: "forEach1",
          collectionKey: "missing",
          itemKey: "item",
        });

        forEach.addChild(new SuccessNode({ id: "body" }));

        const result = yield* _(forEach.tick(context));
        expect(result).toBe(NodeStatus.FAILURE);
      }),
    );

    it.effect("should return FAILURE if collection is not an array", () =>
      Effect.gen(function* (_) {
        const forEach = new ForEach({
          id: "forEach1",
          collectionKey: "notArray",
          itemKey: "item",
        });

        blackboard.set("notArray", "not an array");
        forEach.addChild(new SuccessNode({ id: "body" }));

        const status = yield* _(forEach.tick(context));
        expect(status).toBe(NodeStatus.FAILURE);
      }),
    );
  });

  describe("RUNNING State", () => {
    it.effect("should resume from saved index on RUNNING", () =>
      Effect.gen(function* (_) {
        const forEach = new ForEach({
          id: "forEach1",
          collectionKey: "items",
          itemKey: "item",
        });

        blackboard.set("items", ["a", "b", "c"]);

        let tickCount = 0;
        class RunningOnSecond extends SuccessNode {
          tick(context: EffectTickContext) {
            const self = this;
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              tickCount++;
              if (tickCount === 2) {
                self._status = NodeStatus.RUNNING;
                return yield* _(Effect.succeed(NodeStatus.RUNNING));
              }
              return yield* _(superTick(context));
            });
          }
        }

        const body = new RunningOnSecond({ id: "body" });
        forEach.addChild(body);

        // First tick: processes item 0, returns RUNNING on item 1
        let result = yield* _(forEach.tick(context));
        expect(result).toBe(NodeStatus.RUNNING);
        expect(tickCount).toBe(2);

        // Second tick: should resume from item 1
        result = yield* _(forEach.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
        expect(tickCount).toBe(4); // item 1 (again), item 2
      }),
    );
  });

  describe("Edge Cases", () => {
    it.effect("should return SUCCESS for empty collection", () =>
      Effect.gen(function* (_) {
        const forEach = new ForEach({
          id: "forEach1",
          collectionKey: "empty",
          itemKey: "item",
        });

        blackboard.set("empty", []);
        forEach.addChild(new SuccessNode({ id: "body" }));

        const result = yield* _(forEach.tick(context));
        expect(result).toBe(NodeStatus.SUCCESS);
      }),
    );

    it.effect("should reset index on success", () =>
      Effect.gen(function* (_) {
        const forEach = new ForEach({
          id: "forEach1",
          collectionKey: "items",
          itemKey: "item",
        });

        blackboard.set("items", ["a", "b"]);

        let firstRunCount = 0;
        let secondRunCount = 0;

        class CountingNode extends SuccessNode {
          tick(context: EffectTickContext) {
            const superTick = super.tick.bind(this);
            return Effect.gen(function* (_) {
              if (secondRunCount > 0) {
                secondRunCount++;
              } else {
                firstRunCount++;
              }
              return yield* _(superTick(context));
            });
          }
        }

        forEach.addChild(new CountingNode({ id: "body" }));

        // First execution
        yield* _(forEach.tick(context));
        expect(firstRunCount).toBe(2);

        // Second execution should start from beginning
        secondRunCount = 1;
        yield* _(forEach.tick(context));
        expect(secondRunCount).toBe(3); // Initial 1 + 2 items
      }),
    );

    it.effect("should propagate ConfigurationError with no child", () =>
      Effect.gen(function* (_) {
        const forEach = new ForEach({
          id: "forEach1",
          collectionKey: "items",
          itemKey: "item",
        });

        blackboard.set("items", ["a"]);

        const result = yield* _(Effect.exit(forEach.tick(context)));
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure" && result.cause._tag === "Fail") {
          expect(result.cause.error).toBeInstanceOf(ConfigurationError);
          expect(result.cause.error.message).toContain(
            "ForEach requires at least one child",
          );
        }
      }),
    );
  });
});
