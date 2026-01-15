# Day-to-Day Workflows

> Practical patterns for using AI in scaffolding, refactoring, debugging, and development.

## TL;DR

- **Scaffolding**: Provide architectural constraints upfront; AI follows existing patterns better
- **Refactoring**: Slice into small, testable changes; checkpoint frequently
- **Debugging**: Start with minimal repro; use hypothesis-driven loops
- **Vibe coding**: Useful for first 70%, risky for last 30%—graduate to specs
- **Spec-driven development (SDD)**: Define acceptance criteria before generating code

## Core Concepts

### Scaffolding with Constraints

AI generates better code when it knows your constraints upfront.

**Provide architecture context:**

```typescript
// Bad: No context
"Create a user service"

// Good: With constraints
`Create a user service that:
- Uses our repository pattern (see src/repositories/base.ts)
- Returns Result<T, Error> types (we use neverthrow)
- Follows existing service structure in src/services/
- Uses Prisma for database access
- Includes JSDoc comments matching our style

Here's an example service for reference:
${exampleService}
`
```

**Include relevant files:**

```typescript
// Let AI see your patterns
const context = [
  { path: 'src/types/result.ts', content: resultTypes },
  { path: 'src/services/auth.service.ts', content: authService },
  { path: 'src/repositories/base.ts', content: baseRepo },
];
```

### Refactoring at Scale

Large refactors fail when attempted all at once. Slice them.

**Slicing strategy:**

```typescript
// Instead of: "Migrate all components to the new design system"

// Slice by:
// 1. Component type (buttons first, then forms, then layouts)
// 2. Risk level (internal tools first, then user-facing)
// 3. Dependency order (leaf components first, then containers)

const refactorPlan = [
  { slice: 'Button components', files: ['Button.tsx', 'IconButton.tsx'], risk: 'low' },
  { slice: 'Form inputs', files: ['Input.tsx', 'Select.tsx'], risk: 'medium' },
  { slice: 'Layout components', files: ['Header.tsx', 'Sidebar.tsx'], risk: 'high' },
];
```

**Safe checkpoints:**

```bash
# After each slice:
git add -A && git commit -m "refactor(ui): migrate Button to design system"

# Run tests before moving on:
npm test -- --related src/components/Button

# If tests fail, fix before continuing
```

**AI-assisted refactoring prompt:**

```typescript
const refactorPrompt = `
Refactor this component to use our new design system.

Current component:
${currentComponent}

Design system patterns to use:
${designSystemExamples}

Requirements:
- Maintain all existing props and behavior
- Use design system tokens for colors, spacing
- Keep the same test coverage
- Add a brief comment noting the migration

