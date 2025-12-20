# YAML Workflow Specification

This document defines the YAML format for workflow definitions.

---

## Overview

Workflows are stored in YAML format with the following benefits:

- **Human-readable** - Easy to read, write, and review
- **AI-friendly** - LLMs can generate and modify YAML easily
- **Version controllable** - Works great with Git
- **Portable** - Can be shared, imported, exported
- **Validatable** - Schema-based validation

---

## File Structure

```yaml
version: "1.0"                   # Schema version
name: string                     # Workflow name (required)
description: string              # Workflow description
author: string                   # Author name/email
tags: [string]                   # Tags for categorization
createdAt: ISO8601               # Creation timestamp
updatedAt: ISO8601               # Last update timestamp

trigger:                         # How workflow is triggered
  type: string                   # Trigger type
  config: object                 # Trigger-specific config

settings:                        # Runtime settings
  errorHandling: string          # Error handling strategy
  saveExecutionProgress: boolean # Save state for resume
  timeout: number                # Max execution time (ms)
  concurrency: number            # Max concurrent executions

viewport:                        # Visual builder viewport
  x: number
  y: number
  zoom: number

inputSchema:                     # Input validation schema
  type: "object"
  properties: object

outputSchema:                    # Output schema
  type: "object"
  properties: object

nodes: [NodeDefinition]          # Node definitions (required)
edges: [EdgeDefinition]          # Connections between nodes
```

---

## Node Definition

```yaml
id: string                       # Unique node ID (required)
type: string                     # Node type (required)
name: string                     # Display name (required)
description: string              # Node description
position:                        # Position in visual builder
  x: number
  y: number
color: string                    # Node color (hex)
icon: string                     # Icon name
config:                          # Node-specific configuration
  [key: string]: any
temporal:                        # Temporal execution hints (optional)
  timeout: string                # Activity timeout (e.g., "30s", "5m")
  retryAttempts: number          # Max retry attempts
  retryBackoff: string           # Retry backoff (e.g., "1s", "5s")
  executeAs: string              # Force execution mode: "workflow" | "activity"
```

---

## Edge Definition

```yaml
source: string                   # Source node ID (required)
target: string                   # Target node ID (required)
sourceHandle: string             # Output handle ID
targetHandle: string             # Input handle ID
label: string                    # Edge label
```

---

## Complete Example

