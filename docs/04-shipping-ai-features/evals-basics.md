# Evals Basics

How to measure whether AI is doing what you want—before shipping.

## TL;DR

- Define **success criteria** before you start: what does "good" look like for this task?
- Build small **eval sets** covering golden cases, edge cases, and known failure modes
- Use **baselines and diffs** to compare changes objectively
- Know when **human review is required** vs. when automated checks suffice
- Evals are not optional—they're how you avoid shipping regressions

## Core Concepts

### Why Evals Matter

Unlike traditional code, AI behavior isn't deterministic. The same prompt can produce different outputs. Without evals:

- You can't tell if a prompt change improved things or made them worse
- You can't catch regressions before users do
- You're guessing instead of measuring

Evals are your test suite for AI behavior.

### Defining Success Criteria

Before building evals, define what "good" means:

**1. Correctness criteria**

```typescript
// For a code generation task:
const correctnessCriteria = {
  syntacticallyValid: true,        // Code parses without errors
  passesTests: true,               // Runs against provided test cases
  matchesSignature: true,          // Function has expected inputs/outputs
  noHallucinations: true,          // Only uses real APIs and imports
};
```

**2. Quality criteria**

```typescript
// For a summarization task:
const qualityCriteria = {
  preservesKeyFacts: true,         // Important information isn't lost
  lengthInRange: [100, 200],       // Within word count bounds
  noHallucinations: true,          // Doesn't add information not in source
  readability: 'concise',          // Style matches requirements
};
```

**3. Safety criteria**

```typescript
// For user-facing features:
const safetyCriteria = {
  noHarmfulContent: true,          // Passes content filters
  noPrivateDataLeakage: true,      // Doesn't expose PII or secrets
  appropriateTone: true,           // Professional, not offensive
};
```

### Building Eval Sets

An eval set is a collection of input-output pairs (or input-criteria pairs) that represent expected behavior.

**Structure:**

```typescript
interface EvalCase {
  id: string;
  input: string;                    // The prompt or user input
  expected?: string;                // Expected output (for exact match)
  criteria?: EvalCriteria;          // Criteria for fuzzy matching
  category: 'golden' | 'edge' | 'regression' | 'adversarial';
  tags: string[];                   // For filtering and analysis
}

const evalSet: EvalCase[] = [
  {
    id: 'sum-001',
    input: 'Summarize: The quick brown fox jumps over the lazy dog.',
    criteria: {
      containsKeywords: ['fox', 'dog'],
      maxLength: 50,
    },
    category: 'golden',
    tags: ['summarization', 'short-form'],
  },
  // ... more cases
];
```

**Types of eval cases:**

| Category | Purpose | Example |
|----------|---------|---------|
| **Golden** | Core functionality that must work | Happy path, common use cases |
| **Edge** | Boundary conditions | Empty input, very long input, special characters |
| **Regression** | Previously-broken cases | Bugs you've fixed that should stay fixed |
| **Adversarial** | Attempts to break the system | Prompt injection, malformed input |

### Running Evals

**Basic eval runner:**

```typescript
interface EvalResult {
  caseId: string;
  passed: boolean;
  output: string;
  metrics: Record<string, number>;
  errors?: string[];
}

async function runEval(
  evalSet: EvalCase[],
  generateFn: (input: string) => Promise<string>
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];

  for (const evalCase of evalSet) {
    const output = await generateFn(evalCase.input);
    const metrics = calculateMetrics(output, evalCase);
    const passed = meetsAllCriteria(metrics, evalCase.criteria);

    results.push({
      caseId: evalCase.id,
      passed,
      output,
      metrics,
      errors: passed ? undefined : getFailureReasons(metrics, evalCase.criteria),
    });
  }

  return results;
}

// Metrics calculation
function calculateMetrics(output: string, evalCase: EvalCase): Record<string, number> {
  return {
    length: output.length,
    wordCount: output.split(/\s+/).length,
    keywordCoverage: evalCase.criteria?.containsKeywords
      ? countMatches(output, evalCase.criteria.containsKeywords)
      : 0,
    // Add more metrics as needed
  };
}
```

### Baselines and Diffs

Never evaluate in isolation. Compare against a baseline.

**Establishing a baseline:**

```typescript
// Run evals on current (baseline) version
const baselineResults = await runEval(evalSet, currentModel);
saveResults('baseline-2025-01-14', baselineResults);
```

**Comparing changes:**

