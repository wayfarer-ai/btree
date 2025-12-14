/**
 * Tests for Breakpoint node
 */

import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { Registry } from "../registry.js";
import { NodeStatus, type EffectTickContext } from "../types.js";
import { Breakpoint } from "./breakpoint.js";

describe("Breakpoint", () => {
  const createContext = (): EffectTickContext => ({
    blackboard: new ScopedBlackboard(),
    treeRegistry: new Registry(),
    signal: new AbortController().signal,
    timestamp: Date.now(),
    runningOps: new Map(),
  });

  it("should return RUNNING to signal pause", async () => {
    const node = new Breakpoint({ id: "test-break" });
    const context = createContext();

    const result = await Effect.runPromise(node.tick(context));

    expect(result).toBe(NodeStatus.RUNNING);
    expect(node.status()).toBe(NodeStatus.RUNNING);
  });

  it("should store the breakpointId", () => {
    const node = new Breakpoint({ id: "my-breakpoint" });

    expect(node.breakpointId).toBe("my-breakpoint");
    expect(node.id).toBe("breakpoint-my-breakpoint");
  });

  it("should consistently return RUNNING", async () => {
    const node = new Breakpoint({ id: "pause-here" });
    const context = createContext();

    // Execute multiple times - should always return RUNNING
    const result1 = await Effect.runPromise(node.tick(context));
    const result2 = await Effect.runPromise(node.tick(context));

    expect(result1).toBe(NodeStatus.RUNNING);
    expect(result2).toBe(NodeStatus.RUNNING);
  });
});