```yaml
version: "1.0"
name: "User Registration Flow"
description: "Handle new user registrations with email verification"
author: "engineering@company.com"
tags: ["user-management", "email", "onboarding"]
createdAt: "2025-01-15T10:00:00Z"
updatedAt: "2025-01-15T14:30:00Z"

# Trigger configuration
trigger:
  type: webhook
  config:
    path: /webhooks/register
    method: POST
    authentication:
      type: bearer
      headerName: X-API-Key

# Runtime settings
settings:
  errorHandling: stop           # stop | continue
  saveExecutionProgress: true
  timeout: 300000               # 5 minutes
  concurrency: 10

# Visual builder state
viewport:
  x: 0
  y: 0
  zoom: 1

# Input schema
inputSchema:
  type: object
  properties:
    email:
      type: string
      description: User email address
      required: true
    name:
      type: string
      description: User full name
      required: true
    company:
      type: string
      description: Company name

# Output schema
outputSchema:
  type: object
  properties:
    userId:
      type: string
      description: Created user ID
    status:
      type: string
      description: Registration status

# Node definitions
nodes:
  # Main flow control
  - id: main-sequence
    type: Sequence
    name: Main Registration Flow
    description: Executes all registration steps in order
    position: { x: 100, y: 100 }
    
  # Validate input
  - id: validate-input
    type: Script
    name: Validate Input
    description: Check if required fields are present
    position: { x: 300, y: 100 }
    config:
      textContent: |
        # Get inputs
        email = input("email")
        name = input("name")
        
        # Validate
        hasEmail = email != null && email != ""
        hasName = name != null && name != ""
        isValid = hasEmail && hasName
        
        # Set validation result
        output("isValid", isValid)
        
  # Conditional check
  - id: check-validation
    type: Conditional
    name: Check Validation
    description: Proceed only if validation passed
    position: { x: 500, y: 100 }
    config:
      condition: isValid
      
  # Create user in database
  - id: create-user
    type: HttpRequest
    name: Create User
    description: Create user record in database
    position: { x: 700, y: 100 }
    color: "#4CAF50"
    icon: "database"
    config:
      url: "{{env.API_BASE_URL}}/api/users"
      method: POST
      headers:
        Authorization: "Bearer {{env.API_TOKEN}}"
        Content-Type: "application/json"
      body:
        email: "{{email}}"
        name: "{{name}}"
        company: "{{company}}"
      responseKey: userResponse
      statusCodeKey: createUserStatus
    temporal:
      timeout: "30s"           # 30 second timeout
      retryAttempts: 5         # Retry up to 5 times
      retryBackoff: "2s"       # Start with 2s backoff
      
  # Extract user ID
  - id: extract-user-id
    type: Script
    name: Extract User ID
    description: Get user ID from API response
    position: { x: 900, y: 100 }
    config:
      textContent: |
        response = input("userResponse")
        userId = response.id
        output("userId", userId)
        
  # Parallel notifications
  - id: send-notifications
    type: Parallel
    name: Send Notifications
    description: Send welcome email and admin notification
    position: { x: 1100, y: 100 }
    config:
      strategy: any              # Success if any child succeeds
      
  # Welcome email
  - id: send-welcome-email
    type: EmailSend
    name: Send Welcome Email
    description: Send welcome email to new user
    position: { x: 1100, y: 200 }
    color: "#2196F3"
    icon: "mail"
    config:
      provider: sendgrid
      apiKey: "{{env.SENDGRID_API_KEY}}"
      from:
        email: "welcome@company.com"
        name: "Company Team"
      to: "{{email}}"
      subject: "Welcome to Company!"
      templateId: "welcome-v1"
      dynamicData:
        name: "{{name}}"
        companyUrl: "{{env.COMPANY_URL}}"
        
  # Admin notification
  - id: notify-admin
    type: SlackMessage
    name: Notify Admin
    description: Post new user notification to Slack
    position: { x: 1100, y: 300 }
    color: "#4A154B"
    icon: "slack"
    config:
      token: "{{env.SLACK_BOT_TOKEN}}"
      channel: "#new-users"
      message: |
        🎉 New user registered!
        
        **Name:** {{name}}
        **Email:** {{email}}
        **Company:** {{company}}
        **User ID:** {{userId}}
      
  # Set final output
  - id: set-output
    type: Script
    name: Set Workflow Output
    description: Prepare workflow output
    position: { x: 1300, y: 100 }
    config:
      textContent: |
        output("userId", userId)
        output("status", "completed")
        output("message", "User registered successfully")

# Edge definitions (connections)
edges:
  - source: main-sequence
    target: validate-input
    
  - source: main-sequence
    target: check-validation
    
  - source: main-sequence
    target: create-user
    
  - source: main-sequence
    target: extract-user-id
    
  - source: main-sequence
    target: send-notifications
    
  - source: main-sequence
    target: set-output
    
  - source: send-notifications
    target: send-welcome-email
    
  - source: send-notifications
    target: notify-admin
```

---

## Node Types Reference

### Control Flow Nodes

#### Sequence
Executes children in order until one fails or all succeed.

```yaml
- id: my-sequence
  type: Sequence
  name: Step by Step
```

#### Selector
Tries children until one succeeds.

```yaml
- id: my-selector
  type: Selector
  name: Try Multiple Options
```

#### Parallel
Executes children concurrently.

