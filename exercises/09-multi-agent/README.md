# Exercise 09: Multi-Agent Pipelines

Orchestrate multiple LLM calls with different roles and coordination patterns.

## What You'll Learn

1. **Sequential chains** - Output of one agent feeds into the next
2. **Parallel fan-out** - Multiple agents process simultaneously
3. **Maker-checker** - One creates, another validates/critiques
4. **Router pattern** - Classify input and route to specialized agents

## Prerequisites

**llama-server must be running:**

```bash
llama-server -m your-model.gguf --port 8033
```

## The Code to Study

```
lib/multi-agent.ts       <- THE MAIN FILE - agent definitions, pipeline patterns
lib/multi-agent.test.ts  <- Tests for structure and integration
```

## Key Concepts

### Agent Definition

```typescript
interface Agent {
  name: string;
  systemPrompt: string;
  temperature?: number;  // Low for analysis, high for creativity
  maxTokens?: number;
}

const AGENTS = {
  analyzer: {
    name: 'Analyzer',
    systemPrompt: 'Break down the input into key components...',
    temperature: 0.3,
  },
  writer: {
    name: 'Writer',
    systemPrompt: 'Create clear, engaging content...',
    temperature: 0.7,
  },
  // ... more agents
};
```

### Sequential Chain

```typescript
async function runSequentialChain(
  client: LlamaClient,
  agents: Agent[],
  input: string
): Promise<PipelineResult> {
  let currentInput = input;

  for (const agent of agents) {
    const response = await runAgent(client, agent, currentInput);
    currentInput = response.output;  // Chain output to next input
  }

  return { finalOutput: currentInput, ... };
}

// Usage: Analyze → Write → Summarize
const result = await runSequentialChain(
  client,
  [AGENTS.analyzer, AGENTS.writer, AGENTS.summarizer],
  "Explain microservices"
);
```

### Parallel Execution

```typescript
async function runParallelAgents(
  client: LlamaClient,
  agents: Agent[],
  input: string
) {
  // Run all agents concurrently
  const responses = await Promise.all(
    agents.map(agent => runAgent(client, agent, input))
  );

  return { responses, totalLatencyMs: /* wall clock time */ };
}

// Total time = max(individual times), not sum
```

### Maker-Checker Pattern

```typescript
async function runMakerChecker(maker, checker, input, maxIterations = 3) {
  for (let i = 0; i < maxIterations; i++) {
    const draft = await runAgent(maker, input);
    const review = await runAgent(checker, draft.output);

    if (review.output.includes('APPROVED')) {
      return { finalOutput: draft.output, approved: true };
    }

    // Prepare revision prompt with feedback
    input = `Original: ${input}\nDraft: ${draft.output}\nFeedback: ${review.output}\nRevise.`;
  }
}
```

### Router Pattern

```typescript
async function runWithRouter(client, input, routes: Record<string, Agent>) {
  // First: classify the input
  const classification = await runAgent(client, AGENTS.router, input);
  const route = classification.output.trim();  // "CONTENT", "CODE", etc.

  // Then: route to specialized agent
  const agent = routes[route] || routes['GENERAL'];
  return runAgent(client, agent, input);
}

// Usage
const result = await runWithRouter(client, "Write a poem", {
  CONTENT: AGENTS.writer,
  CODE: AGENTS.codeReviewer,
  GENERAL: AGENTS.writer,
});
```

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests (no llama-server needed for unit tests)
bun test

# Start the UI (requires llama-server)
bun dev
```

Open http://localhost:3009 to visualize different pipeline patterns.

## Pipeline Patterns

| Pattern | Flow | Use Case |
|---------|------|----------|
| Sequential | A → B → C | Progressive refinement |
| Parallel | [A, B] → C | Multiple perspectives |
| Maker-Checker | A ↔ B (loop) | Quality assurance |
| Router | Classify → Route | Specialized handling |
| Debate | Pro \| Con → Judge | Decision making |

## Code Patterns to Note

### 1. Fluent Pipeline Builder

```typescript
const result = await pipeline(client)
  .input("Write about TypeScript")
  .then(AGENTS.writer)
  .then(AGENTS.critic)
  .then(AGENTS.writer)  // Revise based on criticism
  .run();
```

### 2. Aggregation Pattern

```typescript
async function runAndAggregate(agents, input, aggregator) {
  // Fan-out: run multiple agents in parallel
  const { responses } = await runParallelAgents(agents, input);

  // Format for aggregation
  const combined = responses
    .map(r => `[${r.agent}]:\n${r.output}`)
    .join('\n\n---\n\n');

  // Fan-in: synthesize perspectives
  return runAgent(aggregator, `Synthesize:\n${combined}`);
}
```

### 3. Temperature by Role

```typescript
const AGENTS = {
  // Analytical agents: low temperature for consistency
  analyzer: { temperature: 0.3 },
  factChecker: { temperature: 0.1 },
  router: { temperature: 0 },  // Deterministic routing

  // Creative agents: higher temperature for variety
  writer: { temperature: 0.7 },
  brainstormer: { temperature: 0.9 },
};
```

### 4. Debate Workflow

```typescript
async function runDebate(client, topic) {
  // Arguments run in parallel (faster)
  const { responses } = await runParallelAgents(
    [proAgent, conAgent],
    topic
  );

  // Judge evaluates both sides
  const judgment = await runAgent(judgeAgent, `
    Topic: ${topic}
    PRO: ${responses[0].output}
    CON: ${responses[1].output}
    Which argument is more convincing?
  `);

  return { pro, con, judgment };
}
```

## Pre-built Agents

The code includes these ready-to-use agents:

| Agent | Role | Temperature |
|-------|------|-------------|
| `analyzer` | Break down input | 0.3 |
| `researcher` | Provide facts | 0.3 |
| `writer` | Create content | 0.7 |
| `summarizer` | Condense output | 0.2 |
| `critic` | Review and improve | 0.3 |
| `factChecker` | Verify claims | 0.1 |
| `router` | Classify input | 0 |

## Exercises to Try

1. **Add a new agent** - Create a "translator" agent
2. **Build a code review pipeline** - Security + bugs + style agents
3. **Implement retry on rejection** - Maker revises until checker approves
4. **Create a research workflow** - Multiple researchers + synthesis

## When to Use Multi-Agent

| Use Multi-Agent | Don't Use |
|-----------------|-----------|
| Complex tasks with distinct phases | Simple single-step queries |
| Need multiple perspectives | Speed is critical |
| Quality assurance required | Low token budget |
| Specialized expertise needed | Task is straightforward |

## Next Exercise

[Exercise 10: PII Detection & Guardrails](../10-pii-guardrails) - Detect and redact sensitive data.
