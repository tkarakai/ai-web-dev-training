# Exercise 17: Evals in CI/CD

Run LLM evaluations as part of your development workflow.

## What You'll Learn

1. **CLI-Friendly Eval Runner** - JSON output for pipeline parsing
2. **Test Suites** - Organize tests by feature/capability
3. **Regression Detection** - Compare against baselines
4. **Exit Codes** - Fail CI on eval failures

## Prerequisites

**llama-server must be running:**

```bash
llama-server -m your-model.gguf --port 8033
```

## The Code to Study

```
lib/evals-cicd.ts       <- THE MAIN FILE - eval runner, formatters, baseline store
lib/evals-cicd.test.ts  <- Unit tests
```

## Key Concepts

### 1. Test Cases with Criteria

```typescript
interface EvalTestCase {
  id: string;
  name: string;
  input: string;
  criteria: EvalCriterion[];
  tags?: string[];
}

const testCase: EvalTestCase = {
  id: 'qa-1',
  name: 'Capital of France',
  input: 'What is the capital of France?',
  criteria: [
    { type: 'contains', value: 'Paris', description: 'Should mention Paris' },
    { type: 'length', value: 10, description: 'Non-trivial response' },
  ],
  tags: ['factual', 'geography'],
};
```

### 2. Criterion Types

```typescript
// Contains - Case insensitive substring check
{ type: 'contains', value: 'Paris', description: 'Should contain Paris' }

// Not contains - Ensure absence
{ type: 'not_contains', value: 'error', description: 'No errors' }

// Regex - Pattern matching
{ type: 'regex', value: /\d{3}-\d{4}/, description: 'Phone format' }

// Length - Minimum response length
{ type: 'length', value: 100, description: 'At least 100 chars' }

// JSON valid - Parse validation
{ type: 'json_valid', description: 'Must be valid JSON' }

// Weighted criteria
{ type: 'contains', value: 'key-point', weight: 2.0, description: 'Critical' }
```

### 3. Eval Runner

```typescript
const runner = new EvalRunner({
  baseUrl: 'http://127.0.0.1:8033',
  timeout: 30000,
  maxRetries: 1,
  parallel: false,
  verbose: true,
});

// Run a single test
const result = await runner.runTest(testCase);
console.log(result.passed, result.score);

// Run a suite
const suiteResult = await runner.runSuite('basic-qa', tests);
console.log(suiteResult.passed, suiteResult.failed, suiteResult.score);
```

### 4. Output Formats

```typescript
// Text output (human readable)
console.log(formatTextOutput(suiteResult));
// ╔══════════════════════════════════════════════╗
// ║  Eval Suite: basic-qa                        ║
// ╠══════════════════════════════════════════════╣
// ║  ✓ PASS  Simple factual question       100% ║
// ║  ✗ FAIL  Math question                  50% ║
// ╠══════════════════════════════════════════════╣
// ║  Total: 2  Passed: 1  Failed: 1              ║
// ║  Score: 75.0%  Duration: 1234ms              ║
// ╚══════════════════════════════════════════════╝

// JSON output (machine readable)
const json = formatJSONOutput(suiteResult);
// {
//   "summary": { "passed": 1, "failed": 1, "score": "75.0%" },
//   "tests": [...],
//   "exitCode": 1
// }
```

### 5. Baseline Comparison

```typescript
const baselineStore = new BaselineStore();

// Save a baseline
baselineStore.set('basic-qa', suiteResult);

// Compare against baseline
const baseline = baselineStore.getScore('basic-qa');
const newResult = await runner.runSuite('basic-qa', tests, baseline);

if (newResult.baseline?.regression) {
  console.error('Regression detected!');
  process.exit(1);
}
```

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start the UI (requires llama-server)
bun dev
```

Open http://localhost:3017 to run evals interactively.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: LLM Evals

on: [push, pull_request]

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Start llama-server
        run: |
          # Start your model server here
          llama-server -m model.gguf --port 8033 &
          sleep 10  # Wait for server

      - name: Run Evals
        run: |
          bun run eval --suite basic-qa --format json > results.json
          cat results.json

      - name: Check Results
        run: |
          EXIT_CODE=$(jq '.exitCode' results.json)
          if [ "$EXIT_CODE" != "0" ]; then
            echo "Evals failed!"
            exit 1
          fi

      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: eval-results
          path: results.json
```

### GitLab CI Example

```yaml
eval:
  stage: test
  script:
    - bun install
    - llama-server -m model.gguf --port 8033 &
    - sleep 10
    - bun run eval --suite basic-qa --format json | tee results.json
    - |
      if [ $(jq '.exitCode' results.json) != "0" ]; then
        exit 1
      fi
  artifacts:
    paths:
      - results.json
```

## Code Patterns to Note

### Criterion Evaluation

```typescript
function evaluateCriterion(response: string, criterion: EvalCriterion): CriterionResult {
  const weight = criterion.weight ?? 1;

  switch (criterion.type) {
    case 'contains':
      const passed = response.toLowerCase().includes(String(criterion.value).toLowerCase());
      return { criterion, passed, score: passed ? weight : 0 };

    case 'json_valid':
      try {
        JSON.parse(response);
        return { criterion, passed: true, score: weight };
      } catch {
        return { criterion, passed: false, score: 0 };
      }
    // ...
  }
}
```

### Weighted Scoring

```typescript
// Calculate overall score
const totalWeight = criteriaResults.reduce((sum, r) => sum + (r.criterion.weight ?? 1), 0);
const weightedScore = criteriaResults.reduce((sum, r) => sum + r.score, 0);
const score = totalWeight > 0 ? weightedScore / totalWeight : 0;
```

### Regression Detection

```typescript
const delta = currentScore - baselineScore;
const regression = delta < -regressionThreshold;

if (regression) {
  console.error(`Regression: ${baselineScore} → ${currentScore} (${delta})`);
  return { exitCode: 1 };
}
```

## Exercises to Try

1. **Add more criterion types** - semantic similarity, word count, sentiment
2. **Implement parallel execution** - Run tests concurrently for speed
3. **Add retry logic** - Retry flaky tests before failing
4. **Build baseline persistence** - Save baselines to file/database
5. **Create eval report generator** - HTML reports with charts

## Sample Test Suites

| Suite | Description |
|-------|-------------|
| `basic-qa` | Simple factual questions |
| `code-generation` | Code writing tasks |
| `json-output` | Structured output validation |
| `safety` | Harmful content refusal |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed, no regression |
| 1 | Test failures or regression detected |

## Next Exercise

[Exercise 18: Fine-Tuning with MLX](../18-fine-tuning) - Train custom models on Mac with MLX.
