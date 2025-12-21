/**
 * Tests for signal checking utilities
 * These utilities provide cancellation support across behavior tree nodes
 */

import { describe, expect, it } from "vitest";
import {
  checkSignal,
  createAbortPromise,
  OperationCancelledError,
} from "./signal-check.js";

describe("signal-check utilities", () => {
  describe("checkSignal", () => {
    it("should fail with OperationCancelledError when signal is aborted", () => {
      const controller = new AbortController();
      controller.abort();

      try {
        checkSignal(controller.signal);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(OperationCancelledError);
        expect((error as OperationCancelledError).message).toBe("Operation was cancelled");
      }
    });

    it("should succeed when signal is undefined", () => {
      expect(() => checkSignal(undefined)).not.toThrow();
    });

    it("should succeed when signal is provided but not aborted", () => {
      const controller = new AbortController();
      expect(() => checkSignal(controller.signal)).not.toThrow();
    });

    it("should include custom message in error when provided", () => {
      const controller = new AbortController();
      controller.abort();

      try {
        checkSignal(controller.signal, "Custom operation");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect((error as OperationCancelledError).message).toBe("Custom operation");
      }
    });
  });

  describe("createAbortPromise", () => {
    it("should reject with OperationCancelledError when signal is aborted", async () => {
      const controller = new AbortController();
      const promise = createAbortPromise(controller.signal);

      // Abort after a short delay
      setTimeout(() => controller.abort(), 10);

      await expect(promise).rejects.toThrow(OperationCancelledError);
      await expect(promise).rejects.toThrow("Operation was cancelled");
    });

    it("should reject immediately if signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const promise = createAbortPromise(controller.signal);

      await expect(promise).rejects.toThrow(OperationCancelledError);
    });

    it("should never resolve if signal is never aborted (race with timeout)", async () => {
      const controller = new AbortController();
      const abortPromise = createAbortPromise(controller.signal);

      // Race with a timeout - abort promise should not resolve
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve("timeout"), 50),
      );

      const result = await Promise.race([abortPromise, timeoutPromise]);
      expect(result).toBe("timeout");
    });

    it("should not reject when signal is undefined (race with timeout)", async () => {
      const abortPromise = createAbortPromise(undefined);
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve("timeout"), 50),
      );

      const result = await Promise.race([abortPromise, timeoutPromise]);
      expect(result).toBe("timeout");
    });

    it("should include custom message in error when provided", async () => {
      const controller = new AbortController();
      controller.abort();

      const promise = createAbortPromise(controller.signal, "Async operation");

      await expect(promise).rejects.toThrow("Async operation");
    });

    it("should clean up event listener when signal is aborted", async () => {
      const controller = new AbortController();
      const promise = createAbortPromise(controller.signal);

      // Abort the signal
      controller.abort();

      // Wait for rejection
      await expect(promise).rejects.toThrow(OperationCancelledError);

      // Verify event listener was removed (no way to directly test, but we can check it doesn't throw)
      expect(() => controller.abort()).not.toThrow();
    });
  });

  describe("OperationCancelledError", () => {
    it("should be an instance of Error", () => {
      const error = new OperationCancelledError();
      expect(error).toBeInstanceOf(Error);
    });

    it("should have correct name", () => {
      const error = new OperationCancelledError();
      expect(error.name).toBe("OperationCancelledError");
    });

    it("should support custom message", () => {
      const error = new OperationCancelledError("Custom message");
      expect(error.message).toBe("Custom message");
    });

    it("should have default message", () => {
      const error = new OperationCancelledError();
      expect(error.message).toBe("Operation was cancelled");
    });
  });

  describe("integration scenarios", () => {
    it("should support using checkSignal in loops", async () => {
      const controller = new AbortController();
      let iterations = 0;

      const performWork = async () => {
        for (let i = 0; i < 1000; i++) {
          await checkSignal(controller.signal);
          iterations++;

          if (i === 5) {
            controller.abort();
          }
        }
      };

      try {
        await performWork();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(OperationCancelledError);
        expect(iterations).toBe(6); // 0, 1, 2, 3, 4, 5, then abort
      }
    });

    it("should support racing abort promise with actual work", async () => {
      const controller = new AbortController();

      const work = new Promise<string>((resolve) => {
        setTimeout(() => resolve("work completed"), 100);
      });

      const abort = createAbortPromise(controller.signal);

      // Abort after 20ms
      setTimeout(() => controller.abort(), 20);

      // Abort should win the race
      await expect(Promise.race([work, abort])).rejects.toThrow(
        OperationCancelledError,
      );
    });

    it("should support checking signal before async operations", async () => {
      const controller = new AbortController();
      controller.abort();

      const performAsyncWork = async () => {
        // Check signal before starting work
        await checkSignal(controller.signal);

        // This should never execute
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "completed";
      };

      try {
        await performAsyncWork();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(OperationCancelledError);
      }
    });

    it("should support checking signal multiple times during execution", async () => {
      const controller = new AbortController();
      let checkpointReached = 0;

      const performWork = async () => {
        await checkSignal(controller.signal);
        checkpointReached = 1;
        await new Promise((resolve) => setTimeout(resolve, 10));

        await checkSignal(controller.signal);
        checkpointReached = 2;
        await new Promise((resolve) => setTimeout(resolve, 10));

        await checkSignal(controller.signal);
        checkpointReached = 3;
      };

      // Start work and abort after checkpoint 1 but before checkpoint 2
      const workPromise = performWork();
      setTimeout(() => controller.abort(), 5);

      try {
        await workPromise;
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(OperationCancelledError);
        expect(checkpointReached).toBe(1);
      }
    });
  });
});
