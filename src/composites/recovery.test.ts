/**
 * Tests for Recovery node
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ScopedBlackboard } from "../blackboard.js";
import { ConfigurationError } from "../errors.js";
import { FailureNode, SuccessNode } from "../test-nodes.js";
import { type TemporalContext, NodeStatus } from "../types.js";
import { Recovery } from "./recovery.js";

describe("Recovery", () => {
  let blackboard: ScopedBlackboard;
  let context: TemporalContext;

  beforeEach(() => {
    blackboard = new ScopedBlackboard("root");
    context = {
      blackboard,
      timestamp: Date.now(),
      deltaTime: 0,
    };
  });

  describe("Try-Catch Logic", () => {
    it("should return try result on success", async () => {
      const recovery = new Recovery({ id: "recovery1" });
      recovery.addChild(new SuccessNode({ id: "try" }));
      recovery.addChild(new FailureNode({ id: "catch" }));

      const result = await recovery.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
    });

    it("should execute catch on try failure", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      let catchExecuted = false;
      class CatchTracker extends SuccessNode {
        async tick(context: TemporalContext) {
          catchExecuted = true;
          return await super.tick(context);
        }
      }

      recovery.addChild(new FailureNode({ id: "try" }));
      recovery.addChild(new CatchTracker({ id: "catch" }));

      const result = await recovery.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
      expect(catchExecuted).toBe(true);
    });

    it("should propagate catch result on try failure", async () => {
      const recovery = new Recovery({ id: "recovery1" });
      recovery.addChild(new FailureNode({ id: "try" }));
      recovery.addChild(new FailureNode({ id: "catch" }));

      const result = await recovery.tick(context);
      expect(result).toBe(NodeStatus.FAILURE);
    });

    it("should handle thrown errors with catch", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      class ThrowingNode extends SuccessNode {
        async executeTick(_context: TemporalContext) {
          throw new Error("Test error");
        }
      }

      recovery.addChild(new ThrowingNode({ id: "try" }));
      recovery.addChild(new SuccessNode({ id: "catch" }));

      // With error handling, errors are converted to FAILURE status
      // Recovery executes catch branch when try fails, and catch succeeds
      const status = await recovery.tick(context);
      expect(status).toBe(NodeStatus.SUCCESS); // Catch branch succeeds
    });

    it("should return FAILURE on thrown error without catch", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      class ThrowingNode extends SuccessNode {
        async executeTick(_context: TemporalContext) {
          throw new Error("Test error");
        }
      }

      recovery.addChild(new ThrowingNode({ id: "try" }));

      // With our changes, errors are caught and converted to FAILURE status
      // So recovery will complete with FAILURE status (no catch branch)
      const status = await recovery.tick(context);
      expect(status).toBe(NodeStatus.FAILURE);
    });
  });

  describe("Try-Finally Logic", () => {
    it("should execute finally after successful try", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      let finallyExecuted = false;
      class FinallyTracker extends SuccessNode {
        async tick(context: TemporalContext) {
          finallyExecuted = true;
          return await super.tick(context);
        }
      }

      // Structure: try, catch (pass-through), finally
      recovery.addChild(new SuccessNode({ id: "try" }));
      recovery.addChild(new SuccessNode({ id: "catch" })); // No-op catch
      recovery.addChild(new FinallyTracker({ id: "finally" }));

      await recovery.tick(context);
      expect(finallyExecuted).toBe(true);
    });

    it("should execute finally after failed try", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      let finallyExecuted = false;
      class FinallyTracker extends SuccessNode {
        async tick(context: TemporalContext) {
          finallyExecuted = true;
          return await super.tick(context);
        }
      }

      // Structure: try, catch, finally
      recovery.addChild(new FailureNode({ id: "try" }));
      recovery.addChild(new SuccessNode({ id: "catch" })); // Catch recovers
      recovery.addChild(new FinallyTracker({ id: "finally" }));

      await recovery.tick(context);
      expect(finallyExecuted).toBe(true);
    });

    it("should not change result if finally fails", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      recovery.addChild(new SuccessNode({ id: "try" }));
      recovery.addChild(new SuccessNode({ id: "catch" })); // No-op catch
      recovery.addChild(new FailureNode({ id: "finally" }));

      const result = await recovery.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS); // Try result, not finally
    });
  });

  describe("Try-Catch-Finally Logic", () => {
    it("should execute all branches in order", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      const executionOrder: string[] = [];

      class TryTracker extends FailureNode {
        async tick(context: TemporalContext) {
          executionOrder.push("try");
          return await super.tick(context);
        }
      }

      class CatchTracker extends SuccessNode {
        async tick(context: TemporalContext) {
          executionOrder.push("catch");
          return await super.tick(context);
        }
      }

      class FinallyTracker extends SuccessNode {
        async tick(context: TemporalContext) {
          executionOrder.push("finally");
          return await super.tick(context);
        }
      }

      recovery.addChild(new TryTracker({ id: "try" }));
      recovery.addChild(new CatchTracker({ id: "catch" }));
      recovery.addChild(new FinallyTracker({ id: "finally" }));

      await recovery.tick(context);
      expect(executionOrder).toEqual(["try", "catch", "finally"]);
    });

    it("should execute finally even if catch fails", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      let finallyExecuted = false;
      class FinallyTracker extends SuccessNode {
        async tick(context: TemporalContext) {
          finallyExecuted = true;
          return await super.tick(context);
        }
      }

      recovery.addChild(new FailureNode({ id: "try" }));
      recovery.addChild(new FailureNode({ id: "catch" }));
      recovery.addChild(new FinallyTracker({ id: "finally" }));

      await recovery.tick(context);
      expect(finallyExecuted).toBe(true);
    });

    it("should execute finally even on thrown errors", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      let _finallyExecuted = false;

      class ThrowingNode extends SuccessNode {
        async executeTick(_context: TemporalContext) {
          throw new Error("Test error");
        }
      }

      class FinallyTracker extends SuccessNode {
        async tick(context: TemporalContext) {
          _finallyExecuted = true;
          return await super.tick(context);
        }
      }

      recovery.addChild(new ThrowingNode({ id: "try" }));
      recovery.addChild(new SuccessNode({ id: "catch" }));
      recovery.addChild(new FinallyTracker({ id: "finally" }));

      // With our changes, errors are caught and converted to FAILURE status
      // Recovery executes catch branch when try fails, catch succeeds, so recovery returns SUCCESS
      const status = await recovery.tick(context);
      expect(status).toBe(NodeStatus.SUCCESS); // Catch branch succeeds
      // Finally should execute even when try branch fails
      expect(_finallyExecuted).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should enforce maximum 3 children", () => {
      const recovery = new Recovery({ id: "recovery1" });
      recovery.addChild(new SuccessNode({ id: "try" }));
      recovery.addChild(new SuccessNode({ id: "catch" }));
      recovery.addChild(new SuccessNode({ id: "finally" }));

      expect(() => {
        recovery.addChild(new SuccessNode({ id: "extra" }));
      }).toThrow("Recovery can have maximum 3 children");
    });

    it("should propagate ConfigurationError without try branch", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      try {
        await recovery.tick(context);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect((error as ConfigurationError).message).toContain(
          "Recovery requires at least a try branch",
        );
      }
    });

    it("should work with only try branch", async () => {
      const recovery = new Recovery({ id: "recovery1" });
      recovery.addChild(new SuccessNode({ id: "try" }));

      const result = await recovery.tick(context);
      expect(result).toBe(NodeStatus.SUCCESS);
    });

    it("should propagate ConfigurationError from try branch immediately", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      class ConfigErrorNode extends SuccessNode {
        async executeTick(_context: TemporalContext) {
          throw new ConfigurationError("Test config error");
        }
      }

      recovery.addChild(new ConfigErrorNode({ id: "try" }));
      recovery.addChild(new SuccessNode({ id: "catch" }));

      try {
        await recovery.tick(context);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect((error as ConfigurationError).message).toContain("Test config error");
      }
    });

    it("should propagate ConfigurationError from finally branch", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      class ConfigErrorNode extends SuccessNode {
        async executeTick(_context: TemporalContext) {
          throw new ConfigurationError("Finally config error");
        }
      }

      recovery.addChild(new SuccessNode({ id: "try" }));
      recovery.addChild(new SuccessNode({ id: "catch" }));
      recovery.addChild(new ConfigErrorNode({ id: "finally" }));

      try {
        await recovery.tick(context);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect((error as ConfigurationError).message).toContain("Finally config error");
      }
    });

    it("should NOT execute finally when try has ConfigurationError (immediate propagation)", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      let finallyExecuted = false;

      class ConfigErrorNode extends SuccessNode {
        async executeTick(_context: TemporalContext) {
          throw new ConfigurationError("Try config error");
        }
      }

      class FinallyTracker extends SuccessNode {
        async tick(context: TemporalContext) {
          finallyExecuted = true;
          return await super.tick(context);
        }
      }

      recovery.addChild(new ConfigErrorNode({ id: "try" }));
      recovery.addChild(new SuccessNode({ id: "catch" }));
      recovery.addChild(new FinallyTracker({ id: "finally" }));

      // ConfigurationError should propagate immediately without executing finally
      // This differs from traditional finally semantics but is intentional:
      // ConfigurationError means the test is broken, so we stop immediately
      try {
        await recovery.tick(context);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
      }
      expect(finallyExecuted).toBe(false);
    });

    it("should return try result when finally returns RUNNING", async () => {
      const recovery = new Recovery({ id: "recovery1" });

      class RunningNode extends SuccessNode {
        async tick(_context: TemporalContext) {
          return NodeStatus.RUNNING;
        }
      }

      recovery.addChild(new SuccessNode({ id: "try" }));
      recovery.addChild(new SuccessNode({ id: "catch" }));
      recovery.addChild(new RunningNode({ id: "finally" }));

      const result = await recovery.tick(context);
      // Should return try result (SUCCESS), not finally result (RUNNING)
      expect(result).toBe(NodeStatus.SUCCESS);
    });
  });
});
