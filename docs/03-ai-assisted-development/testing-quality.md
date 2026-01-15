# Testing and Quality with AI

> Using AI to generate tests, strengthen coverage, and catch edge cases—without false confidence.

## TL;DR

- **Assertion-first prompting**: Define expected behavior before generating test code
- AI-generated tests can create **false confidence**: they pass but don't verify what matters
- Use AI for **test scaffolding**, not test design—you define what to test
- **Property-based testing** and **mutation-inspired prompting** find edge cases you missed
- Tests are verification, not validation: they check the spec, not that the spec is right

## Core Concepts

### The False Confidence Problem

AI generates tests that pass. But passing tests don't mean correct code.

```typescript
// AI-generated test that creates false confidence
describe('calculateDiscount', () => {
  it('should calculate discount', () => {
    const result = calculateDiscount(100, 10);
    expect(result).toBe(result); // Always passes!
  });
});

// What the test should actually verify
describe('calculateDiscount', () => {
  it('should reduce price by percentage', () => {
    expect(calculateDiscount(100, 10)).toBe(90);
  });

  it('should handle 0% discount', () => {
    expect(calculateDiscount(100, 0)).toBe(100);
  });

  it('should handle 100% discount', () => {
    expect(calculateDiscount(100, 100)).toBe(0);
  });

  it('should reject negative percentages', () => {
    expect(() => calculateDiscount(100, -10)).toThrow();
  });
});
```

### Assertion-First Prompting

Tell AI what to test before generating test code.

```typescript
const testPrompt = `
Write tests for the createUser function.

Function signature:
async function createUser(data: CreateUserInput): Promise<Result<User, UserError>>

Assertions to test:
1. Valid input returns Ok with user object containing id, email, createdAt
2. Duplicate email returns Err with code 'EMAIL_EXISTS'
3. Invalid email format returns Err with code 'INVALID_EMAIL'
4. Password under 8 chars returns Err with code 'WEAK_PASSWORD'
5. Missing required fields returns Err with code 'VALIDATION_ERROR'

Use vitest, our existing test helpers in src/test/helpers.ts, and follow
the patterns in src/services/__tests__/auth.service.test.ts

${functionCode}
`;
```

**Why assertion-first works:**
- You decide what matters (the spec)
- AI handles boilerplate (test structure)
- Clear pass/fail criteria
- Forces you to think about behavior

### Test Scaffolding Pattern

Use AI to accelerate test writing, not replace thinking.

```typescript
// Step 1: You define test cases
const testCases = `
Test cases for OrderService.calculateTotal:
- Empty cart → returns 0
- Single item → returns item price
- Multiple items → returns sum
- With discount code → applies discount
- Discount code expired → ignores discount
- Negative quantity → throws error
- Item not found → throws error
`;

// Step 2: AI generates test structure
const scaffoldPrompt = `
Generate vitest test scaffolds for these cases.
Use arrange-act-assert pattern.
Include descriptive test names.
Add // TODO comments for any setup I need to provide.

${testCases}
`;

// Step 3: You review and fill in specifics
// AI output gives you structure, you verify logic
```

### Property-Based Testing

Test properties that should always hold, not just specific examples.

```typescript
// Traditional example-based test
test('sort returns sorted array', () => {
  expect(sort([3, 1, 2])).toEqual([1, 2, 3]);
});

// Property-based: test the property "output is sorted"
import { fc, test as fcTest } from '@fast-check/vitest';

fcTest.prop([fc.array(fc.integer())])('sort returns sorted array', (arr) => {
  const sorted = sort(arr);

  // Property: each element ≤ next element
  for (let i = 0; i < sorted.length - 1; i++) {
    expect(sorted[i]).toBeLessThanOrEqual(sorted[i + 1]);
  }

  // Property: same elements (permutation)
  expect(sorted.length).toBe(arr.length);
  expect(sorted.sort()).toEqual(arr.sort());
});
```

**AI prompt for property-based tests:**

```typescript
const propertyPrompt = `
For the function ${functionName}, what properties should always hold?

Function:
${functionCode}