```yaml
- id: my-parallel
  type: Parallel
  name: Run in Parallel
  config:
    strategy: strict      # strict | any
    successThreshold: 2   # Optional: number that must succeed
    failureThreshold: 1   # Optional: number that must fail
```

#### Conditional
If-then-else logic.

```yaml
- id: my-condition
  type: Conditional
  name: If Valid
  config:
    condition: isValid    # Blackboard variable to check
```

#### ForEach
Iterate over a collection.

```yaml
- id: my-loop
  type: ForEach
  name: Process Each User
  config:
    collection: users     # Array from blackboard
    itemKey: currentUser  # Key for current item
```

#### While
Loop while condition is true.

```yaml
- id: my-while
  type: While
  name: While Has Items
  config:
    condition: hasMore
    maxIterations: 100    # Safety limit
```

#### Recovery
Try-catch-finally pattern.

```yaml
- id: my-recovery
  type: Recovery
  name: Try with Recovery
```

### Decorator Nodes

#### Retry
Retry on failure.

```yaml
- id: my-retry
  type: Retry
  name: Retry Failed Requests
  config:
    maxAttempts: 3
    delayMs: 1000
    backoff: exponential  # linear | exponential
```

#### Timeout
Set time limit.

```yaml
- id: my-timeout
  type: Timeout
  name: 30 Second Timeout
  config:
    timeoutMs: 30000
```

#### Delay
Add delay before execution.

```yaml
- id: my-delay
  type: Delay
  name: Wait 1 Second
  config:
    delayMs: 1000
```

#### Repeat
Execute N times.

```yaml
- id: my-repeat
  type: Repeat
  name: Repeat 5 Times
  config:
    count: 5
```

#### Invert
Flip SUCCESS ↔ FAILURE.

```yaml
- id: my-invert
  type: Invert
  name: Negate Result
```

#### ForceSuccess / ForceFailure
Override result.

```yaml
- id: my-force
  type: ForceSuccess
  name: Always Succeed
```

#### RunOnce
Execute only once.

```yaml
- id: my-once
  type: RunOnce
  name: Initialize Once
```

### Action Nodes

#### Script
Execute script to manipulate data.

```yaml
- id: my-script
  type: Script
  name: Calculate Total
  config:
    textContent: |
      # Get inputs
      price = input("price")
      quantity = input("quantity")
      
      # Calculate
      subtotal = price * quantity
      tax = subtotal * 0.1
      total = subtotal + tax
      
      # Set outputs
      output("subtotal", subtotal)
      output("tax", tax)
      output("total", total)
```

#### HttpRequest
Make HTTP/REST API calls.

```yaml
- id: my-request
  type: HttpRequest
  name: Fetch User Data
  config:
    url: "{{env.API_URL}}/users/{{userId}}"
    method: GET
    headers:
      Authorization: "Bearer {{env.API_TOKEN}}"
    timeout: 5000
    responseKey: userData
    statusCodeKey: httpStatus
```

#### EmailSend
Send emails.

```yaml
- id: my-email
  type: EmailSend
  name: Send Welcome Email
  config:
    provider: sendgrid
    apiKey: "{{env.SENDGRID_API_KEY}}"
    from:
      email: "noreply@company.com"
      name: "Company"
    to: "{{email}}"
    subject: "Welcome!"
    templateId: "welcome-v1"
    dynamicData:
      name: "{{name}}"
```

#### SlackMessage
Send Slack messages.

```yaml
- id: my-slack
  type: SlackMessage
  name: Notify Team
  config:
    token: "{{env.SLACK_BOT_TOKEN}}"
    channel: "#general"
    message: "New user: {{name}}"
```

#### JsonPath
Extract data using JSONPath.

```yaml
- id: my-extract
  type: JsonPath
  name: Extract User Names
  config:
    input: apiResponse
    path: "$.users[*].name"
    output: userNames
```

#### Template
Render templates with Handlebars.

