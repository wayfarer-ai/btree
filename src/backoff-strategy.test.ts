import { describe, expect, it } from "vitest";
import { TickDelayStrategy } from "./backoff-strategy.js";

describe("TickDelayStrategy", () => {
  describe("Auto Mode (default)", () => {
    it("should return 0ms for first 5 ticks", () => {
      const strategy = new TickDelayStrategy();

      for (let i = 0; i < 5; i++) {
        expect(strategy.getDelayAndAdvance()).toBe(0);
      }
    });

    it("should use exponential backoff after fast ticks", () => {
      const strategy = new TickDelayStrategy();

      // Skip first 5 fast ticks
      for (let i = 0; i < 5; i++) strategy.getDelayAndAdvance();

      expect(strategy.getDelayAndAdvance()).toBe(1); // tick 6
      expect(strategy.getDelayAndAdvance()).toBe(2); // tick 7
      expect(strategy.getDelayAndAdvance()).toBe(4); // tick 8
      expect(strategy.getDelayAndAdvance()).toBe(8); // tick 9
      expect(strategy.getDelayAndAdvance()).toBe(16); // tick 10 (capped)
      expect(strategy.getDelayAndAdvance()).toBe(16); // tick 11 (stays at cap)
    });

    it("should reset backoff state", () => {
      const strategy = new TickDelayStrategy();

      // Advance to backoff phase
      for (let i = 0; i < 8; i++) strategy.getDelayAndAdvance();
      expect(strategy.getDelayAndAdvance()).toBe(8);

      // Reset
      strategy.reset();

      // Should start over
      expect(strategy.getDelayAndAdvance()).toBe(0);
      expect(strategy.getDelayAndAdvance()).toBe(0);
      expect(strategy.getDelayAndAdvance()).toBe(0);
      expect(strategy.getDelayAndAdvance()).toBe(0);
      expect(strategy.getDelayAndAdvance()).toBe(0);
      expect(strategy.getDelayAndAdvance()).toBe(1); // Back to exponential after 5 fast ticks
    });

    it("should report auto mode", () => {
      const strategy = new TickDelayStrategy();
      expect(strategy.getMode()).toContain("auto");
      expect(strategy.getMode()).toContain("exponential backoff");
    });
  });

  describe("Fixed Mode", () => {
    it("should use fixed delay when specified", () => {
      const strategy = new TickDelayStrategy(10);

      for (let i = 0; i < 20; i++) {
        expect(strategy.getDelayAndAdvance()).toBe(10);
      }
    });

    it("should support immediate mode (0ms)", () => {
      const strategy = new TickDelayStrategy(0);

      for (let i = 0; i < 20; i++) {
        expect(strategy.getDelayAndAdvance()).toBe(0);
      }
    });

    it("should report fixed mode", () => {
      const strategy = new TickDelayStrategy(5);
      expect(strategy.getMode()).toContain("fixed");
      expect(strategy.getMode()).toContain("5ms");
    });

    it("should not be affected by reset in fixed mode", () => {
      const strategy = new TickDelayStrategy(10);

      expect(strategy.getDelayAndAdvance()).toBe(10);
      strategy.reset();
      expect(strategy.getDelayAndAdvance()).toBe(10);
    });
  });
});