Do NOT:
- Change the component's public API
- Add new features
- Modify tests (we'll verify they still pass)
`;
```

### Debugging Workflows

AI accelerates debugging when used systematically.

**Step 1: Create minimal reproduction**

```typescript
// Bad: "My app is broken, here's 500 lines of code"

// Good: Isolate the problem
const minimalRepro = `
This test fails:
\`\`\`typescript
test('user creation fails with duplicate email', async () => {
  await createUser({ email: 'test@example.com' });
  // This should throw ConflictError but throws ValidationError
  await expect(createUser({ email: 'test@example.com' }))
    .rejects.toThrow(ConflictError);
});
\`\`\`

Relevant code:
\`\`\`typescript
${createUserFunction}
\`\`\`
`;
```

**Step 2: Hypothesis loop**

```typescript
// Structure your debugging conversation
const debuggingPrompt = `
Bug: User creation throws ValidationError instead of ConflictError

Hypothesis 1: Email uniqueness check happens after validation
Evidence needed: Order of operations in createUser

${codeContext}

What's the most likely cause? What evidence would confirm or deny?
`;

// After AI response, test the hypothesis
// Then iterate with results
```

**Step 3: Targeted instrumentation**

```typescript
// Ask AI to add strategic logging
const instrumentPrompt = `
Add logging to trace the flow through createUser:
- Log entry with input parameters (sanitized)
- Log each validation step result
- Log database query before execution
- Log the exact error that's thrown

Keep logs structured for easy parsing:
console.log(JSON.stringify({ step: 'validation', result, timestamp }));
`;
```

### Reading Unfamiliar Codebases

AI excels at explaining existing code.

**Architecture extraction:**

```typescript
const archPrompt = `
Analyze this codebase structure and explain:
1. Overall architecture pattern (MVC, hexagonal, etc.)
2. Key directories and their purposes
3. Data flow for a typical request
4. Main external dependencies and their roles

Directory structure:
${directoryTree}

Key files:
${keyFileContents}
`;
```

**Dependency mapping:**

```typescript
const depPrompt = `
For the UserService class:
1. What does it depend on? (constructor injection, imports)
2. What depends on it? (who calls these methods)
3. Draw the dependency graph as a mermaid diagram

${userServiceCode}
${relatedImports}
`;
```

### Migration Assistance

Framework upgrades, API versioning, database migrations.

**Migration prompt pattern:**

```typescript
const migrationPrompt = `
Migrate this code from React Router v5 to v6.

Before (v5):
\`\`\`typescript
${v5Code}
\`\`\`

Key v6 changes to apply:
- Switch → Routes
- useHistory → useNavigate
- <Route component={X}> → <Route element={<X />}>
- Exact is default

Generate the migrated code and list any manual steps needed.
`;
```

## Vibe Coding

"Vibe coding" means generating code quickly without detailed specs—useful for exploration but risky for production.

### When Vibe Coding Works

- **Prototyping**: Exploring solution space quickly
- **Internal tools**: Lower quality bar
- **Learning**: Understanding how something might work
- **First drafts**: Getting 70% done fast

### When Vibe Coding Fails

- **Last 30%**: Edge cases, error handling, security
- **Unclear requirements**: AI will guess wrong
- **Production code**: Quality matters
- **Unfamiliar domains**: You can't review what you don't understand

### The 70/30 Rule

Vibe coding often produces code that's ~70% correct:
- Happy path works
- Basic structure is right
- Looks plausible

The remaining 30% contains:
- Edge case bugs
- Security issues
- Performance problems
- Incorrect assumptions

```typescript
// Vibe coded: Works for happy path
async function getUser(id: string) {
  const user = await db.user.findUnique({ where: { id } });
  return user;
}

// Production-ready: Handles the 30%
async function getUser(id: string): Promise<Result<User, UserError>> {
  if (!isValidUUID(id)) {
    return err(new UserError('INVALID_ID', 'User ID must be a valid UUID'));
  }

  try {
    const user = await db.user.findUnique({ where: { id } });

    if (!user) {
      return err(new UserError('NOT_FOUND', `User ${id} not found`));
    }

    return ok(user);
  } catch (error) {
    logger.error('Database error fetching user', { id, error });
    return err(new UserError('DATABASE_ERROR', 'Failed to fetch user'));
  }
}
```

### Graduating from Vibe Coding

When you need production quality:

1. **Write a spec**: Define exactly what you need
2. **Create checkpoints**: Break into verifiable chunks
3. **Add tests first**: Know what success looks like
4. **Review thoroughly**: Don't just accept

## Spec-Driven Development (SDD)

SDD inverts the vibe coding approach: define acceptance criteria before generating code.

### The SDD Process

```
1. Define acceptance criteria
2. Freeze constraints (APIs, invariants, performance)
3. Break into tasks
4. Generate code per task
5. Verify against criteria
6. Checkpoint and iterate
```

### Writing Effective Specs

```markdown
# Feature: User Email Verification

## Acceptance Criteria
- [ ] Users receive verification email within 30 seconds of registration
- [ ] Verification links expire after 24 hours
- [ ] Clicking valid link marks user as verified
- [ ] Clicking expired link shows appropriate error
- [ ] Users cannot verify twice
- [ ] Verification status reflected in user profile

## Constraints
- Use existing EmailService (src/services/email.service.ts)
- Tokens stored in Redis with TTL
- No external dependencies beyond what's already in package.json

## API Contract
POST /auth/verify
Body: { "token": "string" }
Response 200: { "verified": true }
Response 400: { "error": "TOKEN_EXPIRED" | "ALREADY_VERIFIED" | "INVALID_TOKEN" }

## Test Cases
1. Happy path: register → receive email → click link → verified
2. Expired token: wait 24h → click link → error
3. Invalid token: random string → error
4. Double verification: verify → verify again → error
```

### Using Specs with AI

```typescript
const sddPrompt = `
Implement the email verification feature according to this spec:

${spec}

Generate:
1. Database schema changes (if any)
2. Service implementation
3. API route handler
4. Tests covering all acceptance criteria

Follow our existing patterns in:
${existingServiceExample}
`;
```

### SDD Benefits

| Problem | How SDD Helps |
|---------|---------------|
| "AI thrash" (endless iterations) | Clear acceptance criteria stop when met |
| Wrong assumptions | Constraints clarified upfront |
| Missing edge cases | Test cases defined in spec |
| Scope creep | Spec bounds the work |

## In Practice

### Daily Workflow Example

```typescript
// Morning: Review what needs to be done
// Check tickets, plan approach

// For each task:
async function aiAssistedWorkflow(task: Task) {
  // 1. Understand the requirement
  const spec = await clarifyRequirements(task);

  // 2. Explore existing code
  const context = await gatherRelevantCode(spec);

  // 3. Generate implementation
  const code = await generateWithAI(spec, context);

  // 4. Review and test
  await reviewGenerated(code);
  await runTests(code);

  // 5. Checkpoint
  await commitCheckpoint(code, spec);

  // 6. Iterate if needed
  if (!meetsAcceptanceCriteria(code, spec)) {
    return aiAssistedWorkflow(task); // Refine
  }
}
```

## Common Pitfalls

- **Skipping the spec.** "I'll figure it out as I go" → endless iterations.
- **Checkpoints too far apart.** Small commits are easier to debug and revert.
- **Not verifying context.** AI needs accurate code context to generate correct code.
- **Accepting vibe code for production.** That last 30% matters.

## Related

- [Testing and Quality](./testing-quality.md) — Verifying generated code
- [Prompting](../01-core-concepts/prompting.md) — Writing effective prompts
- [Tooling Ecosystem](./tooling-ecosystem.md) — Choosing the right tool
