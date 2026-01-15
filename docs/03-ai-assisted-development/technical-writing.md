# AI-Assisted Technical Writing

> Using AI to produce RFCs, ADRs, API docs, runbooks, and release notes—faster and clearer.

## TL;DR

- AI excels at **structure and first drafts**; you provide accuracy and judgment
- Use templates for consistency: **RFCs, ADRs, runbooks** all have standard formats
- **Spec → checklist → tests** workflow converts designs into actionable items
- Always **verify technical claims**—AI confidently writes plausible but wrong details
- Good docs survive context loss: write for the reader who doesn't know the backstory

## Core Concepts

### Where AI Helps Most

| Writing Task | AI Value | Human Value |
|--------------|----------|-------------|
| Document structure | High | Low |
| First draft prose | High | Medium |
| Technical accuracy | Low | High |
| Completeness | Medium | High |
| Voice/tone | Medium | Medium |
| Decision justification | Low | High |

AI accelerates the mechanical parts. Humans ensure correctness and completeness.

### RFC and Design Document Generation

**Structure prompt:**

```typescript
const rfcPrompt = `
Help me write an RFC for: ${featureSummary}

Use this structure:
# RFC: [Title]
## Status: Draft
## Author: [Name]
## Date: [Date]

## Summary
[1-2 paragraph overview]

## Motivation
- Why do we need this?
- What problem does it solve?
- What's the cost of not doing it?

## Detailed Design
[Technical specification]

## Alternatives Considered
[Other approaches and why they were rejected]

## Migration Strategy
[How to roll out without breaking existing functionality]

## Open Questions
[Unresolved issues needing discussion]

Here's my rough notes:
${roughNotes}
`;
```

**Review checklist:**

After AI generates the draft:
- [ ] Technical claims are accurate
- [ ] All alternatives you considered are listed
- [ ] Trade-offs are honestly represented
- [ ] Migration path is realistic
- [ ] Open questions capture real uncertainties

### Architecture Decision Records (ADRs)

ADRs capture the "why" behind decisions. They're valuable months or years later.

```typescript
const adrPrompt = `
Write an ADR for our decision to use ${technology} for ${purpose}.

Context:
${contextNotes}

Decision we made:
${decision}

Format:
# ADR [Number]: [Title]

## Status
Accepted / Superseded / Deprecated

## Context
What situation led to this decision?

## Decision
What did we decide and why?

## Consequences
### Positive
- What becomes easier?

### Negative
- What becomes harder?
- What risks do we accept?

### Neutral
- What changes without being clearly better or worse?
`;
```

**Example ADR generated with AI:**

```markdown
# ADR 0015: Use PostgreSQL for Primary Database

## Status
Accepted

## Context
We need a primary database for user data, orders, and inventory. The application requires:
- ACID transactions for financial data
- Complex queries across related entities
- Moderate scale (est. 10M rows, 1000 QPS peak)
- Team familiarity with SQL

Evaluated: PostgreSQL, MySQL, MongoDB, DynamoDB.

## Decision
Use PostgreSQL (via Supabase managed service).

Reasons:
- Strong ACID compliance for order transactions
- JSON support for flexible product attributes
- Team has 5+ years PostgreSQL experience
- Supabase provides auth, real-time, and storage integration
- Cost-effective at our scale ($25/mo vs $hundreds for DynamoDB)

## Consequences

### Positive
- Familiar tooling reduces onboarding time
- Single database for relational and semi-structured data
- Built-in connection pooling via Supabase

### Negative
- Vertical scaling limits (practical ceiling ~1TB, 10K QPS)
- Must manage migrations carefully
- Supabase vendor dependency

### Neutral
- Schema changes require migrations (vs schemaless)
- Different from some team members' MongoDB experience
```

### API Documentation

API docs benefit from AI's ability to maintain consistent formatting.

```typescript
const apiDocPrompt = `
Generate API documentation for this endpoint:

${endpointCode}

Format:
## [HTTP Method] [Path]

[One-sentence description]

### Authentication
[Required auth method]

### Request

#### Path Parameters
| Name | Type | Description |
|------|------|-------------|

#### Query Parameters
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|

#### Request Body
\`\`\`typescript
interface RequestBody {
  // typed schema
}
\`\`\`

### Response

#### Success (200)
\`\`\`typescript
interface Response {
  // typed schema
}
\`\`\`

#### Errors
| Status | Code | Description |
|--------|------|-------------|

### Example
\`\`\`bash
curl -X POST ...
\`\`\`
`;
```

### Runbook Generation

Runbooks document operational procedures. AI helps structure; you verify accuracy.

```typescript
const runbookPrompt = `
Create a runbook for: ${incidentType}

Include:
# Runbook: [Incident Type]

## Overview
What is this incident? How is it typically detected?

## Severity Assessment
How to determine severity level.

## Immediate Actions
First 5 minutes checklist.

## Diagnosis Steps
1. [Step with specific commands]
2. [Step with expected output]

## Resolution Steps
For each common root cause:
### Root Cause A
1. [Resolution steps]
2. [Verification]

## Escalation
When and how to escalate.

## Post-Incident
- Data to collect
- Follow-up actions

Context about our system:
${systemContext}
`;
```

**Example runbook section:**

```markdown
## Diagnosis Steps

