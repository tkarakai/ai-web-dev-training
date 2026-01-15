# Code Review and Governance Practices

> Team standards for AI-assisted development—making quality repeatable, not heroic.

## TL;DR

- **Rubric-driven prompts** make review systematic: security, correctness, performance, maintainability
- Define **standards for AI-generated code**: same quality bar as human code
- Share **prompt packs and templates** as team assets
- Use **AGENTS.md** as the repo-level source of truth for AI agent behavior
- Good governance makes consistent quality **automatic, not effortful**

## Core Concepts

### Rubric-Driven Code Review

Structure AI-assisted reviews around explicit criteria.

**Review rubric template:**

```typescript
const reviewRubric = {
  security: [
    'Input validation on all external data',
    'No SQL injection vectors',
    'No XSS vulnerabilities',
    'Secrets not hardcoded',
    'Auth/authz checks in place',
  ],
  correctness: [
    'Logic matches requirements',
    'Edge cases handled',
    'Error conditions covered',
    'Types are accurate',
    'Tests verify behavior',
  ],
  performance: [
    'No N+1 queries',
    'Appropriate indexing',
    'No blocking operations in hot paths',
    'Memory usage reasonable',
  ],
  maintainability: [
    'Clear naming',
    'Single responsibility',
    'Appropriate abstraction level',
    'Documentation where needed',
  ],
};
```

**Review prompt:**

```typescript
const reviewPrompt = `
Review this code change against our standards:

${diffContent}

Evaluate each category (PASS/CONCERN/FAIL):

## Security
${reviewRubric.security.map(item => `- [ ] ${item}`).join('\n')}

## Correctness
${reviewRubric.correctness.map(item => `- [ ] ${item}`).join('\n')}

## Performance
${reviewRubric.performance.map(item => `- [ ] ${item}`).join('\n')}

## Maintainability
${reviewRubric.maintainability.map(item => `- [ ] ${item}`).join('\n')}

For any CONCERN or FAIL, provide:
- Line reference
- Issue description
- Suggested fix
`;
```

### Standards for AI-Generated Code

AI-generated code should meet the same bar as human code. Define explicitly:

**Acceptance criteria:**

```markdown
## AI-Generated Code Standards

### Before Merging
- [ ] Code has been read and understood (not just accepted)
- [ ] All tests pass, including new tests for new functionality
- [ ] Security review for auth, input handling, data access
- [ ] Performance acceptable for the use case
- [ ] Follows existing patterns in the codebase

### Documentation
- [ ] PR description notes AI assistance
- [ ] Complex logic has explanatory comments
- [ ] Any deviations from standards are justified

### Prohibited
- [ ] No blindly accepted suggestions
- [ ] No generated code in security-critical paths without senior review
- [ ] No new dependencies without evaluation
```

**PR template for AI-assisted work:**

```markdown
## Description
[What this PR does]

## AI Assistance
- [ ] Used AI assistance for this PR
- Tool(s) used: [e.g., Claude Code, Copilot]
- What AI helped with: [e.g., implementation, tests, refactoring]

## Verification
- [ ] I have read and understand all generated code
- [ ] Tests cover the new/changed functionality
- [ ] Security implications considered
- [ ] Performance acceptable

## Testing
[How this was tested]

## Screenshots (if applicable)
```

### Prompt Packs and Templates

Standardize common prompts as team assets.

**Prompt pack structure:**

```
prompts/
├── review/
│   ├── security-review.md
│   ├── performance-review.md
│   └── general-review.md
├── generation/
│   ├── service-scaffold.md
│   ├── api-endpoint.md
│   └── test-suite.md
├── refactoring/
│   ├── extract-function.md
│   └── migrate-pattern.md
└── README.md
```

**Example prompt template:**

```markdown
<!-- prompts/generation/api-endpoint.md -->
# API Endpoint Generation

## Usage
Generate a new API endpoint following our patterns.

## Variables
- `ENDPOINT_NAME`: Name of the endpoint (e.g., createUser)
- `HTTP_METHOD`: GET, POST, PUT, DELETE
- `RESOURCE`: Resource being operated on

## Prompt

Generate an API endpoint for ${ENDPOINT_NAME}.

Requirements:
- HTTP method: ${HTTP_METHOD}
- Resource: ${RESOURCE}
- Follow patterns in src/api/routes/

Include:
1. Route handler with validation
2. Service method call
3. Error handling
4. Response formatting
5. JSDoc comments

Use these existing files as reference:
- src/api/routes/users.ts
- src/services/user.service.ts
- src/api/middleware/validate.ts

## Checklist
After generation:
- [ ] Validate input schema defined
- [ ] Error codes match our standard set
- [ ] Response type is documented
- [ ] Route registered in src/api/index.ts
```

### Agent Steering via AGENTS.md