Generate property-based tests using fast-check that verify:
1. Invariants (what's always true about the output)
2. Relationships (how output relates to input)
3. Round-trip properties (encode/decode, serialize/deserialize)
4. Idempotence (if applicable)
`;
```

### Contract Testing

Verify that interfaces between systems match expectations.

```typescript
// AI prompt for contract tests
const contractPrompt = `
Generate contract tests for the UserAPI client.

API spec:
${openApiSpec}

Client code:
${clientCode}

Tests should verify:
1. Request format matches spec (method, path, body shape)
2. Response parsing handles all documented status codes
3. Error responses are properly typed
4. Required headers are included

Use msw for mocking HTTP requests.
`;
```

### Mutation-Inspired Prompting

Ask AI to propose changes your tests should catch.

```typescript
const mutationPrompt = `
Here's a function and its tests:

Function:
${functionCode}

Tests:
${testCode}

Propose 5 mutations (small changes) to the function that would introduce bugs.
For each mutation:
1. Describe the change
2. What bug it creates
3. Which existing test would catch it (or "none")

If any mutation isn't caught, suggest a test to add.
`;
```

**Example output:**

```typescript
// Mutation 1: Change > to >=
// Bug: Off-by-one in boundary condition
// Caught by: test "should reject values at exactly the limit" — NONE
// Suggested test:
test('should reject value at exactly the max limit', () => {
  expect(() => validate(MAX_VALUE)).toThrow();
});

// Mutation 2: Remove null check
// Bug: Crash on null input
// Caught by: test "should handle null gracefully" — YES
```

### AI-Assisted Code Review for Tests

Use AI to review test quality, not just generate tests.

```typescript
const reviewPrompt = `
Review these tests for quality issues:

${testCode}

Check for:
1. Tests that always pass (tautologies)
2. Missing edge cases
3. Tests that don't actually test the thing they claim to
4. Overly coupled tests (testing implementation, not behavior)
5. Missing error path coverage
6. Flaky patterns (timing, random data, external dependencies)

For each issue found, explain why it's a problem and suggest a fix.
`;
```

## In Practice

### Spec-to-Tests Workflow

```typescript
// 1. Write acceptance criteria
const spec = `
Feature: Password reset
- User requests reset with email
- System sends email with token (expires in 1 hour)
- User submits new password with token
- Password is updated, token invalidated
- Expired token returns error
- Invalid token returns error
- Weak password returns error
`;

// 2. Generate test cases from spec
const testCases = await generateTestCases(spec);

// 3. Review and refine test cases (human step)
// Does each acceptance criterion have a test?
// Are edge cases covered?

// 4. Generate test scaffolds
const testScaffolds = await generateTestScaffolds(testCases);

// 5. Implement tests with assertions
// Human fills in specific values and verifications

// 6. Run tests, expect failures (TDD red phase)

// 7. Implement feature

// 8. Tests pass (TDD green phase)
```

### Coverage Improvement Prompt

```typescript
const coveragePrompt = `
Current test coverage for ${fileName}:

Uncovered lines: ${uncoveredLines.join(', ')}
Uncovered branches: ${uncoveredBranches.join(', ')}

File content:
${fileContent}

Generate tests that cover the uncovered code paths.
Focus on:
1. Error handling branches
2. Edge case conditions
3. Default/fallback paths

Explain what each test covers and why that path matters.
`;
```

### Integration Test Generation

```typescript
const integrationPrompt = `
Generate integration tests for the checkout flow:

Components involved:
- CartService (manages cart state)
- PaymentService (processes payment)
- InventoryService (checks/updates stock)
- OrderService (creates order record)

Test the full flow:
1. User adds items to cart
2. User proceeds to checkout
3. Payment is processed
4. Inventory is updated
5. Order is created

Include tests for failure scenarios:
- Payment failure → cart preserved, no inventory change
- Inventory insufficient → payment not attempted
- Order creation failure → payment refunded

Use our test database and mock payment provider.
`;
```

## Common Pitfalls

- **AI tests that test the AI.** If AI wrote both code and tests, bugs can be shared.
- **Testing implementation, not behavior.** Tests should survive refactoring.
- **100% coverage obsession.** Coverage measures what's run, not what's verified.
- **Skipping review of generated tests.** Tests need review too.

## Related

- [Day-to-Day Workflows](./day-to-day-workflows.md) — Integrating tests into workflow
- [Evals Basics](../02-governance/evals-basics.md) — Testing AI behavior itself
- [Evals and CI/CD](../04-shipping-ai-features/evals-cicd.md) — Automated testing pipelines
