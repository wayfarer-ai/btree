/**
 * Simple test nodes for demonstrating behavior tree functionality
 */

import { ActionNode, ConditionNode } from "./base-node.js";
import {
  type TemporalContext,
  type NodeConfiguration,
  NodeStatus,
} from "./types.js";

/**
 * Simple action that prints a message and succeeds
 */
export class PrintAction extends ActionNode {
  private message: string;

  constructor(config: NodeConfiguration & { message?: string }) {
    super(config);
    this.message = config.message || "Hello from PrintAction!";
  }

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    this.log(`Executing: "${this.message}"`);

    // Optionally store result in blackboard
    if (this.config.outputKey && typeof this.config.outputKey === "string") {
      context.blackboard.set(this.config.outputKey, this.message);
    }

    this._status = NodeStatus.SUCCESS;
    return NodeStatus.SUCCESS;
  }
}

/**
 * Action that waits for a specified duration
 */
export class WaitAction extends ActionNode {
  private waitMs: number;
  private startTime: number | null = null;

  constructor(config: NodeConfiguration & { waitMs?: number }) {
    super(config);
    this.waitMs = config.waitMs || 1000;
  }

  async executeTick(_context: TemporalContext): Promise<NodeStatus> {
    if (this.startTime === null) {
      this.startTime = Date.now();
      this.log(`Starting wait for ${this.waitMs}ms`);
      this._status = NodeStatus.RUNNING;
      return NodeStatus.RUNNING;
    }

    const elapsed = Date.now() - this.startTime;

    if (elapsed < this.waitMs) {
      this.log(`Waiting... ${this.waitMs - elapsed}ms remaining`);
      this._status = NodeStatus.RUNNING;
      return NodeStatus.RUNNING;
    }

    this.log(`Wait completed after ${elapsed}ms`);
    this.startTime = null;
    this._status = NodeStatus.SUCCESS;
    return NodeStatus.SUCCESS;
  }

  protected onReset(): void {
    this.startTime = null;
  }

  protected onHalt(): void {
    this.startTime = null;
  }
}

/**
 * Action that increments a counter in the blackboard
 */
export class CounterAction extends ActionNode {
  private counterKey: string;
  private increment: number;

  constructor(
    config: NodeConfiguration & { counterKey?: string; increment?: number },
  ) {
    super(config);
    this.counterKey = config.counterKey || "counter";
    this.increment = config.increment || 1;
  }

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    const currentValue =
      (context.blackboard.get(this.counterKey) as number) || 0;
    const newValue = currentValue + this.increment;

    context.blackboard.set(this.counterKey, newValue);
    this.log(
      `Counter '${this.counterKey}' incremented from ${currentValue} to ${newValue}`,
    );

    this._status = NodeStatus.SUCCESS;
    return NodeStatus.SUCCESS;
  }
}

/**
 * Action that can be configured to return any status
 */
export class MockAction extends ActionNode {
  private returnStatus: NodeStatus;
  private ticksBeforeComplete: number;
  private currentTicks: number = 0;

  constructor(
    config: NodeConfiguration & {
      returnStatus?: NodeStatus;
      ticksBeforeComplete?: number;
    },
  ) {
    super(config);
    this.returnStatus = config.returnStatus || NodeStatus.SUCCESS;
    this.ticksBeforeComplete = config.ticksBeforeComplete || 1;
  }

  async executeTick(_context: TemporalContext): Promise<NodeStatus> {
    this.currentTicks++;

    if (this.currentTicks < this.ticksBeforeComplete) {
      this.log(
        `Running... (tick ${this.currentTicks}/${this.ticksBeforeComplete})`,
      );
      this._status = NodeStatus.RUNNING;
      return NodeStatus.RUNNING;
    }

    this.log(`Completing with status: ${this.returnStatus}`);
    this.currentTicks = 0;
    this._status = this.returnStatus;
    return this.returnStatus;
  }

  protected onReset(): void {
    this.currentTicks = 0;
  }

  protected onHalt(): void {
    this.currentTicks = 0;
  }
}

/**
 * Condition that checks if a blackboard value meets a criteria
 */
export class CheckCondition extends ConditionNode {
  private key: string;
  private operator: "==" | "!=" | ">" | "<" | ">=" | "<=";
  private value: unknown;

  constructor(
    config: NodeConfiguration & {
      key: string;
      operator?: string;
      value: unknown;
    },
  ) {
    super(config);
    this.key = config.key;
    this.operator =
      (config.operator as "==" | "!=" | ">" | "<" | ">=" | "<=") || "==";
    this.value = config.value;
  }

  async executeTick(context: TemporalContext): Promise<NodeStatus> {
    const actualValue = context.blackboard.get(this.key);
    let result = false;

    switch (this.operator) {
      case "==":
        result = actualValue === this.value;
        break;
      case "!=":
        result = actualValue !== this.value;
        break;
      case ">":
        result = (actualValue as number) > (this.value as number);
        break;
      case "<":
        result = (actualValue as number) < (this.value as number);
        break;
      case ">=":
        result = (actualValue as number) >= (this.value as number);
        break;
      case "<=":
        result = (actualValue as number) <= (this.value as number);
        break;
    }

    this.log(
      `Checking: ${this.key} ${this.operator} ${this.value} => ${actualValue} ${this.operator} ${this.value} = ${result}`,
    );

    this._status = result ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
    return this._status;
  }
}

/**
 * Simple condition that always returns the configured status
 */
export class AlwaysCondition extends ConditionNode {
  private returnStatus: NodeStatus;

  constructor(config: NodeConfiguration & { returnStatus?: NodeStatus }) {
    super(config);
    this.returnStatus = config.returnStatus || NodeStatus.SUCCESS;
  }

  async executeTick(_context: TemporalContext): Promise<NodeStatus> {
    this.log(`Returning ${this.returnStatus}`);
    this._status = this.returnStatus;
    return this.returnStatus;
  }
}

/**
 * Simple test node that always succeeds
 */
export class SuccessNode extends ActionNode {
  async executeTick(_context: TemporalContext): Promise<NodeStatus> {
    this.log("Executing (SUCCESS)");
    this._status = NodeStatus.SUCCESS;
    return NodeStatus.SUCCESS;
  }
}

/**
 * Simple test node that always fails
 */
export class FailureNode extends ActionNode {
  async executeTick(_context: TemporalContext): Promise<NodeStatus> {
    this.log("Executing (FAILURE)");
    this._status = NodeStatus.FAILURE;
    return NodeStatus.FAILURE;
  }
}

/**
 * Simple test node that stays running
 */
export class RunningNode extends ActionNode {
  async executeTick(_context: TemporalContext): Promise<NodeStatus> {
    this.log("Executing (RUNNING)");
    this._status = NodeStatus.RUNNING;
    return NodeStatus.RUNNING;
  }
}
