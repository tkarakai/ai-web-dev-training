# Exercise 02: Prompt Engineering

Compare different prompting strategies with real LLM calls. See how the same question produces different results depending on how you ask it.

## What You'll Learn

1. **Zero-shot prompting** - Just ask directly
2. **Few-shot prompting** - Teach by example
3. **Chain-of-thought** - "Think step by step"
4. **Role-based prompting** - Give the model a persona
5. **Prompt templates** - Reusable, testable prompt structures

## Prerequisites

**llama-server must be running:**

```bash
llama-server -m your-model.gguf --port 8033
```

## The Code to Study

```
lib/prompts.ts       <- THE MAIN FILE - prompt building patterns
lib/prompts.test.ts  <- Tests showing expected behavior
```

## Key Concepts

### Zero-Shot: Just Ask

```typescript
function buildZeroShotPrompt(task: string): Message[] {
  return [{ role: 'user', content: task }];
}
```

Best for: Simple questions the model "knows"
Worst for: Specific formats, novel tasks

### Few-Shot: Teach by Example

```typescript
function buildFewShotPrompt(task: string, examples: Example[]): Message[] {
  const messages: Message[] = [];
  for (const ex of examples) {
    messages.push({ role: 'user', content: ex.input });
    messages.push({ role: 'assistant', content: ex.output });
  }
  messages.push({ role: 'user', content: task });
  return messages;
}
```

Best for: Teaching format, style, or pattern
Key insight: 2-3 good examples often beat 10 mediocre ones

### Chain-of-Thought: Think Step by Step

```typescript
function buildChainOfThoughtPrompt(task: string): Message[] {
  return [{
    role: 'user',
    content: `${task}\n\nLet's work through this step by step:`,
  }];
}
```

Best for: Math, logic, multi-step reasoning
Key insight: The phrase "step by step" genuinely improves accuracy on reasoning tasks

### Role-Based: Give a Persona

```typescript
function buildRoleBasedPrompt(task: string, role: string): Message[] {
  return [
    { role: 'system', content: role },
    { role: 'user', content: task },
  ];
}
```

Best for: Domain expertise, consistent tone
Key insight: Be specific about expertise AND constraints

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests (no server needed)
bun test

# Start the UI (requires llama-server)
bun dev
```

Open http://localhost:3002 to compare strategies.

## Code Patterns to Note

### 1. Prompt Templates with Variable Interpolation

```typescript
const template = 'Summarize {{content}} in {{length}} sentences.';

function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}
```

### 2. Example Sets for Reusability

```typescript
const EXAMPLE_SETS = {
  sentiment: [
    { input: 'I love it!', output: 'positive' },
    { input: 'Terrible.', output: 'negative' },
  ],
  // Easy to add new domains
};
```

### 3. Validation Before Sending

```typescript
function validatePromptLength(messages: Message[], maxTokens: number): boolean {
  const estimated = estimatePromptTokens(messages);
  return estimated < maxTokens - reserveForOutput;
}
```

## Exercises to Try

1. **Add a new example set** - Create examples for a task you care about
2. **Build a self-consistency prompt** - Run same CoT prompt 3 times, pick majority answer
3. **Create a template library** - Add templates for your common tasks
4. **Measure accuracy** - Pick a task with known answers, compare strategy accuracy

## When to Use Each Strategy

| Strategy | Best For | Token Cost |
|----------|----------|------------|
| Zero-shot | Simple factual questions | Lowest |
| Few-shot | Format/style teaching | Medium |
| Chain-of-thought | Reasoning, math, logic | Higher |
| Role-based | Domain expertise, tone | Low |

## Next Exercise

[Exercise 03: Tool Calling](../03-tool-calling) - Let the LLM call functions.
