# Prompting and Interaction Patterns

How to communicate with LLMs effectively—from basic prompts to agentic workflows.

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

**When typing prompts directly** (e.g., for refactoring tasks), use the same principles:
```
You are an expert React and TypeScript developer helping with code modernization.

I need to refactor this React component to use TypeScript and modern patterns.

Requirements:
- Convert to TypeScript with proper types
- Replace class component with functional component using hooks
- Keep the same functionality and behavior
- Do NOT change the component's API or prop interface
- Add comments explaining any non-obvious type decisions

[paste your component code here]

Output format:
- Refactored code
- Brief summary of key changes (3-4 bullet points)
```

Note: Many AI coding tools also let you select files or folders as additional context, which the model can reference during refactoring.

**Key elements:**

1. **Role/persona**: Sets behavioral context ("You are a...")
2. **Constraints**: What to do and what NOT to do
3. **Context**: The information the model needs
4. **Output format**: Exactly how you want the response structured
5. **Examples**: When format is complex, show don't tell

### Instruction Hierarchy

> [!NOTE]
> **Instruction Hierarchy**: The implicit priority order LLMs use when processing conflicting instructions. System prompts > earlier messages > recent messages.

Models process instructions with implicit priority:

1. **System prompt**: Highest priority, sets overall behavior
2. **Earlier messages**: Establish context and constraints
3. **Recent messages**: Immediate task instructions
4. **Implicit expectations**: What the model infers from patterns

This hierarchy matters for:
- **Consistency**: Put invariant rules in the system prompt
- **Security**: System prompt constraints are harder (not impossible) to override
- **Debugging**: When output is wrong, check which level is being violated

> [!TIP]
> This hierarchy is a useful heuristic based on typical model behavior, but it's not universal across all LLMs or guaranteed—the actual priority emerges from model architecture, training, and specific prompt content, so it should be empirically tested for your use case rather than treated as a fixed rule.

### Few-Shot Prompting

> [!NOTE]
> **Few-Shot Prompting**: Providing 2-5 input/output examples in your prompt to demonstrate the desired behavior. The model learns the pattern from examples rather than explicit rules.

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

> [!NOTE]
> **Chain of Thought (CoT)**: A prompting technique that asks the model to show its reasoning step-by-step before giving a final answer. Dramatically improves accuracy on logic, math, and multi-step problems.

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

#### Understanding Model Capabilities for Structured Output

Not all models are equally reliable at producing structured output. This capability depends on several factors:

**Training and Fine-tuning:**
- Models specifically trained on structured data tasks (like function calling or tool use) perform better
- Instruction-tuned models generally outperform base models
- Larger models tend to follow complex schemas more reliably

**What Makes a Model Good at Structured Output:**
- **Schema adherence**: Consistently follows the exact structure requested
- **Type correctness**: Returns proper data types (strings, numbers, booleans, arrays)
- **Completeness**: Includes all required fields without omitting data
- **Valid syntax**: Produces parseable JSON/XML without trailing commas or malformed brackets
- **Consistent formatting**: Doesn't add preambles like "Here's the JSON:" or wrap output in markdown code blocks

**Challenges with Smaller/Open-Source Models:**
- May struggle with complex nested structures
- Often add conversational text before/after the structured output
- More likely to hallucinate fields not in the schema
- May produce malformed JSON (missing quotes, trailing commas)
- Less reliable with strict type constraints

#### Testing Model Reliability

Before deploying, validate structured output capabilities:
```typescript
// Create a test suite
const testCases = [
  { input: 'simple case', expectedFields: ['summary', 'mainPoints'] },
  { input: 'complex nested case', expectedFields: ['summary', 'mainPoints', 'metadata'] },
  { input: 'edge case with special characters', expectedFields: ['summary'] },
];

async function testStructuredOutput(model: string) {
  const results = {
    parseSuccess: 0,
    schemaCompliance: 0,
    typeCorrectness: 0,
  };

  for (const test of testCases) {
    const response = await callModel(model, test.input);
    
    // Test 1: Can we parse it?
    try {
      const parsed = JSON.parse(response);
      results.parseSuccess++;
      
      // Test 2: Does it have required fields?
      const hasAllFields = test.expectedFields.every(field => field in parsed);
      if (hasAllFields) results.schemaCompliance++;
      
      // Test 3: Are types correct?
      if (typeof parsed.summary === 'string' && Array.isArray(parsed.mainPoints)) {
        results.typeCorrectness++;
      }
    } catch (e) {
      console.error(`Parse failed for ${model}:`, e);
    }
  }
  
  return {
    model,
    reliability: results.parseSuccess / testCases.length,
    ...results,
  };
}
```

