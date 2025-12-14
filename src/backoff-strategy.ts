/**
 * Manages tick delay strategy with automatic reset
 * Default: Auto exponential backoff (0 → 1 → 2 → 4 → 8 → 16ms cap)
 */
export class TickDelayStrategy {
  private mode: "auto" | "fixed";
  private fixedDelayMs: number;

  // Auto mode state
  private currentTick: number = 0;
  private currentDelayMs: number = 0;

  // Auto mode constants
  private readonly FAST_TICKS = 5;
  private readonly INITIAL_DELAY_MS = 1;
  private readonly MAX_DELAY_MS = 16;
  private readonly MULTIPLIER = 2;

  constructor(tickDelayMs?: number) {
    if (tickDelayMs === undefined) {
      this.mode = "auto";
      this.fixedDelayMs = 0;
    } else {
      this.mode = "fixed";
      this.fixedDelayMs = tickDelayMs;
    }
  }

  /**
   * Get delay for current tick and advance state
   * @returns Delay in milliseconds (0 = use setImmediate)
   */
  getDelayAndAdvance(): number {
    if (this.mode === "fixed") {
      return this.fixedDelayMs;
    }

    // Auto mode: exponential backoff
    const tick = this.currentTick++;

    // Fast initial ticks (0ms = setImmediate)
    if (tick < this.FAST_TICKS) {
      return 0;
    }

    // Calculate exponential delay
    if (this.currentDelayMs === 0) {
      this.currentDelayMs = this.INITIAL_DELAY_MS;
    } else {
      this.currentDelayMs = Math.min(
        this.currentDelayMs * this.MULTIPLIER,
        this.MAX_DELAY_MS,
      );
    }

    return this.currentDelayMs;
  }

  /**
   * Reset backoff state
   * Called when operation completes (status changes from RUNNING)
   * or when starting a new operation (status changes to RUNNING)
   */
  reset(): void {
    this.currentTick = 0;
    this.currentDelayMs = 0;
  }

  /**
   * Get current mode for logging/debugging
   */
  getMode(): string {
    return this.mode === "auto"
      ? "auto (exponential backoff)"
      : `fixed (${this.fixedDelayMs}ms)`;
  }
}
