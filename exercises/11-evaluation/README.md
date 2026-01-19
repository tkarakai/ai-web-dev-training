# Exercise 11: Evaluation Framework

Build and run evaluations to test LLM outputs systematically.

## What You'll Learn

1. **Test case definition** - Structure for inputs and expected outputs
2. **Evaluators** - Functions that score LLM responses
3. **Eval runner** - Execute tests and collect results
4. **Reporting** - Aggregate and analyze test results

## Prerequisites

**llama-server must be running:**

```bash
llama-server -m your-model.gguf --port 8033
```

## The Code to Study

```
lib/evaluation.ts       <- THE MAIN FILE - evaluators, runner, builders
lib/evaluation.test.ts  <- Unit tests for evaluators (no LLM needed)
```

## Key Concepts

### Test Case Structure

```typescript
interface TestCase {
  id: string;
  name: string;
  input: string;                // What to send to the LLM
  expected?: string;            // For exact match
  mustInclude?: string[];       // Keywords that must appear
  mustExclude?: string[];       // Keywords that must NOT appear
  pattern?: RegExp;             // Regex pattern to match
  evaluator?: Function;         // Custom evaluation logic
  category?: string;            // For grouping results
  systemPrompt?: string;        // Optional system context
}
```

### Built-in Evaluators

```typescript
// Exact match
exactMatch("Hello world", testCase)
// → { passed: true, score: 1, reason: "Exact match" }

// Contains keywords
containsKeywords("Paris is the capital", { mustInclude: ["paris", "capital"] })
// → { passed: true, score: 1, reason: "All 2 keywords found" }

// Excludes keywords
excludesKeywords("Success!", { mustExclude: ["error", "fail"] })
// → { passed: true, score: 1, reason: "No excluded keywords found" }

// Pattern matching
matchesPattern("Call 555-1234", { pattern: /\d{3}-\d{4}/ })
// → { passed: true, score: 1, reason: "Pattern matched" }

// JSON validity
isValidJSON('{"name": "John"}')
// → { passed: true, score: 1, reason: "Valid JSON" }
```

### Test Case Builder

```typescript
const tc = testCase()
  .id('math-1')
  .name('Basic addition')
  .input('What is 2 + 2?')
  .mustInclude('4')
  .mustExclude('five', 'three')
  .category('math')
  .build();
```

### Eval Runner

```typescript
const runner = new EvalRunner('http://127.0.0.1:8033', {
  onTestComplete: (result) => console.log(result.testCase.name, result.score.passed),
});

// Run sequentially
const summary = await runner.runAll(testCases);

// Run in parallel (faster)
const summary = await runner.runParallel(testCases, 3);
```

## Run the Exercise

```bash
# Install dependencies
bun install

# Run unit tests (no llama-server needed)
bun test

# Start the UI (requires llama-server)
bun dev
```

Open http://localhost:3011 to run evaluations.

## Sample Test Suites

The code includes pre-built test suites:

```typescript
MATH_TEST_SUITE      // Basic math questions
FACTUAL_TEST_SUITE   // Geography, science, history
FORMAT_TEST_SUITE    // JSON, lists, structured output
```

## Code Patterns to Note

### 1. Composite Evaluator

```typescript
function compositeEvaluator(output: string, testCase: TestCase): EvalScore {
  const scores: EvalScore[] = [];

  if (testCase.expected) scores.push(exactMatch(output, testCase));
  if (testCase.mustInclude) scores.push(containsKeywords(output, testCase));
  if (testCase.mustExclude) scores.push(excludesKeywords(output, testCase));
  if (testCase.pattern) scores.push(matchesPattern(output, testCase));
  if (testCase.evaluator) scores.push(testCase.evaluator(output, testCase));

  // All must pass, average score
  const allPassed = scores.every(s => s.passed);
  const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

  return { passed: allPassed, score: avgScore, reason: ... };
}
```

### 2. Custom Evaluators

```typescript
const jsonWithFields = testCase()
  .id('json-1')
  .input('Return JSON with name and age')
  .customEvaluator((output) => {
    try {
      const obj = JSON.parse(output);
      const hasFields = 'name' in obj && 'age' in obj;
      return {
        passed: hasFields,
        score: hasFields ? 1 : 0,
        reason: hasFields ? 'Valid' : 'Missing fields',
      };
    } catch {
      return { passed: false, score: 0, reason: 'Invalid JSON' };
    }
  })
  .build();
```

### 3. Report Generation

```typescript
const report = generateReport(summary);
// ╔══════════════════════════════════════════════════════════════╗
// ║                     EVALUATION REPORT                        ║
// ╚══════════════════════════════════════════════════════════════╝
//
// 📊 SUMMARY
//    Total Tests:  10
//    Passed:       8 (80.0%)
//    Failed:       2
//    Avg Score:    85.0%
//    Avg Latency:  500ms

// JSON for CI/CD
const jsonReport = generateJSONReport(summary);
```

### 4. LLM-as-Judge

```typescript
async function semanticSimilarity(client, output, expected) {
  const prompt = `Rate similarity of these texts on 0-10 scale:
    Text A: "${output}"
    Text B: "${expected}"
    Score:`;

  const response = await client.chat([{ role: 'user', content: prompt }]);
  const score = parseFloat(response) / 10;

  return { passed: score >= 0.7, score, reason: `Similarity: ${score * 100}%` };
}
```

## Result Structure

```typescript
interface EvalSummary {
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;      // 0-1
  avgScore: number;      // 0-1
  avgLatencyMs: number;
  byCategory: Map<string, { passed: number; total: number }>;
  results: TestResult[];
}
```

## Exercises to Try

1. **Add a new evaluator** - Create `hasSentiment(positive/negative)` evaluator
2. **Build a regression suite** - Compare results across model versions
3. **Implement grading rubric** - Multi-criteria scoring (accuracy, format, tone)
4. **Add threshold gates** - Fail CI if pass rate drops below threshold

## When to Use

| Scenario | Approach |
|----------|----------|
| Simple checks | `mustInclude` / `mustExclude` |
| Structured output | `isValidJSON` + custom field checks |
| Fuzzy matching | `semanticSimilarity` with LLM judge |
| Regression testing | Full test suite with JSON reports |

## Next Exercise

[Exercise 12: Content Moderation](../12-content-moderation) - Filter inappropriate content.
