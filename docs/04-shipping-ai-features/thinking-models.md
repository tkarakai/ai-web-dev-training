# Native Thinking Models

Leveraging models with built-in reasoning capabilities for complex tasks.

## TL;DR

- **Thinking models** (o1, Claude extended thinking, DeepSeek-R1) use hidden reasoning tokens before generating output
- Use for **complex reasoning**: math, logic, planning, code analysis, multi-step problems
- **Don't use** for simple queries, real-time chat, or content generation—slower and more expensive
- **Combine strategies**: thinking for planning, regular models for execution
- **Always validate outputs**—reasoning doesn't guarantee correctness

## Core Concepts

### How Thinking Models Work

Traditional model: User prompt → Generate tokens → Response

Thinking model: User prompt → Internal reasoning → Filtered response

```typescript
// Standard call (o1 models always use thinking)
const response = await openai.chat.completions.create({
  model: 'o1-mini',
  messages: [{ role: 'user', content: complexProblem }],
});

// Claude with extended thinking (explicit control)
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250514',
  messages: [{ role: 'user', content: veryComplexProblem }],
  thinking: {
    type: 'enabled',
    budget_tokens: 10000, // Limit thinking tokens
  },
  max_tokens: 4096,
});
```

### Thinking Token Visibility

**Proprietary models** (OpenAI o1, Claude) typically hide reasoning tokens or provide only summaries:

- **OpenAI o1**: Thinking tokens are completely hidden; only final output is returned
- **Claude Extended Thinking**: Returns thinking content, but as a filtered summary rather than raw reasoning tokens
- **Trade-off**: Better user experience and privacy, but less transparency for debugging

**Open source models** (DeepSeek-R1, QwQ) expose full reasoning tokens to the client:

```typescript
// OpenAPI-compatible call to open source reasoning model
const response = await fetch('http://localhost:8000/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'deepseek-ai/DeepSeek-R1',
    messages: [{ role: 'user', content: 'Solve: What is 157 * 293?' }],
    max_tokens: 4096,
    stream: false,
  }),
});

const data = await response.json();

// Response includes thinking tokens in content
console.log(data.choices[0].message.content);
// Output format:
// <think>
// Let me break this down...
// 157 * 293
// = 157 * (300 - 7)
// = 157 * 300 - 157 * 7
// = 47,100 - 1,099
// = 46,001
// </think>
// The answer is 46,001.
```

**Client-side control**: With open source models, you can parse and display thinking tokens:

```typescript
function parseReasoningResponse(content: string) {
  const thinkingMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  const thinking = thinkingMatch ? thinkingMatch[1].trim() : null;
  const answer = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();

  return { thinking, answer };
}

// Let users toggle visibility
const { thinking, answer } = parseReasoningResponse(data.choices[0].message.content);

if (userPreferences.showReasoning) {
  console.log('Reasoning:', thinking);
}
console.log('Answer:', answer);
```

**When to expose thinking tokens:**
- **Educational tools**: Show step-by-step reasoning to teach problem-solving
- **Debugging**: Understand why the model reached a conclusion
- **Trust building**: Allow users to verify the reasoning process
- **Research**: Analyze reasoning patterns for evaluation

**When to hide thinking tokens:**
- **Production apps**: Most users want answers, not reasoning traces
- **Privacy concerns**: Reasoning may expose sensitive patterns
- **Cost optimization**: Displaying thinking increases UI complexity

### Available Models

| Model | Provider | Latency | Best For |
|-------|----------|---------|----------|
| o1 | OpenAI | ~15s | Math, science, complex logic |
| o1-mini | OpenAI | ~8s | Code generation, debugging |
| Claude Sonnet 4.5 | Anthropic | ~10s | Planning, analysis |
| DeepSeek-R1 | Open source | ~5s | Privacy-sensitive, high-volume |

### Open Source Alternatives

For privacy, compliance, or high-volume use:

```typescript
import { VLLMClient } from 'vllm-client';

const client = new VLLMClient({
  model: 'deepseek-ai/DeepSeek-R1',
  baseURL: 'http://localhost:8000',
});

const response = await client.chat.completions.create({
  messages: [{ role: 'user', content: complexProblem }],
  max_tokens: 4096,
});
```