AGENTS.md is becoming the de facto standard for configuring AI agent behavior at the repo level.

**AGENTS.md structure:**

```markdown
# AGENTS.md

This file configures AI agent behavior for this repository.

## Repository Overview

### Architecture
- Monorepo with packages in `packages/`
- API server in `packages/api`
- Web client in `packages/web`
- Shared types in `packages/shared`

### Tech Stack
- TypeScript (strict mode)
- Node.js 20 LTS
- PostgreSQL via Prisma
- React 19 with Next.js 15
- Vitest for testing

## Build and Test Commands

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @app/api test

# Build all packages
pnpm build

# Type check
pnpm typecheck
```

## Code Style

### TypeScript
- Strict mode enabled
- Explicit return types on exported functions
- Prefer `interface` over `type` for object shapes
- Use `Result<T, E>` pattern (neverthrow) for fallible operations

### Naming
- Files: kebab-case (user-service.ts)
- Classes: PascalCase
- Functions/variables: camelCase
- Constants: SCREAMING_SNAKE_CASE

### Patterns
- Repository pattern for data access
- Service layer for business logic
- Controller layer for HTTP handling
- Dependency injection via constructor

## Safe and Danger Zones

### Safe for AI Changes
- `packages/api/src/services/` - Business logic
- `packages/web/src/components/` - UI components
- `packages/*/tests/` - Test files
- Documentation files

### Require Human Review
- `packages/api/src/auth/` - Authentication
- `packages/api/src/middleware/` - Security middleware
- Database migrations
- CI/CD configuration
- Package.json dependencies

### Do Not Modify
- `.env*` files
- `packages/api/src/crypto/` - Cryptographic operations
- Production deployment configs

## Review Checklist

Before committing AI-generated changes:
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] No new dependencies without discussion
- [ ] Security-sensitive areas reviewed by human
- [ ] Changes match requested scope (no over-engineering)

## Common Tasks

### Adding a new API endpoint
1. Add route in `packages/api/src/routes/`
2. Add service method in `packages/api/src/services/`
3. Add validation schema in `packages/api/src/schemas/`
4. Add tests in `packages/api/tests/`
5. Update OpenAPI spec if applicable

### Adding a new React component
1. Create component in `packages/web/src/components/`
2. Add Storybook story
3. Add unit tests
4. Export from index.ts
```

### Tool-Specific Configuration

Different tools may use different config files. Use shims to redirect to AGENTS.md:

```markdown
<!-- .claude.md -->
# Claude Configuration

See [AGENTS.md](./AGENTS.md) for repository configuration.

## Claude-Specific Notes
- Use `pnpm` not `npm` for all package operations
- Prefer reading existing code before generating new code
```

```markdown
<!-- .cursorrules -->
# Cursor Rules

See AGENTS.md for full repository configuration.

Key points:
- TypeScript strict mode
- Use neverthrow Result pattern
- Follow existing patterns in similar files
```

## In Practice

### Governance Workflow

```typescript
// Team-level AI governance
const aiGovernance = {
  // Who can use AI tools
  access: {
    ideaCopilots: 'all-engineers',
    cliAgents: 'all-engineers',
    customIntegrations: 'requires-approval',
  },

  // What requires extra review
  escalation: {
    securityCode: 'senior-engineer-review',
    databaseChanges: 'dba-review',
    publicApiChanges: 'api-owner-review',
    newDependencies: 'tech-lead-approval',
  },

  // Shared resources
  resources: {
    promptTemplates: './prompts/',
    agentsConfig: './AGENTS.md',
    reviewRubrics: './docs/review-standards.md',
  },
};
```

### Onboarding New Team Members

```markdown
## AI Tools Onboarding

### Day 1: Setup
1. Install approved IDE and extensions (see tools list)
2. Configure local environment per AGENTS.md
3. Review prompt templates in `./prompts/`

### Day 2: Guided Practice
1. Pair with experienced team member on AI-assisted task
2. Practice prompt iteration and review
3. Complete security-focused review exercise

### Week 1: Independent Use
1. Use AI for assigned tasks
2. Flag generated code in PRs
3. Get feedback on AI usage in code reviews

### Ongoing
- Share effective prompts with team
- Contribute to prompt templates
- Report issues or concerns
```

## Common Pitfalls

- **Inconsistent standards.** Without explicit rules, everyone does their own thing.
- **No shared prompts.** Teams reinvent prompts constantly.
- **AGENTS.md drift.** File gets stale; update it when practices change.
- **Review theater.** Checking boxes without actually reviewing.

## Related

- [Operational Guardrails](../02-governance/operational-guardrails.md) — Data and policy constraints
- [Testing and Quality](./testing-quality.md) — Verifying generated code
- [Tooling Ecosystem](./tooling-ecosystem.md) — Tool configuration