```typescript
interface EvalComparison {
  improved: string[];      // Cases that now pass
  regressed: string[];     // Cases that now fail
  unchanged: string[];     // No change in pass/fail status
  metrics: {
    before: AggregateMetrics;
    after: AggregateMetrics;
    delta: AggregateMetrics;
  };
}

function compareEvalRuns(
  baseline: EvalResult[],
  candidate: EvalResult[]
): EvalComparison {
  const comparison: EvalComparison = {
    improved: [],
    regressed: [],
    unchanged: [],
    metrics: {
      before: aggregate(baseline),
      after: aggregate(candidate),
      delta: {} as AggregateMetrics,
    },
  };

  for (const [id, baseResult] of Object.entries(groupById(baseline))) {
    const candResult = candidate.find((r) => r.caseId === id);
    if (!candResult) continue;

    if (!baseResult.passed && candResult.passed) {
      comparison.improved.push(id);
    } else if (baseResult.passed && !candResult.passed) {
      comparison.regressed.push(id);
    } else {
      comparison.unchanged.push(id);
    }
  }

  // Calculate metric deltas
  for (const key of Object.keys(comparison.metrics.before)) {
    comparison.metrics.delta[key] =
      comparison.metrics.after[key] - comparison.metrics.before[key];
  }

  return comparison;
}
```

**Decision framework:**

| Comparison Result | Action |
|-------------------|--------|
| Only improvements | Ship it |
| Only regressions | Don't ship, investigate |
| Both improvements and regressions | Analyze tradeoffs, may need product decision |
| No change | Consider if change is worth the complexity |

### Human Review Gates

Some evaluations require human judgment:

**When automated evals aren't enough:**

- Subjective quality (tone, style, helpfulness)
- Novel failure modes (things you didn't think to test)
- High-stakes decisions (content moderation, medical/legal)
- Ambiguous correctness (multiple valid answers)

**Incorporating human review:**

```typescript
interface HumanEvalCase extends EvalCase {
  requiresHumanReview: boolean;
  reviewCriteria: string[];        // What reviewer should assess
  reviewerNotes?: string;          // Guidance for reviewer
}

async function runHybridEval(
  evalSet: HumanEvalCase[],
  generateFn: (input: string) => Promise<string>
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];

  for (const evalCase of evalSet) {
    const output = await generateFn(evalCase.input);
    const autoMetrics = calculateMetrics(output, evalCase);
    const autoPassed = meetsAllCriteria(autoMetrics, evalCase.criteria);

    if (evalCase.requiresHumanReview) {
      // Queue for human review
      await queueForReview({
        caseId: evalCase.id,
        input: evalCase.input,
        output,
        reviewCriteria: evalCase.reviewCriteria,
        autoMetrics,
      });

      results.push({
        caseId: evalCase.id,
        passed: false,  // Pending human review
        output,
        metrics: autoMetrics,
        status: 'pending_review',
      });
    } else {
      results.push({
        caseId: evalCase.id,
        passed: autoPassed,
        output,
        metrics: autoMetrics,
      });
    }
  }

  return results;
}
```

## In Practice

### Starting Small

You don't need hundreds of eval cases to start. Begin with:

1. **5-10 golden cases**: The most common, important use cases
2. **3-5 edge cases**: Empty input, very long input, special characters
3. **Any known bugs**: Cases that broke before (regression tests)

```typescript
// Minimal eval set for a summarization feature
const minimalEvalSet: EvalCase[] = [
  // Golden cases
  {
    id: 'golden-1',
    input: 'Summarize this 500-word article about climate change.',
    criteria: { maxLength: 100, containsKeywords: ['climate'] },
    category: 'golden',
    tags: ['core'],
  },
  {
    id: 'golden-2',
    input: 'Summarize this product description.',
    criteria: { maxLength: 50 },
    category: 'golden',
    tags: ['core'],
  },

  // Edge cases
  {
    id: 'edge-empty',
    input: '',
    criteria: { shouldRefuse: true },
    category: 'edge',
    tags: ['edge'],
  },
  {
    id: 'edge-long',
    input: generateLongText(10000),
    criteria: { maxLength: 200, shouldSucceed: true },
    category: 'edge',
    tags: ['edge'],
  },
];
```

### Eval-Driven Development

Like test-driven development, write evals before changing prompts:

1. **Identify the problem**: What's wrong with current behavior?
2. **Write failing eval**: Create a case that captures the desired behavior
3. **Change the prompt**: Modify to fix the failing case
4. **Run full eval suite**: Ensure no regressions
5. **Ship when green**: All cases pass, improvement confirmed

## Common Pitfalls

- **Evaluating on vibes.** "It looks better" isn't measurable. Define criteria.
- **No regression tests.** Today's fix becomes tomorrow's regression without tests.
- **Only golden path testing.** Edge cases reveal real problems.
- **Ignoring statistical variance.** Run evals multiple times; single runs mislead.

## Related

- [Evals and CI/CD](./evals-cicd.md) — Production eval pipelines
- [Observability](./observability.md) — Monitoring live behavior
- [Prompting](../01-core-concepts/prompting.md) — Improving prompts based on eval results

## Previous

- [Operational Guardrails](./guardrails.md)

## Next

- [Moderation and Policy Enforcement](./moderation-policy.md)
