/**
 * LogMessage Node - Log messages for debugging and test visibility
 *
 * Utility node that logs messages to console with optional blackboard value resolution.
 * Useful for debugging test flows and tracking execution progress.
 *
 * Use Cases:
 * - Log intermediate values during test execution
 * - Debug blackboard state at specific points
 * - Add visibility to test steps
 * - Track execution flow
 *
 * Examples:
 * - Log static message: <LogMessage message="Starting form submission" />
 * - Log blackboard value: <LogMessage message="Current URL: ${currentUrl}" />
 * - Log with level: <LogMessage message="Error occurred" level="error" />
 */

import { ActionNode } from "../base-node.js";
import { NodeEventType } from "../events.js";
import {
  type TemporalContext,
  type NodeConfiguration,
  NodeStatus,
} from "../types.js";

/**
 * Configuration for LogMessage node
 */
export interface LogMessageConfig extends NodeConfiguration {
  message: string; // Message to log (supports ${key} placeholders for blackboard values)
  level?: "info" | "warn" | "error" | "debug"; // Log level (default: 'info')
}

/**
 * LogMessage Node - Logs messages with optional blackboard value resolution
 */
export class LogMessage extends ActionNode {
  private message: string;
  private level: "info" | "warn" | "error" | "debug";

  constructor(config: LogMessageConfig) {
    super(config);
    this.message = config.message;
    this.level = config.level || "info";
  }

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    try {
      // Resolve blackboard values in message (supports ${key} syntax)
      const resolvedMessage = this.resolveMessage(this.message, context);

      // Log based on level
      switch (this.level) {
        case "warn":
          console.warn(`[LogMessage:${this.name}] ${resolvedMessage}`);
          break;
        case "error":
          console.error(`[LogMessage:${this.name}] ${resolvedMessage}`);
          break;
        case "debug":
          console.debug(`[LogMessage:${this.name}] ${resolvedMessage}`);
          break;
        default:
          console.log(`[LogMessage:${this.name}] ${resolvedMessage}`);
          break;
      }

      // Emit LOG event for collection
      context.eventEmitter?.emit({
        type: NodeEventType.LOG,
        nodeId: this.id,
        nodeName: this.name,
        nodeType: this.type,
        timestamp: Date.now(),
        data: { level: this.level, message: resolvedMessage },
      });

      this._status = NodeStatus.SUCCESS;
      return NodeStatus.SUCCESS;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[LogMessage:${this.name}] Failed to log message: ${errorMessage}`,
      );
      this._status = NodeStatus.FAILURE;
      return NodeStatus.FAILURE;
    }
  }

  /**
   * Resolve blackboard values in message string
   * Supports ${key} syntax for blackboard references
   */
  private resolveMessage(message: string, context: TemporalContext): string {
    // Match ${key} patterns
    const placeholderRegex = /\$\{([^}]+)\}/g;

    return message.replace(placeholderRegex, (match, key) => {
      const trimmedKey = key.trim();
      const value = context.blackboard.get(trimmedKey);

      // If value is undefined, return the placeholder as-is
      if (value === undefined) {
        return match;
      }

      // Format the value for display
      if (value === null) {
        return "null";
      }

      if (typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      }

      return String(value);
    });
  }
}
