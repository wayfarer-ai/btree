/**
 * Tests for schema validation utilities
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  zodErrorToConfigurationError,
  validateConfiguration,
  safeValidateConfiguration,
} from "./validation.js";
import { ConfigurationError } from "../errors.js";

describe("Schema Validation Utilities", () => {
  describe("zodErrorToConfigurationError", () => {
    it("should convert Zod error to ConfigurationError", () => {
      const schema = z.object({
        id: z.string(),
        value: z.number().positive(),
      });

      try {
        schema.parse({ id: "test", value: -5 });
        expect.fail("Should have thrown");
      } catch (error) {
        if (error instanceof z.ZodError) {
          const configError = zodErrorToConfigurationError(
            error,
            "TestNode",
            "test-id",
          );

          expect(configError).toBeInstanceOf(ConfigurationError);
          expect(configError.message).toContain("TestNode:test-id");
          expect(configError.message).toContain("value");
        }
      }
    });

    it("should include field path in error message", () => {
      const schema = z.object({
        nested: z.object({
          value: z.number(),
        }),
      });

      try {
        schema.parse({ nested: { value: "not a number" } });
        expect.fail("Should have thrown");
      } catch (error) {
        if (error instanceof z.ZodError) {
          const configError = zodErrorToConfigurationError(error, "TestNode");

          expect(configError.message).toContain("nested.value");
        }
      }
    });
  });

  describe("validateConfiguration", () => {
    const testSchema = z.object({
      id: z.string(),
      count: z.number().int().positive(),
    });

    it("should validate and return valid configuration", () => {
      const config = { id: "test", count: 5 };
      const result = validateConfiguration(
        testSchema,
        config,
        "TestNode",
        "test-id",
      );

      expect(result).toEqual(config);
    });

    it("should throw ConfigurationError for invalid configuration", () => {
      const config = { id: "test", count: -5 };

      expect(() => {
        validateConfiguration(testSchema, config, "TestNode", "test-id");
      }).toThrow(ConfigurationError);
    });

    it("should include node type and ID in error message", () => {
      const config = { id: "test", count: 0 };

      try {
        validateConfiguration(testSchema, config, "TestNode", "test-id");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect((error as ConfigurationError).message).toContain(
          "TestNode:test-id",
        );
      }
    });
  });

  describe("safeValidateConfiguration", () => {
    const testSchema = z.object({
      id: z.string(),
      value: z.number(),
    });

    it("should return success result for valid configuration", () => {
      const config = { id: "test", value: 42 };
      const result = safeValidateConfiguration(
        testSchema,
        config,
        "TestNode",
        "test-id",
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it("should return error result for invalid configuration", () => {
      const config = { id: "test", value: "not a number" };
      const result = safeValidateConfiguration(
        testSchema,
        config,
        "TestNode",
        "test-id",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ConfigurationError);
        expect(result.error.message).toContain("value");
      }
    });

    it("should not throw errors", () => {
      const config = { id: 123, value: "invalid" }; // Multiple errors

      expect(() => {
        safeValidateConfiguration(testSchema, config, "TestNode");
      }).not.toThrow();
    });
  });
});
