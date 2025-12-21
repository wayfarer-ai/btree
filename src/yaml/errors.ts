/**
 * YAML parser and validation error types
 */

/**
 * Base class for all YAML validation errors
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public path?: string,
    public suggestion?: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }

  /**
   * Format error message with path and suggestion
   */
  format(): string {
    let formatted = this.message;

    if (this.path) {
      formatted = `${this.path}: ${formatted}`;
    }

    if (this.suggestion) {
      formatted += `\nSuggestion: ${this.suggestion}`;
    }

    return formatted;
  }
}

/**
 * YAML syntax error (Stage 1)
 * Thrown when YAML is malformed
 */
export class YamlSyntaxError extends ValidationError {
  constructor(
    message: string,
    public line?: number,
    public column?: number,
    suggestion?: string,
  ) {
    super(message, undefined, suggestion);
    this.name = "YamlSyntaxError";
  }

  format(): string {
    let formatted = this.message;

    if (this.line !== undefined) {
      formatted = `Line ${this.line}${this.column !== undefined ? `, Column ${this.column}` : ""}: ${formatted}`;
    }

    if (this.suggestion) {
      formatted += `\nSuggestion: ${this.suggestion}`;
    }

    return formatted;
  }
}

/**
 * Tree structure validation error (Stage 2)
 * Thrown when tree definition structure is invalid
 */
export class StructureValidationError extends ValidationError {
  constructor(message: string, path?: string, suggestion?: string) {
    super(message, path, suggestion);
    this.name = "StructureValidationError";
  }
}

/**
 * Node configuration validation error (Stage 3)
 * Thrown when node-specific configuration is invalid
 */
export class ConfigValidationError extends ValidationError {
  constructor(
    message: string,
    public nodeType: string,
    path?: string,
    suggestion?: string,
  ) {
    super(message, path, suggestion);
    this.name = "ConfigValidationError";
  }

  format(): string {
    let formatted = `Invalid configuration for node type '${this.nodeType}'`;

    if (this.path) {
      formatted += ` at ${this.path}`;
    }

    formatted += `:\n${this.message}`;

    if (this.suggestion) {
      formatted += `\nSuggestion: ${this.suggestion}`;
    }

    return formatted;
  }
}

/**
 * Semantic validation error (Stage 4)
 * Thrown when semantic rules are violated (duplicate IDs, circular refs, etc.)
 */
export class SemanticValidationError extends ValidationError {
  constructor(message: string, path?: string, suggestion?: string) {
    super(message, path, suggestion);
    this.name = "SemanticValidationError";
  }
}

/**
 * Collect multiple validation errors
 */
export class ValidationErrors extends Error {
  constructor(public errors: ValidationError[]) {
    super(`Validation failed with ${errors.length} error(s)`);
    this.name = "ValidationErrors";
  }

  /**
   * Format all errors as a single message
   */
  format(): string {
    const header = `YAML validation failed\n\nIssues found:`;
    const issues = this.errors
      .map((error, index) => {
        const formatted = error.format();
        return `  ${index + 1}. ${formatted.split("\n").join("\n     ")}`;
      })
      .join("\n\n");

    return `${header}\n${issues}`;
  }
}
