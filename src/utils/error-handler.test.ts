/**
 * Tests for error handler utility
 */

import { describe, expect, it } from "vitest";
import { ConfigurationError } from "../errors.js";
import { NodeStatus } from "../types.js";
import { handleNodeError } from "./error-handler.js";
import { OperationCancelledError } from "./signal-check.js";

describe("handleNodeError", () => {
  describe("ConfigurationError handling", () => {
    it("should re-propagate ConfigurationError", async () => {
      const error = new ConfigurationError("Test config error");

      try {
        await handleNodeError(error);
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigurationError);
        expect((err as ConfigurationError).message).toBe("Test config error");
      }
    });

    it("should preserve ConfigurationError hint when re-propagating", async () => {
      const error = new ConfigurationError(
        "Test config error",
        "Check your test file",
      );

      try {
        await handleNodeError(error);
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigurationError);
        expect((err as ConfigurationError).hint).toBe("Check your test file");
      }
    });
  });

  describe("OperationCancelledError handling", () => {
    it("should re-propagate OperationCancelledError", async () => {
      const error = new OperationCancelledError("Test cancelled");

      try {
        await handleNodeError(error);
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err).toBeInstanceOf(OperationCancelledError);
        expect((err as OperationCancelledError).message).toBe("Test cancelled");
      }
    });
  });

  describe("Generic error handling", () => {
    it("should convert generic Error to FAILURE status", async () => {
      const error = new Error("Generic error");
      const result = await handleNodeError(error);

      expect(result).toBe(NodeStatus.FAILURE);
    });

    it("should convert string error to FAILURE status", async () => {
      const error = "String error";
      const result = await handleNodeError(error);

      expect(result).toBe(NodeStatus.FAILURE);
    });

    it("should convert unknown error to FAILURE status", async () => {
      const error = { custom: "error object" };
      const result = await handleNodeError(error);

      expect(result).toBe(NodeStatus.FAILURE);
    });

    it("should convert null error to FAILURE status", async () => {
      const error = null;
      const result = await handleNodeError(error);

      expect(result).toBe(NodeStatus.FAILURE);
    });

    it("should convert undefined error to FAILURE status", async () => {
      const error = undefined;
      const result = await handleNodeError(error);

      expect(result).toBe(NodeStatus.FAILURE);
    });
  });

  describe("Error type priority", () => {
    it("should prioritize ConfigurationError over other error types", async () => {
      // Even if ConfigurationError extends Error, it should be caught first
      const error = new ConfigurationError("Config error");

      try {
        await handleNodeError(error);
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigurationError);
      }
    });

    it("should prioritize OperationCancelledError over generic errors", async () => {
      // Even if OperationCancelledError extends Error, it should be caught first
      const error = new OperationCancelledError("Cancelled");

      try {
        await handleNodeError(error);
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err).toBeInstanceOf(OperationCancelledError);
      }
    });
  });
});
