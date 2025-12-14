/**
 * Tests for RegexExtract Node
 */

import { beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import {
  type EffectTickContext,
  NodeStatus,
  ScopedBlackboard,
} from "../index.js";
import { RegexExtract } from "./regex-extract.js";

describe("RegexExtract", () => {
  let blackboard: ScopedBlackboard;
  let context: EffectTickContext;

  beforeEach(() => {
    blackboard = new ScopedBlackboard();
    context = {
      blackboard: blackboard,
      timestamp: Date.now(),
      deltaTime: 0,
      runningOps: new Map(),
    };
  });

  it.effect("should extract all matches when matchIndex is not specified", () =>
    Effect.gen(function* (_) {
      blackboard.set("text", "Contact: support@example.com, sales@example.com");

      const node = new RegexExtract({
        id: "extract-emails",
        input: "text",
        pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
        outputKey: "emails",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      const emails = blackboard.get("emails");
      expect(emails).toEqual(["support@example.com", "sales@example.com"]);
    }),
  );

  it.effect("should extract specific match when matchIndex is specified", () =>
    Effect.gen(function* (_) {
      blackboard.set("text", "Price: $99.99 and $149.99");

      const node = new RegexExtract({
        id: "extract-price",
        input: "text",
        pattern: "\\$\\d+\\.\\d{2}",
        outputKey: "firstPrice",
        matchIndex: 0,
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      const price = blackboard.get("firstPrice");
      expect(price).toBe("$99.99");
    }),
  );

  it.effect("should return null when matchIndex is out of bounds", () =>
    Effect.gen(function* (_) {
      blackboard.set("text", "No numbers here");

      const node = new RegexExtract({
        id: "extract-number",
        input: "text",
        pattern: "\\d+",
        outputKey: "number",
        matchIndex: 0,
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      const number = blackboard.get("number");
      expect(number).toBeNull();
    }),
  );

  it.effect("should return empty array when no matches found", () =>
    Effect.gen(function* (_) {
      blackboard.set("text", "No emails here");

      const node = new RegexExtract({
        id: "extract-emails",
        input: "text",
        pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
        outputKey: "emails",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.SUCCESS);
      const emails = blackboard.get("emails");
      expect(emails).toEqual([]);
    }),
  );

  it.effect("should fail when input is not a string", () =>
    Effect.gen(function* (_) {
      blackboard.set("text", 123);

      const node = new RegexExtract({
        id: "extract",
        input: "text",
        pattern: "\\d+",
        outputKey: "result",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.FAILURE);
    }),
  );

  it.effect("should fail when input is not found in blackboard", () =>
    Effect.gen(function* (_) {
      const node = new RegexExtract({
        id: "extract",
        input: "missing",
        pattern: "\\d+",
        outputKey: "result",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.FAILURE);
    }),
  );

  it.effect("should fail when regex pattern is invalid", () =>
    Effect.gen(function* (_) {
      blackboard.set("text", "test");

      const node = new RegexExtract({
        id: "extract",
        input: "text",
        pattern: "[invalid",
        outputKey: "result",
      });

      const result = yield* _(node.tick(context));

      expect(result).toBe(NodeStatus.FAILURE);
    }),
  );
});