### 1. Check Service Health
\`\`\`bash
kubectl get pods -n production -l app=api-server
\`\`\`
Expected: All pods Running, no restarts in last hour

### 2. Check Recent Deployments
\`\`\`bash
kubectl rollout history deployment/api-server -n production
\`\`\`
If recent deployment: Consider rollback (see Resolution Step 3)

### 3. Check Database Connectivity
\`\`\`bash
kubectl exec -it deploy/api-server -n production -- \
  psql $DATABASE_URL -c "SELECT 1"
\`\`\`
Expected: Returns "1". If timeout: escalate to DBA.
```

### Release Notes

Convert commit history and tickets into user-facing release notes.

```typescript
const releaseNotesPrompt = `
Generate release notes from these changes:

Commits:
${commitLog}

Related tickets:
${ticketSummaries}

Format for our changelog:
## [Version] - [Date]

### Added
- [New features, user-visible]

### Changed
- [Changes to existing features]

### Fixed
- [Bug fixes]

### Security
- [Security-related changes]

### Internal
- [Changes not user-visible, for team reference]

Audience: Technical users who integrate our API.
Tone: Professional, concise.
Avoid: Implementation details unless relevant to users.
`;
```

## In Practice

### Spec → Checklist → Tests Workflow

Convert design documents into actionable verification.

**Step 1: Extract requirements**

```typescript
const extractPrompt = `
From this design document, extract a checklist of testable requirements.

Document:
${designDoc}

Format each as:
- [ ] [Specific, testable requirement]
  - Acceptance: [How to verify]
  - Priority: [Must/Should/Could]
`;
```

**Step 2: Generate test scenarios**

```typescript
const testScenariosPrompt = `
For each requirement, generate test scenarios:

Requirements:
${checklist}

Format:
### Requirement: [Requirement text]

#### Happy Path
- Given: [setup]
- When: [action]
- Then: [expected result]

#### Edge Cases
- [Edge case 1]
- [Edge case 2]

#### Error Cases
- [Error case 1]
- [Error case 2]
`;
```

**Step 3: Track implementation**

```markdown
## Implementation Checklist

### Must Have
- [x] User can request password reset
  - Tests: `password-reset.test.ts#L15-45`
- [ ] Reset token expires after 1 hour
  - Tests: `password-reset.test.ts#L47-62`
- [ ] Invalid token shows error message
  - Tests: pending

### Should Have
- [ ] Rate limit reset requests per email
  - Tests: not started
```

### Documentation Review Prompt

```typescript
const docReviewPrompt = `
Review this documentation for issues:

${documentation}

Check for:
1. Accuracy: Do code examples work? Are claims verifiable?
2. Completeness: Are edge cases documented? Error conditions?
3. Clarity: Would a new developer understand this?
4. Currency: Is this up-to-date with current implementation?
5. Actionability: Can reader accomplish their goal with this info?

For each issue, quote the problematic text and suggest a fix.
`;
```

### Writing Documentation for AI Tools

When AI tools need to understand your codebase, well-structured documentation helps significantly. Write documentation that's easy for AI to parse and reference.

**Key principles:**
- **Explicit parameter tables** instead of prose descriptions
- **Concrete examples** with realistic values
- **Error conditions** listed explicitly
- **"Do NOT" sections** for common mistakes
- **Stable headings** for retrieval

**Example: Function documentation**

```markdown
# createUser(data: UserInput): Promise<User>

Creates a new user account.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data.email | string | Yes | Valid email address |
| data.password | string | Yes | Min 8 characters |
| data.name | string | No | Display name |

## Returns

A `User` object with `id`, `email`, `name`, `createdAt`.

## Errors

- `ValidationError`: Invalid email or password too short
- `ConflictError`: Email already registered

## Example

\`\`\`typescript
const user = await createUser({
  email: 'test@example.com',
  password: 'securepassword123',
  name: 'Test User',
});
// Returns: { id: '123', email: 'test@example.com', ... }
\`\`\`

## Do NOT

- Call without email validation
- Store plain text passwords (handled internally)
- Call in loops without rate limiting
```

This format makes it easy for AI tools to extract:
- Function signatures and parameters
- Expected behavior and return values
- Error conditions
- Usage patterns

## Common Pitfalls

- **AI confabulates details.** Verify all technical claims, commands, and examples.
- **Copy-paste without adaptation.** AI doesn't know your specific context.
- **Over-documentation.** Not everything needs docs. Focus on decision rationale and how-to.
- **Stale docs.** Docs generated today are wrong tomorrow. Build update habits.

## Related

- [Day-to-Day Workflows](./day-to-day-workflows.md) — Spec-driven development
- [Code Review and Governance](./code-review-governance.md) — Documentation standards
- [LLM Mechanics](../01-core-concepts/llm-mechanics.md) — How models process text