```yaml
- id: my-template
  type: Template
  name: Build Email Body
  config:
    template: |
      Hello {{name}},
      
      Welcome to {{company}}!
      
      Your user ID is: {{userId}}
    output: emailBody
```

---

## Template Variables

Templates support `{{variable}}` syntax for dynamic values:

### Blackboard Variables
```yaml
url: "https://api.example.com/users/{{userId}}"
message: "Hello {{name}}!"
```

### Environment Variables
```yaml
token: "{{env.API_TOKEN}}"
baseUrl: "{{env.BASE_URL}}"
```

### Input Function (in Script nodes)
```yaml
textContent: |
  userId = input("userId")
  name = input("name")
```

### Output Function (in Script nodes)
```yaml
textContent: |
  output("result", calculatedValue)
  output("status", "completed")
```

---

## Validation Rules

### Required Fields
- `version` - Must be present
- `name` - Workflow name
- `nodes` - At least one node
- Each node must have: `id`, `type`, `name`

### Unique Constraints
- Node IDs must be unique within a workflow
- Edge cannot connect a node to itself (no cycles in decorators)

### Edge Validation
- Source and target nodes must exist
- Edges must form a valid tree structure
- No circular dependencies (except in While/ForEach)

### Type Checking
- Node types must be registered in the Registry
- Configuration must match node's expected schema

---

## Schema Validation

Use JSON Schema for validation:

```typescript
import Ajv from 'ajv';
import workflowSchema from './workflow-schema.json';

const ajv = new Ajv();
const validate = ajv.compile(workflowSchema);

const isValid = validate(yamlData);
if (!isValid) {
  console.error(validate.errors);
}
```

---

## Best Practices

### 1. Use Descriptive Names
```yaml
# Good
- id: validate-user-email
  name: Validate User Email Format
  
# Bad
- id: node1
  name: Validation
```

### 2. Add Descriptions
```yaml
- id: send-welcome-email
  name: Send Welcome Email
  description: Sends a personalized welcome email using the SendGrid template
```

### 3. Use Environment Variables for Secrets
```yaml
# Good
config:
  apiKey: "{{env.SENDGRID_API_KEY}}"
  
# Bad
config:
  apiKey: "SG.hardcoded_key_here"
```

### 4. Group Related Operations
```yaml
- id: notifications
  type: Parallel
  name: Send All Notifications
  # Children: welcome-email, admin-slack, analytics-event
```

### 5. Handle Errors Gracefully
```yaml
- id: api-with-retry
  type: Retry
  name: API Call with Retry
  config:
    maxAttempts: 3
    delayMs: 1000
  # Child: http-request node
```

### 6. Use Tags for Organization
```yaml
tags: ["production", "critical", "user-facing"]
```

### 7. Version Your Workflows
```yaml
version: "1.0"
name: "User Registration v2"
```

---

## Migration Guide

### From JSON to YAML

JSON:
```json
{
  "version": "1.0",
  "name": "My Workflow",
  "nodes": [
    {
      "id": "node1",
      "type": "HttpRequest",
      "config": {
        "url": "https://api.example.com"
      }
    }
  ]
}
```

YAML:
```yaml
version: "1.0"
name: My Workflow
nodes:
  - id: node1
    type: HttpRequest
    config:
      url: https://api.example.com
```

### From Visual Builder to YAML

The visual builder will provide an "Export to YAML" button that:
1. Serializes the current workflow
2. Formats it as YAML
3. Downloads as `.yaml` file
4. Can be imported back into any builder instance

---

## File Naming Convention

```
workflows/
├── user-registration.yaml
├── order-processing.yaml
├── scheduled/
│   ├── daily-report.yaml
│   └── weekly-cleanup.yaml
└── webhooks/
    ├── github-push.yaml
    └── stripe-payment.yaml
```

Use kebab-case, descriptive names, and organize by trigger type or domain.
