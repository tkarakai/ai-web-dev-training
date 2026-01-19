# Exercise 08: Chain-of-Thought Reasoning

Improve LLM accuracy on reasoning tasks by prompting for step-by-step thinking.

## What You'll Learn

1. **CoT prompting** - "Let's think step by step" dramatically improves reasoning
2. **Step extraction** - Parse reasoning steps from unstructured responses
3. **Self-consistency** - Multiple reasoning paths + majority voting
4. **Confidence estimation** - Heuristics for answer reliability

## Prerequisites

**llama-server must be running:**

```bash
llama-server -m your-model.gguf --port 8033
```

## The Code to Study

```
lib/chain-of-thought.ts       <- THE MAIN FILE - prompts, parsing, evaluation
lib/chain-of-thought.test.ts  <- Tests for parsing logic
```

## Key Concepts

### Why Chain-of-Thought Works

```typescript
// Zero-shot: just asks for answer
const zeroShot = `${question}\n\nAnswer:`;

// Chain-of-Thought: prompts for reasoning
const cot = `${question}\n\nLet's think step by step:`;
```

The simple addition of "think step by step" can improve accuracy by 20-50% on reasoning tasks. Why?
- Forces the model to "show work"
- Breaks complex problems into simpler steps
- Catches errors during intermediate reasoning

### Step Extraction

```typescript
function extractSteps(response: string): ReasoningStep[] {
  // Try numbered format: "Step 1:", "1.", etc.
  const numberedPattern = /(?:Step\s*)?(\d+)[.):]\s*(.+?)(?=(?:Step\s*)?\d+|Final|$)/gi;

  // Try ordinal format: "First,", "Second,", "Finally,"
  const ordinalPattern = /(first|second|third|then|finally)[,:]?\s*(.+)/gi;

  // Fallback: split by sentences
}
```

### Answer Extraction

```typescript
function extractFinalAnswer(response: string): string {
  // Look for explicit markers
  const patterns = [
    /Final\s*Answer[:\s]+(.+?)(?:\.|$)/i,
    /Therefore,?\s*(?:the\s+)?answer\s+is[:\s]+(.+?)(?:\.|$)/i,
  ];

  // Fallback: last number in response
  const numbers = response.match(/\b\d+(?:\.\d+)?\b/g);
  if (numbers) return numbers[numbers.length - 1];
}
```

### Self-Consistency

```typescript
async function selfConsistency(question: string, numSamples = 3) {
  const votes = new Map<string, number>();

  for (let i = 0; i < numSamples; i++) {
    // Generate with temperature > 0 for diverse reasoning
    const response = await client.chat(prompt, { temperature: 0.7 });
    const answer = extractFinalAnswer(response);

    votes.set(answer, (votes.get(answer) || 0) + 1);
  }

  // Return majority answer
  return [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
```

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests (no llama-server needed)
bun test

# Start the UI (requires llama-server)
bun dev
```

Open http://localhost:3008 to compare zero-shot vs chain-of-thought.

## Code Patterns to Note

### 1. Structured vs Unstructured CoT

```typescript
// Unstructured: let model format freely
const simple = `${question}\n\nLet's think step by step:`;

// Structured: specify exact format
const structured = `${question}

Please solve step by step:
Step 1: [reasoning]
Step 2: [reasoning]
Final Answer: [answer]`;
```

Structured prompts are easier to parse but may constrain the model.

### 2. Confidence Estimation

```typescript
function estimateConfidence(response: string, steps: ReasoningStep[]): number {
  let confidence = 0.5;

  // More steps = more thorough reasoning
  if (steps.length >= 3) confidence += 0.1;

  // Explicit answer marker = clearer response
  if (/Final\s*Answer/i.test(response)) confidence += 0.15;

  // Hedging language = uncertainty
  if (/maybe|probably|not sure/i.test(response)) confidence -= 0.15;

  return Math.max(0, Math.min(1, confidence));
}
```

### 3. Answer Normalization

```typescript
function answersMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\w\d]/g, '');

  // Exact match
  if (norm(a) === norm(b)) return true;

  // Numeric comparison: "42" vs "42.0"
  const numA = parseFloat(a), numB = parseFloat(b);
  if (!isNaN(numA) && !isNaN(numB)) {
    return Math.abs(numA - numB) < 0.001;
  }

  return false;
}
```

## Test Problems Included

The code includes test problems across categories:

| Category | Example | Challenge |
|----------|---------|-----------|
| Math | Speed = distance/time | Multi-step arithmetic |
| Logic | "All X are Y" syllogisms | Formal reasoning |
| Word | "All but 9 run away" | Language interpretation |
| Reasoning | "Overtake 2nd place" | Counter-intuitive answers |

## Exercises to Try

1. **Add more test problems** - Expand the `TEST_PROBLEMS` array
2. **Implement few-shot CoT** - Add examples before the question
3. **Try different CoT prompts** - Compare "think step by step" variants
4. **Build accuracy tracker** - Compare CoT vs zero-shot over many problems

## When CoT Helps vs Hurts

| Helps | Hurts/Neutral |
|-------|---------------|
| Multi-step math | Simple factual recall |
| Logic puzzles | Single-step answers |
| Word problems | Creative writing |
| Planning tasks | Classification |

## Research Background

Chain-of-thought prompting was introduced in "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models" (Wei et al., 2022). Key findings:

- Works better with larger models
- Self-consistency (voting) further improves accuracy
- Zero-shot CoT ("Let's think step by step") is surprisingly effective

## Next Exercise

[Exercise 09: Multi-Agent Pipelines](../09-multi-agent) - Orchestrate multiple LLM calls with different roles.
