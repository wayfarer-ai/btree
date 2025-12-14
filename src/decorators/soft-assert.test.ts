/**
 * Tests for SoftAssert decorator
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { FailureNode, RunningNode, SuccessNode } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { SoftAssert } from "./soft-assert.js";

describe("SoftAssert", () => {
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

  it.effect("should convert FAILURE to SUCCESS", () =>
    Effect.gen(function* (_) {
      const soft = new SoftAssert({ id: "soft1" });
      soft.setChild(new FailureNode({ id: "child" }));

      const result = yield* _(soft.tick(context));
      expect(result).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should propagate SUCCESS", () =>
    Effect.gen(function* (_) {
      const soft = new SoftAssert({ id: "soft1" });
      soft.setChild(new SuccessNode({ id: "child" }));

      const result = yield* _(soft.tick(context));
      expect(result).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should propagate RUNNING", () =>
    Effect.gen(function* (_) {
      const soft = new SoftAssert({ id: "soft1" });
      soft.setChild(new RunningNode({ id: "child" }));

      const result = yield* _(soft.tick(context));
      expect(result).toBe(NodeStatus.RUNNING);
    }),
  );

  it.effect("should log failures", () =>
    Effect.gen(function* (_) {
      const soft = new SoftAssert({ id: "soft1" });
      soft.setChild(new FailureNode({ id: "child" }));

      yield* _(soft.tick(context));

      const failures = soft.getFailures();
      expect(failures).toHaveLength(1);
      expect(failures[0]?.message).toContain("Soft assertion failed");
    }),
  );

  it.effect("should track multiple failures", () =>
    Effect.gen(function* (_) {
      const soft = new SoftAssert({ id: "soft1" });
      soft.setChild(new FailureNode({ id: "child" }));

      yield* _(soft.tick(context));
      yield* _(soft.tick(context));
      yield* _(soft.tick(context));

      const failures = soft.getFailures();
      expect(failures).toHaveLength(3);
    }),
  );

  it.effect("should reset failure history on reset", () =>
    Effect.gen(function* (_) {
      const soft = new SoftAssert({ id: "soft1" });
      soft.setChild(new FailureNode({ id: "child" }));

      yield* _(soft.tick(context));
      yield* _(soft.tick(context));
      expect(soft.hasFailures()).toBe(true);

      soft.reset();
      expect(soft.hasFailures()).toBe(false);
      expect(soft.getFailures()).toHaveLength(0);
    }),
  );

  it.effect("should provide hasFailures helper", () =>
    Effect.gen(function* (_) {
      const soft = new SoftAssert({ id: "soft1" });
      soft.setChild(new FailureNode({ id: "child" }));

      expect(soft.hasFailures()).toBe(false);
      yield* _(soft.tick(context));
      expect(soft.hasFailures()).toBe(true);
    }),
  );

  it.effect("should propagate ConfigurationError if no child", () =>
    Effect.gen(function* (_) {
      const soft = new SoftAssert({ id: "soft1" });

      const result = yield* _(Effect.exit(soft.tick(context)));
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure" && result.cause._tag === "Fail") {
        expect(result.cause.error).toBeInstanceOf(ConfigurationError);
        expect(result.cause.error.message).toContain(
          "SoftAssert requires a child",
        );
      }
    }),
  );
});
