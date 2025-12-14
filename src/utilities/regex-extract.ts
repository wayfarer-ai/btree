/**
 * RegexExtract Node - Extract text using regular expressions
 *
 * Data manipulation utility node that operates on blackboard values.
 * Extracts matches from a text string using a regex pattern.
 *
 * Use Cases:
 * - Extract email addresses from text
 * - Extract numbers/IDs from strings
 * - Parse structured data from unstructured text
 * - Extract URLs from content
 */

import * as Effect from "effect/Effect";
import { ActionNode } from "../base-node.js";
import { ConfigurationError } from "../errors.js";
import {
  type EffectTickContext,
  type NodeConfiguration,
  NodeStatus,
} from "../types.js";

/**
 * Configuration for RegexExtract node
 */
export interface RegexExtractConfig extends NodeConfiguration {
  input: string; // Blackboard key containing text to extract from
  pattern: string; // Regular expression pattern
  outputKey: string; // Blackboard key to store extracted matches
  flags?: string; // Regex flags (default: "g" for global)
  matchIndex?: number; // Which match to return (0 = first, undefined = all matches array)
}

/**
 * RegexExtract Node - Extracts text using regular expressions
 */
export class RegexExtract extends ActionNode {
  private input: string;
  private pattern: string;
  private outputKey: string;
  private flags: string;
  private matchIndex?: number;

  constructor(config: RegexExtractConfig) {
    super(config);
    this.input = config.input;
    this.pattern = config.pattern;
    this.outputKey = config.outputKey;
    this.flags = config.flags || "g";
    this.matchIndex = config.matchIndex;
  }

  executeTick(
    context: EffectTickContext,
  ): Effect.Effect<NodeStatus, never, never> {
    return Effect.sync(() => {
      try {
        // Get input text from blackboard
        const text = context.blackboard.get(this.input);

        // Validate input
        if (text === undefined || text === null) {
          throw new ConfigurationError(
            `Input '${this.input}' not found in blackboard`,
          );
        }

        if (typeof text !== "string") {
          throw new ConfigurationError(
            `Input '${this.input}' must be a string, got ${typeof text}`,
          );
        }

        // Create regex from pattern and flags
        let regex: RegExp;
        try {
          regex = new RegExp(this.pattern, this.flags);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new Error(`Invalid regex pattern: ${errorMessage}`);
        }

        // Extract matches
        const matches = text.match(regex) || [];

        // Determine output value
        let result: string | string[] | null;
        if (this.matchIndex !== undefined && this.matchIndex >= 0) {
          // Return specific match
          result = matches[this.matchIndex] || null;
          this.log(`Extracted match at index ${this.matchIndex}: ${result}`);
        } else {
          // Return all matches as array
          result = matches;
          this.log(`Extracted ${matches.length} match(es) from input`);
        }

        // Store result in blackboard
        this.setOutput(context, this.outputKey, result);

        this._status = NodeStatus.SUCCESS;
        return NodeStatus.SUCCESS;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.log(`RegexExtract failed: ${errorMessage}`);
        this._status = NodeStatus.FAILURE;
        return NodeStatus.FAILURE;
      }
    });
  }
}