# Exercise 16: Model Routing

Route requests to different models based on complexity and cost.

## What You'll Learn

1. **Complexity Classification** - Analyze input to determine query difficulty
2. **Cost-Based Routing** - Balance quality vs cost
3. **Fallback Chains** - Try cheaper models first, escalate on failure
4. **Custom Routing Rules** - Domain-specific routing logic

## Prerequisites

**For full functionality, run multiple llama-server instances:**

```bash
# Small model on port 8033
llama-server -m small-model.gguf --port 8033

# Medium model on port 8034
llama-server -m medium-model.gguf --port 8034

# Large model on port 8035
llama-server -m large-model.gguf --port 8035
```

The UI works without servers (shows routing decisions only).

## The Code to Study

```
lib/routing.ts       <- THE MAIN FILE - complexity analysis, router, fallback chain
lib/routing.test.ts  <- Unit tests
```

## Key Concepts

### 1. Complexity Signals

```typescript
interface ComplexitySignals {
  wordCount: number;
  sentenceCount: number;
  hasCode: boolean;
  hasMath: boolean;
  hasMultiStep: boolean;
  technicalTermCount: number;
  questionCount: number;
  reasoningIndicators: number;
}

// Analyze any input
const signals = analyzeComplexity('Write a recursive quicksort algorithm');
// { hasCode: false, hasMath: false, technicalTermCount: 1, ... }
```

### 2. Complexity Classification

```typescript
const { level, confidence, reasons } = classifyComplexity(signals);
// level: 'simple' | 'moderate' | 'complex'
// confidence: 0-1
// reasons: ['Contains code', 'Multi-step task', ...]
```

### 3. Model Registry

```typescript
const registry = new ModelRegistry([
  {
    id: 'small',
    name: 'Small Model (0.5B)',
    endpoint: 'http://127.0.0.1:8033',
    costPer1kTokens: 0.0001,
    latencyMs: 100,
    capabilities: ['chat', 'fast'],
  },
  {
    id: 'large',
    name: 'Large Model (7B+)',
    endpoint: 'http://127.0.0.1:8035',
    costPer1kTokens: 0.002,
    latencyMs: 800,
    capabilities: ['chat', 'code', 'reasoning', 'math', 'creative'],
  },
]);

// Query the registry
const codeModels = registry.getByCapability('code');
const cheapest = registry.getCheapest();
```

### 4. Router with Rules

```typescript
const router = new ModelRouter({
  registry,
  defaultModel: 'medium',
  costWeight: 0.3,    // How much to prefer cheaper models
  latencyWeight: 0.2, // How much to prefer faster models
  rules: [
    {
      name: 'code-generation',
      condition: (input) => /write.*function/i.test(input),
      targetModel: 'medium',
      priority: 10,
    },
    {
      name: 'simple-greeting',
      condition: (input) => input.length < 50 && /^(hi|hello)/i.test(input),
      targetModel: 'small',
      priority: 20,
    },
  ],
});

// Get routing decision
const decision = router.route('Write a sorting function');
// {
//   model: { id: 'medium', ... },
//   reason: 'Rule: code-generation',
//   complexity: 'moderate',
//   confidence: 0.85,
// }
```

### 5. Fallback Chain

```typescript
const chain = new FallbackChain(registry, {
  models: ['small', 'medium', 'large'],  // Try in order
  maxRetries: 2,
  retryDelayMs: 500,
});

// Execute with automatic fallback
const { result, modelUsed, attempts } = await chain.execute(async (model) => {
  const response = await fetch(`${model.endpoint}/v1/chat/completions`, { ... });
  if (!response.ok) throw new Error('Failed');
  return response.json();
});
```

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start the UI
bun dev
```

Open http://localhost:3016 to test routing decisions.

## Routing Algorithm

```
Input Query
     │
     ▼
┌─────────────────┐
│ Check Custom    │  ← Rules checked by priority
│ Rules           │
└────────┬────────┘
         │ No match
         ▼
┌─────────────────┐
│ Analyze         │  ← Extract signals
│ Complexity      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Score Models    │  ← Match capabilities, weight cost/latency
│                 │
└────────┬────────┘
         │
         ▼
   Best Model
```

## Code Patterns to Note

### Pattern Detection

```typescript
// Code detection patterns
const codePatterns = [
  /```/,               // Code blocks
  /function\s+\w+/,    // Function definitions
  /const\s+\w+/,       // Variable declarations
  /class\s+\w+/,       // Class definitions
  /=>/,                // Arrow functions
];

// Math detection patterns
const mathPatterns = [
  /\d+\s*[\+\-\*\/\^]\s*\d+/,  // Arithmetic
  /calculate|compute|solve/i,  // Action words
  /equation|formula/i,          // Math terms
];
```

### Model Scoring

```typescript
// Score each model for a query
let score = 0;

// Capability match (+20 for matching needed capabilities)
if (signals.hasCode && model.capabilities.includes('code')) score += 20;
if (signals.hasMath && model.capabilities.includes('math')) score += 20;

// Complexity match
if (level === 'complex') {
  score += model.capabilities.length * 5;  // More capable = higher score
} else if (level === 'simple') {
  score += (1 - model.costPer1kTokens / 0.01) * 10;  // Cheaper = higher score
}

// Cost penalty
score -= model.costPer1kTokens * costWeight * 10;
```

### Budget Constraints

```typescript
const decision = router.route(input, {
  budget: 0.001,  // Max $0.001 for this request
});

// Router will heavily penalize models that exceed budget
```

## Exercises to Try

1. **Add capability matching** - Weight models based on required vs available capabilities
2. **Implement A/B testing** - Route percentage of traffic to different models
3. **Add quality feedback** - Adjust routing based on response quality
4. **Implement caching** - Cache routing decisions for similar inputs
5. **Add latency-based routing** - Route to fastest available model

## Common Routing Strategies

| Strategy | When to Use |
|----------|-------------|
| Complexity-based | Default - route complex queries to capable models |
| Cost-optimized | Budget-constrained applications |
| Latency-optimized | Real-time applications |
| Capability-matching | Domain-specific tasks (code, math, etc.) |
| Fallback chain | High availability requirements |

## Next Exercise

[Exercise 17: Evals in CI/CD](../17-evals-cicd) - Run evaluations as part of your development workflow.
