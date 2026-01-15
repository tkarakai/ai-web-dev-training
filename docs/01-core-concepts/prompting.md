# Prompting and Interaction Patterns

> How to communicate with LLMs effectively—from basic prompts to agentic workflows.

## TL;DR

- Structure prompts with clear **instruction hierarchy**: system prompt → context → user request → output format
- **Show, don't tell**: Examples beat descriptions for complex formatting
- Always **verify outputs**: "Trust but verify" is the only safe approach
- **Agentic workflows** (plan→act→observe loops) unlock complex tasks but need guardrails
- Prompt engineering is **iterative debugging**, not one-shot magic

## Core Concepts

### Anatomy of a Good Prompt

Effective prompts have clear structure:

```typescript
const messages = [
  {
    role: 'system',
    content: `You are a senior TypeScript developer reviewing code for security issues.

Rules:
- Focus only on security vulnerabilities (not style or performance)
- Cite specific line numbers
- Rate severity as: critical, high, medium, low
- If no issues found, say "No security issues identified"`,
  },
  {
    role: 'user',
    content: `Review this code for security vulnerabilities:

\`\`\`typescript
${codeToReview}
\`\`\`

Output format:
- Issue: [description]
- Line: [number]
- Severity: [level]
- Fix: [recommendation]`,
  },
];
```

**Key elements:**

1. **Role/persona**: Sets behavioral context ("You are a...")
2. **Constraints**: What to do and what NOT to do
3. **Context**: The information the model needs
4. **Output format**: Exactly how you want the response structured
5. **Examples**: When format is complex, show don't tell

### Instruction Hierarchy

Models process instructions with implicit priority:

1. **System prompt**: Highest priority, sets overall behavior
2. **Earlier messages**: Establish context and constraints
3. **Recent messages**: Immediate task instructions
4. **Implicit expectations**: What the model infers from patterns

This hierarchy matters for:
- **Consistency**: Put invariant rules in the system prompt
- **Security**: System prompt constraints are harder (not impossible) to override
- **Debugging**: When output is wrong, check which level is being violated

### Few-Shot Prompting

For complex outputs, examples work better than descriptions:

```typescript
const systemPrompt = `Convert natural language to SQL queries.

Examples:
User: "Show me all users who signed up last month"
SQL: SELECT * FROM users WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < DATE_TRUNC('month', CURRENT_DATE);

User: "Count orders by status"
SQL: SELECT status, COUNT(*) as count FROM orders GROUP BY status;

User: "Find the top 10 customers by total spend"
SQL: SELECT customer_id, SUM(amount) as total_spend FROM orders GROUP BY customer_id ORDER BY total_spend DESC LIMIT 10;`;
```

Guidelines for examples:
- Include 2-5 examples covering different patterns
- Show edge cases you care about
- Keep examples realistic—synthetic examples teach synthetic patterns
- Match your actual output format exactly

### Chain of Thought (CoT)

For complex reasoning, ask the model to think step-by-step:

```typescript
const prompt = `Analyze whether this function has any bugs.

Think through this step by step:
1. What is the function supposed to do?
2. Trace through with a normal input
3. Trace through with edge cases (empty, null, boundary values)
4. Identify any discrepancies

Code:
\`\`\`typescript
${functionCode}
\`\`\`

After your analysis, state your conclusion: BUG FOUND or NO BUGS FOUND.`;
```

CoT improves accuracy on:
- Math and logic problems
- Multi-step reasoning
- Code analysis and debugging
- Anything requiring "working through" a problem

### Structured Output Formats

Be explicit about output format. Ambiguity causes variance.

```typescript
// Bad: Ambiguous format
const badPrompt = 'List the main points from this document';

// Good: Explicit structure
const goodPrompt = `Extract the main points from this document.

Return a JSON object with this exact structure:
{
  "summary": "One sentence overall summary",
  "mainPoints": [
    { "point": "First main point", "evidence": "Quote from document" },
    { "point": "Second main point", "evidence": "Quote from document" }
  ],
  "confidence": "high" | "medium" | "low"
}

Document:
${document}`;
```

For APIs that support it, use structured output features:

```typescript
// OpenAI's response_format parameter
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'analysis',
      schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          mainPoints: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                point: { type: 'string' },
                evidence: { type: 'string' },
              },
              required: ['point', 'evidence'],
            },
          },
        },
        required: ['summary', 'mainPoints'],
      },
    },
  },
});
```

### Prompt Debugging

When prompts don't work, debug systematically:

1. **Isolate the problem**: Which part of the output is wrong?
2. **Check the input**: Is all necessary context included?
3. **Simplify**: Remove constraints until it works, then add back
4. **Add examples**: Show the model exactly what you want
5. **Try different phrasing**: Synonyms and restructuring can help
6. **Check model fit**: Some tasks are better suited to certain models

```typescript
// Debugging workflow
const debugPrompt = (prompt: string, expectedOutput: string) => {
  console.log('=== PROMPT ===');
  console.log(prompt);
  console.log('\n=== EXPECTED ===');
  console.log(expectedOutput);
  console.log('\n=== ACTUAL ===');
  // Run and compare
};
```

Common fixes:
- "The model ignores my constraint" → Move to system prompt, add examples
- "Output format is inconsistent" → Add explicit format + examples
- "Wrong answers" → Add chain-of-thought, more context
- "Too verbose" → Add "Be concise" and max length constraints

## Trust But Verify

The single most important habit: **never trust model output without verification**.

```typescript
// Pattern: Generate then validate
async function generateWithValidation<T>(
  prompt: string,
  validate: (result: T) => boolean,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    const result = await generateFromLLM<T>(prompt);

    if (validate(result)) {
      return result;
    }

    // Log failure for debugging
    console.warn(`Validation failed on attempt ${i + 1}`, result);
  }

  throw new Error('Failed to generate valid output after retries');
}

