# Exercise 01: Token Economics

Understanding the fundamental unit of LLM processing - tokens - and how they affect costs and context limits.

## What You'll Learn

1. **Token Estimation** - Three methods to estimate token counts
2. **Cost Calculation** - How LLM pricing works (input vs output)
3. **Context Windows** - Why they matter and how to manage them
4. **TypeScript Patterns** - Type-safe configuration, const assertions

## The Code to Study

```
lib/tokens.ts       <- THE MAIN FILE - read this thoroughly
lib/tokens.test.ts  <- Tests showing expected behavior
```

## Key Concepts

### Tokens Are Not Characters or Words

LLMs process text as "tokens" - subword units:
- Common words like "the" = 1 token
- Unusual words get split: "indescribable" → ["ind", "esc", "rib", "able"]
- Rough rule: 1 token ≈ 4 characters ≈ 0.75 words

### Output Costs More Than Input

Most models charge 3-5x more for output tokens than input:
- GPT-4o: $2.50/1M input, $10/1M output (4x)
- Claude 3.5 Sonnet: $3/1M input, $15/1M output (5x)

Why? Generation requires more compute than processing.

### Context Windows Have Limits

Every model has a maximum context:
- GPT-4o: 128K tokens
- Claude 3.5 Sonnet: 200K tokens
- Gemini 1.5 Pro: 2M tokens

**Always reserve space for output!** If your input is 127K tokens and context is 128K, you can only generate 1K tokens of response.

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests to verify the code works
bun test

# Start the visualization UI
bun dev
```

Open http://localhost:3001 to experiment with different inputs.

## Code Patterns to Note

### 1. Const Assertion for Type Safety

```typescript
export const MODEL_PRICING = {
  'gpt-4o': { input: 2.5, output: 10.0, contextWindow: 128_000 },
  // ...
} as const;

type ModelId = keyof typeof MODEL_PRICING;
// Now ModelId is 'gpt-4o' | 'gpt-4o-mini' | ... (compile-time checked!)
```

### 2. Separate Input/Output in Cost Calculations

```typescript
function calculateCost(inputTokens: number, outputTokens: number, model: ModelId) {
  // Never combine them - they have different prices!
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}
```

### 3. Always Check Context Fit

```typescript
function checkContextFit(inputTokens: number, reserveForOutput: number, model: ModelId) {
  const totalNeeded = inputTokens + reserveForOutput;
  return {
    canFit: totalNeeded <= contextWindow,
    // ...
  };
}
```

## Exercises to Try

1. **Modify the hybrid estimator** - Add detection for URLs and adjust the multiplier
2. **Add a new model** - Pick any model and add its pricing to `MODEL_PRICING`
3. **Build a budget tracker** - Create a function that takes a budget and returns max tokens available
4. **Implement compression estimation** - Estimate how much you can compress by summarizing old messages

## Next Exercise

[Exercise 02: Prompt Engineering](../02-prompt-engineering) - Learn how to structure prompts for different tasks.
