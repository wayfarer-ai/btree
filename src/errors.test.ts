import { describe, expect, it } from "vitest";
import { ConfigurationError } from "./errors.js";

describe("ConfigurationError", () => {
  it("should create error with message", () => {
    const error = new ConfigurationError("Element not found");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ConfigurationError);
    expect(error.message).toBe("Element not found");
    expect(error.name).toBe("ConfigurationError");
    expect(error.isConfigurationError).toBe(true);
  });

  it("should create error with message and hint", () => {
    const error = new ConfigurationError(
      "Element not found",
      "Use LocateElement first",
    );

    expect(error.message).toBe("Element not found");
    expect(error.hint).toBe("Use LocateElement first");
  });

  it("should create error without hint", () => {
    const error = new ConfigurationError("Something went wrong");

    expect(error.message).toBe("Something went wrong");
    expect(error.hint).toBeUndefined();
  });

  it("should have proper stack trace", () => {
    const error = new ConfigurationError("Test error");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("ConfigurationError");
  });

  it("should be distinguishable from regular Error", () => {
    const configError = new ConfigurationError("Config error");
    const regularError = new Error("Regular error");

    expect(configError).toBeInstanceOf(ConfigurationError);
    expect(regularError).not.toBeInstanceOf(ConfigurationError);

    // ConfigurationError is also an Error
    expect(configError).toBeInstanceOf(Error);
    expect(regularError).toBeInstanceOf(Error);
  });

  it("should preserve error properties when caught and rethrown", () => {
    try {
      throw new ConfigurationError("Original message", "Original hint");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      if (error instanceof ConfigurationError) {
        expect(error.message).toBe("Original message");
        expect(error.hint).toBe("Original hint");
        expect(error.isConfigurationError).toBe(true);
      }
    }
  });
});
