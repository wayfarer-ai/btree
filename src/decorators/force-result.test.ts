/**
 * Tests for ForceSuccess and ForceFailure decorators
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ScopedBlackboard } from "../blackboard.js";
import { FailureNode, RunningNode, SuccessNode } from "../test-nodes.js";
import { type EffectTickContext, NodeStatus } from "../types.js";
import { ForceFailure, ForceSuccess } from "./force-result.js";

describe("ForceSuccess", () => {
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

  it.effect("should return SUCCESS when child succeeds", () =>
    Effect.gen(function* (_) {
      const force = new ForceSuccess({ id: "force1" });
      force.setChild(new SuccessNode({ id: "child" }));

      const result = yield* _(force.tick(context));
      expect(result).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should return SUCCESS when child fails", () =>
    Effect.gen(function* (_) {
      const force = new ForceSuccess({ id: "force1" });
      force.setChild(new FailureNode({ id: "child" }));

      const result = yield* _(force.tick(context));
      expect(result).toBe(NodeStatus.SUCCESS);
    }),
  );

  it.effect("should return RUNNING when child is running", () =>
    Effect.gen(function* (_) {
      const force = new ForceSuccess({ id: "force1" });
      force.setChild(new RunningNode({ id: "child" }));

      const result = yield* _(force.tick(context));
      expect(result).toBe(NodeStatus.RUNNING);
      expect(force.status()).toBe(NodeStatus.RUNNING);
    }),
  );

  it.effect("should still tick child for side effects", () =>
    Effect.gen(function* (_) {
      const force = new ForceSuccess({ id: "force1" });

      let childTicked = false;
      class SideEffectNode extends FailureNode {
        tick(context: EffectTickContext) {
          childTicked = true;
          return super.tick(context);
        }
      }

      force.setChild(new SideEffectNode({ id: "child" }));

      yield* _(force.tick(context));
      expect(childTicked).toBe(true);
    }),
  );

  it.effect("should return FAILURE if no child", () =>
    Effect.gen(function* (_) {
      const force = new ForceSuccess({ id: "force1" });

      const status = yield* _(force.tick(context));
      expect(status).toBe(NodeStatus.FAILURE);
    }),
  );
});

describe("ForceFailure", () => {
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

  it.effect("should return FAILURE when child succeeds", () =>
    Effect.gen(function* (_) {
      const force = new ForceFailure({ id: "force1" });
      force.setChild(new SuccessNode({ id: "child" }));

      const result = yield* _(force.tick(context));
      expect(result).toBe(NodeStatus.FAILURE);
    }),
  );

  it.effect("should return FAILURE when child fails", () =>
    Effect.gen(function* (_) {
      const force = new ForceFailure({ id: "force1" });
      force.setChild(new FailureNode({ id: "child" }));

      const result = yield* _(force.tick(context));
      expect(result).toBe(NodeStatus.FAILURE);
    }),
  );

  it.effect("should return RUNNING when child is running", () =>
    Effect.gen(function* (_) {
      const force = new ForceFailure({ id: "force1" });
      force.setChild(new RunningNode({ id: "child" }));

      const result = yield* _(force.tick(context));
      expect(result).toBe(NodeStatus.RUNNING);
      expect(force.status()).toBe(NodeStatus.RUNNING);
    }),
  );

  it.effect("should still tick child for side effects", () =>
    Effect.gen(function* (_) {
      const force = new ForceFailure({ id: "force1" });

      let childTicked = false;
      class SideEffectNode extends SuccessNode {
        tick(context: EffectTickContext) {
          childTicked = true;
          return super.tick(context);
        }
      }

      force.setChild(new SideEffectNode({ id: "child" }));

      yield* _(force.tick(context));
      expect(childTicked).toBe(true);
    }),
  );

  it.effect("should return FAILURE if no child", () =>
    Effect.gen(function* (_) {
      const force = new ForceFailure({ id: "force1" });

      const status = yield* _(force.tick(context));
      expect(status).toBe(NodeStatus.FAILURE);
    }),
  );
});