**Popular options:**
- **DeepSeek-R1**: 671B params, competitive with o1, requires 2x A100
- **gpt-oss-120b**: Runs on 1x A100, Apache 2.0
- **gpt-oss-20b**: Runs on 16GB RAM, edge-deployable

**When to self-host:**
- Regulatory requirements (financial, healthcare)
- High volume (breakeven ~10M tokens/month)
- Custom fine-tuning needs
- Air-gapped environments

## When to Use Thinking Models

**Good use cases:**
- Multi-step math or logic problems
- Code architecture decisions with trade-offs
- Debugging complex, non-obvious issues
- Security analysis requiring systematic checking
- Strategic planning with many constraints

**Bad use cases:**
- Simple factual queries
- Real-time chat (latency sensitive)
- Content generation (no reasoning benefit)
- Structured data extraction (pattern matching)
- High-volume batch processing (cost multiplier)

**Quick decision table:**

| Scenario | Model Choice | Reason |
|----------|--------------|--------|
| Simple Q&A, content generation | Regular | No reasoning needed |
| Complex math, multi-step logic | Thinking | Core use case |
| Real-time chat, autocomplete | Regular | Latency matters |
| Code review, security audit | Thinking | Deep analysis needed |
| High-volume data extraction | Regular | Cost multiplier too high |
| Strategic planning, architecture | Thinking | Trade-off analysis |

## Combining Thinking Models

### Hybrid Approach: Planning + Execution

Use thinking for decisions, regular models for implementation.

```typescript
// Step 1: Thinking model plans architecture
const plan = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250514',
  messages: [{ role: 'user', content: requirements }],
  thinking: { type: 'enabled', budget_tokens: 5000 },
  max_tokens: 4096,
});

// Step 2: Regular model implements
const code = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250514',
  messages: [{ role: 'user', content: `Implement: ${plan.content}` }],
  max_tokens: 8192,
});
```

### Validation Pattern

Fast model generates, thinking model validates.

```typescript
const solution = await callFastModel(task);
const validation = await callThinkingModel(`Validate: ${solution}`);

if (!validation.valid) {
  // Regenerate or repair
}
```

### Exposed Reasoning

Show thinking for educational or debugging use cases.

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250514',
  messages: [{ role: 'user', content: query }],
  thinking: { type: 'enabled', budget_tokens: 5000 },
  max_tokens: 4096,
});

const reasoning = response.content
  .filter(b => b.type === 'thinking')
  .map(b => b.thinking)
  .join('\n');
```

## Production Considerations

### Cost Management

Thinking uses 2-4x more tokens. Optimize with:

```typescript
// 1. Route by complexity
function chooseModel(task: Task) {
  return task.needsReasoning ? 'o1-mini' : 'gpt-4o';
}

// 2. Limit thinking budget
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250514',
  thinking: { type: 'enabled', budget_tokens: 3000 },
  messages: [{ role: 'user', content: query }],
  max_tokens: 2048,
});

// 3. Cache expensive calls
const cached = await cache.get(hashQuery(query));
if (cached) return cached;
```

### Latency Management

Expect 5-15s latency. Mitigate with:

```typescript
// Stream for better perceived latency
const stream = await openai.chat.completions.create({
  model: 'o1-mini',
  messages: [{ role: 'user', content: query }],
  stream: true,
});

// Show progress indicator
console.log('Thinking...');
```

### Validation

Always validate outputs—thinking doesn't guarantee correctness.

```typescript
async function callWithValidation<T>(
  query: string,
  validator: (result: T) => boolean,
  maxRetries = 2
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    const result = await callThinkingModel<T>(query);
    if (validator(result)) return result;
  }
  throw new Error('Validation failed');
}
```

## Common Pitfalls

- **Using for simple tasks.** Save thinking models for complex reasoning.
- **No token budgets.** Always set `budget_tokens` to control costs.
- **Assuming correctness.** Validate outputs—thinking helps but doesn't guarantee accuracy.
- **Ignoring costs.** Track spending; thinking uses 2-4x more tokens.

## Related

- [Prompting and Interaction Patterns](../01-core-concepts/prompting.md) — ReAct pattern and foundational prompting
- [Model Routing](./model-routing.md) — Choosing the right model for each task
- [Observability](./observability.md) — Monitoring and debugging model performance

## Previous

- [API Integration Patterns](./api-integration.md)

## Next

- [Multi-Agent Systems and Orchestration](./multi-agent-orchestration.md)
