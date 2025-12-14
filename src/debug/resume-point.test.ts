/**
 * Tests for ResumePoint node
 */

import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { Registry } from "../registry.js";
import { NodeStatus, type EffectTickContext } from "../types.js";
import { ResumePoint } from "./resume-point.js";

describe("ResumePoint", () => {
  const createContext = (): EffectTickContext => ({
    blackboard: new ScopedBlackboard(),
    treeRegistry: new Registry(),
    signal: new AbortController().signal,
    timestamp: Date.now(),
    runningOps: new Map(),
  });

  it("should always return SUCCESS", async () => {
    const node = new ResumePoint({ id: "test-resume" });
    const context = createContext();

    const result = await Effect.runPromise(node.tick(context));

    expect(result).toBe(NodeStatus.SUCCESS);
    expect(node.status()).toBe(NodeStatus.SUCCESS);
  });

  it("should store the resumePointId", () => {
    const node = new ResumePoint({ id: "my-custom-id" });

    expect(node.resumePointId).toBe("my-custom-id");
    expect(node.id).toBe("resume-point-my-custom-id");
  });

  it("should not affect tree execution flow", async () => {
    const node = new ResumePoint({ id: "marker" });
    const context = createContext();

    // Execute multiple times - should always succeed
    const result1 = await Effect.runPromise(node.tick(context));
    const result2 = await Effect.runPromise(node.tick(context));
    const result3 = await Effect.runPromise(node.tick(context));

    expect(result1).toBe(NodeStatus.SUCCESS);
    expect(result2).toBe(NodeStatus.SUCCESS);
    expect(result3).toBe(NodeStatus.SUCCESS);
  });
});
