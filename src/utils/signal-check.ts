/**
 * Signal checking utilities for cancellation support
 *
 * These utilities provide a consistent way to check for cancellation signals
 * across all behavior tree nodes. They work with AbortController/AbortSignal
 * to enable interruption of long-running operations.
 *
 * Usage:
 * 1. checkSignal() - Use in loops and before operations to check if cancelled
 * 2. createAbortPromise() - Use with Promise.race() to cancel async operations
 *
 * @module signal-check
 */

import * as Effect from "effect/Effect";

/**
 * Error thrown when an operation is cancelled via AbortSignal
 */
export class OperationCancelledError extends Error {
  constructor(message: string = "Operation was cancelled") {
    super(message);
    this.name = "OperationCancelledError";

    // Maintains proper stack trace in V8 environments (Chrome, Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OperationCancelledError);
    }
  }
}

/**
 * Synchronously check if an abort signal has been triggered
 *
 * This is the primary mechanism for cooperative cancellation in behavior tree nodes.
 * Call this function:
 * - At the start of node execution
 * - Before ticking each child in a composite
 * - Inside loops during long-running operations
 * - Before starting expensive operations
 *
 * @param signal - Optional AbortSignal from TickContext
 * @param message - Optional custom error message (defaults to "Operation was cancelled")
 * @returns Effect that fails with OperationCancelledError if signal is aborted, succeeds otherwise
 *
 * @example
 * ```typescript
 * // In a composite node
 * protected executeTick(context: EffectTickContext) {
 *   return Effect.gen(function* (_) {
 *     yield* _(checkSignal(context.signal)); // Check before each child
 *     for (const child of self._children) {
 *       const status = yield* _(child.tick(context));
 *       // ...
 *     }
 *   });
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In a decorator with loops
 * protected executeTick(context: EffectTickContext) {
 *   return Effect.gen(function* (_) {
 *     for (let i = 0; i < maxAttempts; i++) {
 *       yield* _(checkSignal(context.signal, 'Retry operation'));
 *       // ...
 *     }
 *   });
 * }
 * ```
 */
export function checkSignal(
  signal?: AbortSignal,
  message?: string,
): Effect.Effect<void, OperationCancelledError, never> {
  if (signal?.aborted) {
    return Effect.fail(new OperationCancelledError(message));
  }
  return Effect.succeed(undefined);
}

/**
 * Create a promise that rejects when an abort signal is triggered
 *
 * This enables true async cancellation by racing with actual work.
 * Use with Promise.race() to cancel Promises that don't natively support signals.
 *
 * The promise:
 * - Rejects immediately if signal is already aborted
 * - Rejects when signal fires 'abort' event
 * - Never resolves (only rejects or remains pending)
 * - Cleans up event listener when aborted
 *
 * @param signal - Optional AbortSignal from TickContext
 * @param message - Optional custom error message (defaults to "Operation was cancelled")
 * @returns Promise that rejects with OperationCancelledError when signal aborts
 *
 * @example
 * ```typescript
 * // Racing with a Promise that doesn't support signals
 * protected async executeWithPlaywright(adapter: PlaywrightAdapter, context: TickContext) {
 *   const work = someAsyncOperation();
 *   const abort = createAbortPromise(context.signal);
 *
 *   const result = await Promise.race([work, abort]);
 *   return result;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In a node that performs multiple async steps
 * protected async executeWithPlaywright(adapter: PlaywrightAdapter, context: TickContext) {
 *   const abort = createAbortPromise(context.signal);
 *
 *   const step1 = adapter.page.waitForSelector('.loading', { state: 'hidden' });
 *   await Promise.race([step1, abort]);
 *
 *   const step2 = adapter.page.click('.button');
 *   await Promise.race([step2, abort]);
 *
 *   return NodeStatus.SUCCESS;
 * }
 * ```
 */
export function createAbortPromise(
  signal?: AbortSignal,
  message?: string,
): Promise<never> {
  return new Promise((_, reject) => {
    // If no signal provided, never reject (infinite pending)
    if (!signal) {
      return;
    }

    // If already aborted, reject immediately
    if (signal.aborted) {
      reject(new OperationCancelledError(message));
      return;
    }

    // Listen for abort event
    const onAbort = () => {
      reject(new OperationCancelledError(message));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