#### Using Native Structured Output Features

For APIs that support it, use structured output features (significantly more reliable):

OpenAI's response_format parameter:

```typescript
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

Anthropic's Claude with tool use (enforces structure):
```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  tools: [{
    name: 'document_analysis',
    description: 'Analyze a document and extract main points',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'One sentence summary' },
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
  }],
  tool_choice: { type: 'tool', name: 'document_analysis' },
  messages: [{ role: 'user', content: document }],
});
```

#### Fallback Strategies for Less Reliable Models

When working with smaller models or those without native structured output:
```typescript
function extractJSON(modelResponse: string): object {
  // Strip common conversational additions
  let cleaned = modelResponse
    .replace(/^(Here's the JSON|Here is the|```json|```)/gim, '')
    .replace(/```$/gm, '')
    .trim();
  
  // Try to find JSON in the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  
  // Attempt parse with error recovery
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Try fixing common issues
    cleaned = cleaned
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Quote unquoted keys
    
    return JSON.parse(cleaned);
  }
}
```

**Model Selection Guidelines:**
- **Mission-critical applications**: Use models with native structured output support (GPT-4o, Claude Sonnet 4+)
- **High-volume applications**: Test reliability on representative samples; aim for >95% parse success
- **Open-source models**: Consider Mixtral 8x7B, LLaMA 3 70B+, or specialized models like NousResearch variants
- **Budget-constrained**: Accept lower reliability and implement robust parsing/retry logic

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

> [!NOTE]

> **Agentic Workflow**: A pattern where the LLM operates in a loop—planning actions, executing tools, observing results, and iterating until a goal is achieved. Unlike single-shot prompts, agents can take multiple steps and adapt based on outcomes.

When single prompts aren't enough, use agent loops.

### The Basic Agent Loop

```
                    ┌──────────────┐
                    │     Goal     │
                    └──────┬───────┘
                           │
                           ▼
              ┌────────────┐
              │            ▼
              │      ┌─────────┐
              │      │  PLAN   │ ◄─── What should I do next?
              │      └────┬────┘
              │           │
              │           ▼
              │      ┌─────────┐
              │      │   ACT   │ ◄─── Execute tool/action
              │      └────┬────┘
              │           │
              │           ▼
              │      ┌─────────┐
   LOOP ──────┤      │ OBSERVE │ ◄─── Record results
              │      └────┬────┘
              │           │
              │           ▼
              │     ┌───────────┐
              │     │  Done?    │
              │     └─────┬─────┘
              │       No  │  Yes
              │       ◄───┴───►
              │       │       │
              └───────┘       │
                              ▼
                       ┌──────────┐
                       │  Result  │
                       └──────────┘
```

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

### Understanding Agent Loops: Internal vs. Your Implementation

**Important distinction:** The agent loop pattern above is what AI systems use internally. When you use Claude with tools, or ask ChatGPT to browse the web, *you're already using an agent loop* - you just don't see it.

### When Should YOU Implement an Agent Loop?

| Scenario | Approach |
|----------|----------|
| Extract data from a document | Single LLM call |
| Answer a question with context | Single LLM call |
| Generate code from requirements | Single LLM call |
| **Automate your deployment pipeline** | **Build an agent** |
| **Monitor and auto-fix production issues** | **Build an agent** |
| **Process incoming support tickets** | **Build an agent** |
| **Orchestrate multi-system workflows** | **Build an agent** |

### Use Cases for Building Your Own Agent

**You should implement an agent loop when you need:**

1. **Custom business automation**: "Check inventory every hour, if low stock, generate purchase order, email supplier, update dashboard"

2. **Domain-specific workflows**: "Monitor code repo, run tests on new PRs, analyze failures, suggest fixes, re-run tests, merge if passing"

3. **Multi-system orchestration**: "New customer signs up → provision cloud resources → send credentials → update CRM → notify sales team"

4. **Continuous monitoring**: "Watch error logs, classify issues, attempt automated fixes, escalate to humans if fix fails"

**You DON'T need to build an agent loop for:**
- Tasks you'd just prompt an AI assistant to do once
- Anything that completes in a single interaction
- Simple data transformations or generation

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

> [!NOTE]
> **ReAct (Reasoning + Acting)**: A prompting framework where the model explicitly outputs its THOUGHT (reasoning) before each ACTION (tool use). Makes agent behavior transparent and debuggable.

**Historical Context**: ReAct (introduced in 2022) was one of the first frameworks to explicitly separate reasoning from acting in language models. This approach laid the foundation for today's native thinking models (like OpenAI's o1 and Claude Sonnet 4.5 with extended thinking), which internalize the reasoning process but follow similar principles of structured thought before action.

ReAct separates thinking from doing, with three main patterns:

#### Pattern 1: Zero-Shot ReAct (No Examples)

Use this when the task is straightforward and the model can infer the pattern from instructions alone.

```typescript
const zeroShotReActPrompt = `You are a code investigation assistant.

For each step, use this format:
THOUGHT: [Your reasoning about what to do next]
ACTION: [The tool to use and its parameters]
OBSERVATION: [Result from the tool]

Available tools:
- search(query): Search the codebase
- read_file(path): Read a file's contents
- run_test(path): Execute a test file

When you have enough information:
THOUGHT: [Summary of findings]
ANSWER: [Your final response]

Task: Find where user authentication is implemented and check if it uses secure password hashing.`;

// Example interaction:
// LLM: THOUGHT: I need to find authentication-related code first.
//      ACTION: search("authentication password hash")
// System: OBSERVATION: Found 3 files: auth.ts, user-model.ts, security.ts
// LLM: THOUGHT: Let me examine the auth.ts file to see the implementation.
//      ACTION: read_file("auth.ts")
// System: OBSERVATION: [file contents with bcrypt usage]
// LLM: THOUGHT: Found bcrypt implementation with salt rounds of 10. This is secure.
//      ANSWER: User authentication is in auth.ts:45-67 and uses bcrypt with 10 salt rounds, which is secure.
```

#### Pattern 2: Few-Shot ReAct (With Examples)

Use this for complex tasks where showing the pattern is clearer than describing it.

```typescript
const fewShotReActPrompt = `You are a debugging assistant that finds and explains bugs.

Example 1:
Task: Why is the login function failing?
THOUGHT: I should first find the login function.
ACTION: search("function login")
OBSERVATION: Found in auth.ts:23
THOUGHT: Let me read the implementation.
ACTION: read_file("auth.ts")
OBSERVATION: [shows code with await missing]
THOUGHT: The login function isn't awaiting the database call, causing undefined user data.
ANSWER: Bug at auth.ts:25 - missing 'await' on db.findUser(). This causes the function to return undefined before the database query completes.

Example 2:
Task: Find performance issues in the checkout flow.
THOUGHT: I need to locate checkout-related code first.
ACTION: search("checkout performance")
OBSERVATION: Found checkout.ts, payment.ts
THOUGHT: Let me check the main checkout file.
ACTION: read_file("checkout.ts")
OBSERVATION: [shows N+1 query pattern]
THOUGHT: The code loops through items and makes separate DB queries for each.
ANSWER: Performance issue at checkout.ts:34-38 - N+1 query pattern. Fetching each item individually instead of batch loading. Recommend using Promise.all() or a single query with WHERE IN clause.

Now solve this task:
Task: ${userTask}

Available tools:
- search(query): Search the codebase
- read_file(path): Read a file's contents
- run_test(path): Execute a test file
- grep(pattern, path): Search for pattern in files`;
```

#### Pattern 3: Flexible ReAct (Adaptive Structure)

Use this when you want the model to adaptively determine how much reasoning to show.

```typescript
const flexibleReActPrompt = `You are a senior engineer investigating issues.

Use this format for your investigation:
- THOUGHT: Your reasoning (use this whenever you need to plan or reflect)
- ACTION: Tool to use with parameters
- OBSERVATION: Will be provided by the system

You can:
- Chain multiple THOUGHT → ACTION cycles when solving complex problems
- Skip THOUGHT for obvious next steps
- Add multiple THOUGHT steps before ACTION when you need to reason through options
- Include ACTION without tools when you're doing mental reasoning

Available tools:
- search(query)
- read_file(path)
- grep(pattern, path)
- run_command(cmd)

Be thorough but efficient. Stop when you have a confident answer.

Task: ${userTask}`;

// This allows the model to adapt depth of reasoning:
// Simple task:
// THOUGHT: Need to find config file
// ACTION: search("config.json")
// OBSERVATION: Found at ./config.json
// ACTION: read_file("./config.json")
// ANSWER: [result]

// Complex task:
// THOUGHT: This error could be caused by database connection, auth, or network issues
// THOUGHT: Let me start with the error logs to narrow down the root cause
// ACTION: search("error connection timeout")
// OBSERVATION: Found 15 instances
// THOUGHT: That's too many. Let me check the most recent errors first
// THOUGHT: I should look at the main application entry point
// ACTION: read_file("app.ts")
// [continues with deeper investigation]
```

#### Production Considerations for ReAct

When deploying ReAct patterns in production systems:

**Parsing Reliability**
```typescript
// Robust parser for ReAct output
function parseReActStep(output: string): {
  thought?: string;
  action?: { tool: string; params: any };
  answer?: string
} {
  const thoughtMatch = output.match(/THOUGHT:\s*(.+?)(?=ACTION:|ANSWER:|$)/s);
  const actionMatch = output.match(/ACTION:\s*(\w+)\((.+?)\)/s);
  const answerMatch = output.match(/ANSWER:\s*(.+?)$/s);

  return {
    thought: thoughtMatch?.[1]?.trim(),
    action: actionMatch ? {
      tool: actionMatch[1],
      params: parseActionParams(actionMatch[2])
    } : undefined,
    answer: answerMatch?.[1]?.trim()
  };
}
```

**Cost Management**
```typescript
// ReAct patterns use more tokens than direct prompting
const config = {
  // Track costs per interaction
  maxStepsPerTask: 10, // Prevent runaway reasoning loops
  maxTokensPerStep: 500, // Limit verbose reasoning

  // Consider model tiers
  reasoningModel: 'claude-sonnet-4', // Expensive but reliable
  actionModel: 'claude-haiku', // Cheaper for simple tool execution
};
```

**Debugging and Observability**
```typescript
// Log reasoning traces for debugging
interface ReActTrace {
  taskId: string;
  steps: Array<{
    stepNum: number;
    thought: string;
    action?: string;
    observation?: string;
    timestamp: number;
  }>;
  outcome: 'success' | 'failure' | 'timeout';
}

// This makes it easy to understand why an agent made specific decisions
```

**Error Recovery**
```typescript
// Handle malformed outputs gracefully
async function executeReActStep(
  output: string,
  tools: ToolMap,
  retries = 2
): Promise<string> {
  try {
    const parsed = parseReActStep(output);

    if (parsed.answer) {
      return parsed.answer; // Task complete
    }

    if (!parsed.action) {
      throw new Error('No valid action found in output');
    }

    return await tools[parsed.action.tool](parsed.action.params);
  } catch (error) {
    if (retries > 0) {
      // Prompt model to try again with better formatting
      const clarification = `Previous output had parsing errors. Please use exact format:
THOUGHT: [reasoning]
ACTION: tool_name(parameters)`;

      return executeReActStep(
        await regenerateWithFeedback(clarification),
        tools,
        retries - 1
      );
    }
    throw error;
  }
}
```

**When NOT to Use ReAct**
- **Simple queries**: Single-step tasks don't benefit from explicit reasoning overhead
- **Latency-critical apps**: ReAct adds 20-40% more tokens/time than direct prompting
- **Native thinking models**: Models like o1 or Claude with extended thinking already do internal reasoning—adding ReAct format on top is redundant
- **High-volume automation**: Consider caching reasoning patterns or using fine-tuned models

## Common Pitfalls

- **Over-engineering prompts.** Start simple, add complexity only when needed.
- **Prompt injection blindness.** User input in prompts can override your instructions. See [Security](../04-shipping-ai-features/security.md).
- **No fallback for failures.** Models will fail. Design for graceful degradation.
- **Ignoring model differences.** Prompts that work on GPT-4 may fail on Claude or vice versa. Test across models.

## Related

- [Security](../04-shipping-ai-features/security.md) — Protecting against prompt injection
- [Multi-Agent Orchestration](../04-shipping-ai-features/multi-agent-orchestration.md) — Complex agent patterns

## Previous

- [LLM Mechanics](./llm-mechanics.md)

## Next

- [MCP Protocol Overview](./mcp-protocol.md)