// Usage
const sqlQuery = await generateWithValidation(
  naturalLanguageQuery,
  (sql) => {
    // Validate it's syntactically valid SQL
    // Validate it only touches allowed tables
    // Validate no dangerous operations (DROP, DELETE without WHERE)
    return isValidSQL(sql) && isAllowedQuery(sql);
  }
);
```

Verification strategies:
- **Type validation**: Parse JSON, check schema conformance
- **Syntax validation**: Lint generated code, validate SQL
- **Semantic validation**: Run tests, check invariants
- **Human review**: For high-stakes outputs, keep humans in the loop

## Agentic Workflows

When single prompts aren't enough, use agent loops.

### The Basic Agent Loop

```typescript
interface AgentState {
  goal: string;
  history: Message[];
  observations: string[];
}

async function agentLoop(initialGoal: string, tools: Tool[]): Promise<string> {
  const state: AgentState = {
    goal: initialGoal,
    history: [],
    observations: [],
  };

  for (let step = 0; step < MAX_STEPS; step++) {
    // 1. Plan: What should we do next?
    const plan = await planNextAction(state, tools);

    if (plan.type === 'complete') {
      return plan.result;
    }

    // 2. Act: Execute the planned action
    const observation = await executeAction(plan.action, tools);

    // 3. Observe: Record what happened
    state.observations.push(observation);
    state.history.push({ role: 'assistant', content: plan.reasoning });
    state.history.push({ role: 'user', content: `Observation: ${observation}` });
  }

  throw new Error('Agent exceeded maximum steps');
}
```

### When to Use Agents vs. Single Prompts

| Scenario | Approach |
|----------|----------|
| Extract data from a document | Single prompt |
| Answer a question with context | Single prompt |
| Research across multiple sources | Agent |
| Multi-step refactoring | Agent |
| Interactive debugging | Agent |
| Generate then test code | Agent |

### Agent Guardrails

Agents without guardrails are dangerous. Always include:

```typescript
const agentConfig = {
  // Stop conditions
  maxSteps: 20, // Prevent infinite loops
  maxTokenBudget: 100000, // Prevent cost explosion
  timeoutMs: 300000, // 5 minute max

  // Tool restrictions
  allowedTools: ['read_file', 'search', 'write_file'],
  blockedPatterns: [/rm -rf/, /DROP TABLE/, /DELETE FROM/],

  // Human checkpoints
  requireApprovalFor: ['write_file', 'execute_command'],
};
```

### ReAct Pattern

ReAct (Reasoning + Acting) separates thinking from doing:

```typescript
const reactPrompt = `You are an assistant that solves problems step by step.

For each step, you must output:
THOUGHT: [Your reasoning about what to do next]
ACTION: [The tool to use and its parameters]

Wait for the observation before continuing.

When you have the final answer:
THOUGHT: [Summary of findings]
ANSWER: [Your final response]

Available tools:
- search(query): Search the codebase
- read_file(path): Read a file's contents
- run_test(path): Execute a test file`;
```

This pattern:
- Makes reasoning visible and debuggable
- Separates planning from execution
- Creates natural checkpoints for human review

## Common Pitfalls

- **Over-engineering prompts.** Start simple, add complexity only when needed.
- **Prompt injection blindness.** User input in prompts can override your instructions. See [Security](../04-shipping-ai-features/security.md).
- **No fallback for failures.** Models will fail. Design for graceful degradation.
- **Ignoring model differences.** Prompts that work on GPT-4 may fail on Claude or vice versa. Test across models.

## Related

- [Context Management](./context-management.md) — How to provide effective context
- [Security](../04-shipping-ai-features/security.md) — Protecting against prompt injection
- [Multi-Agent Orchestration](../04-shipping-ai-features/multi-agent-orchestration.md) — Complex agent patterns
