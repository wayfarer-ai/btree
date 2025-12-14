/**
 * Debug nodes for behavior tree debugging and resume functionality
 */

// Breakpoint is not exported - it's still in development
// The current implementation causes infinite loops with tickWhileRunning
// See docs/backlog/DEBUG_MODE.md for the full implementation plan
// export {
//   Breakpoint,
//   BreakpointSchema,
//   type BreakpointConfig,
// } from "./breakpoint.js";

export {
  ResumePoint,
  type ResumePointConfig,
} from "./resume-point.js";
