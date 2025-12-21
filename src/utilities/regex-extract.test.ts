/**
 * Tests for RegexExtract Node
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  type TemporalContext,
  NodeStatus,
  ScopedBlackboard,
} from "../index.js";
import { RegexExtract } from "./regex-extract.js";

describe("RegexExtract", () => {
  let blackboard: ScopedBlackboard;
  let context: TemporalContext;

  beforeEach(() => {
    blackboard = new ScopedBlackboard();
    context = {
      blackboard: blackboard,
      timestamp: Date.now(),
      deltaTime: 0,
    };
  });

  it("should extract all matches when matchIndex is not specified", async () => {
    blackboard.set("text", "Contact: support@example.com, sales@example.com");

    const node = new RegexExtract({
      id: "extract-emails",
      input: "text",
      pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
      outputKey: "emails",
    });

    const result = await node.tick(context);

    expect(result).toBe(NodeStatus.SUCCESS);
    const emails = blackboard.get("emails");
    expect(emails).toEqual(["support@example.com", "sales@example.com"]);
  });

  it("should extract specific match when matchIndex is specified", async () => {
    blackboard.set("text", "Price: $99.99 and $149.99");

    const node = new RegexExtract({
      id: "extract-price",
      input: "text",
      pattern: "\\$\\d+\\.\\d{2}",
      outputKey: "firstPrice",
      matchIndex: 0,
    });

    const result = await node.tick(context);

    expect(result).toBe(NodeStatus.SUCCESS);
    const price = blackboard.get("firstPrice");
    expect(price).toBe("$99.99");
  });

  it("should return null when matchIndex is out of bounds", async () => {
    blackboard.set("text", "No numbers here");

    const node = new RegexExtract({
      id: "extract-number",
      input: "text",
      pattern: "\\d+",
      outputKey: "number",
      matchIndex: 0,
    });

    const result = await node.tick(context);

    expect(result).toBe(NodeStatus.SUCCESS);
    const number = blackboard.get("number");
    expect(number).toBeNull();
  });

  it("should return empty array when no matches found", async () => {
    blackboard.set("text", "No emails here");

    const node = new RegexExtract({
      id: "extract-emails",
      input: "text",
      pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
      outputKey: "emails",
    });

    const result = await node.tick(context);

    expect(result).toBe(NodeStatus.SUCCESS);
    const emails = blackboard.get("emails");
    expect(emails).toEqual([]);
  });

  it("should fail when input is not a string", async () => {
    blackboard.set("text", 123);

    const node = new RegexExtract({
      id: "extract",
      input: "text",
      pattern: "\\d+",
      outputKey: "result",
    });

    const result = await node.tick(context);

    expect(result).toBe(NodeStatus.FAILURE);
  });

  it("should fail when input is not found in blackboard", async () => {
    const node = new RegexExtract({
      id: "extract",
      input: "missing",
      pattern: "\\d+",
      outputKey: "result",
    });

    const result = await node.tick(context);

    expect(result).toBe(NodeStatus.FAILURE);
  });

  it("should fail when regex pattern is invalid", async () => {
    blackboard.set("text", "test");

    const node = new RegexExtract({
      id: "extract",
      input: "text",
      pattern: "[invalid",
      outputKey: "result",
    });

    const result = await node.tick(context);

    expect(result).toBe(NodeStatus.FAILURE);
  });
});
