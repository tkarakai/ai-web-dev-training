# Prompting - Interactive Prompt Engineering

Learn prompt engineering through hands-on examples: zero-shot, few-shot, chain-of-thought reasoning, and basic agent loops.

## What You'll Learn

- Zero-shot vs few-shot prompting
- Chain-of-thought reasoning
- Agent loop patterns
- System vs user prompts
- Prompt debugging and iteration

## Features

### 1. Prompt Playground (`/`)
- Interactive prompt testing
- Pre-loaded examples (zero-shot, few-shot, chain-of-thought)
- System prompt customization
- Real-time conversation with llama-server

### 2. Chain-of-Thought (`/chain-of-thought`)
- Step-by-step reasoning demonstrations
- Math problems, logic puzzles, code analysis
- Visible thought process
- Error detection through reasoning

### 3. Agent Loop (`/agent`)
- Multi-step task execution
- Goal decomposition
- Iterative problem-solving
- Progress tracking

## Running This Example

### Prerequisites

**llama-server must be running:**
```bash
llama-server -hf ggml-org/gpt-oss-20b-GGUF --jinja -c 0 --host 127.0.0.1 --port 8033
```

### Start the Example

```bash
# From this directory
bun install
bun run dev

# Open http://localhost:3001
```

**Note**: This example runs on port 3001 by default (to avoid conflicts with 01-llm-mechanics).

## Key Concepts

### Zero-Shot Prompting

Direct instructions without examples:

```
Classify the sentiment: "The product is okay but shipping was slow."
```

**When to use:**
- Simple, well-defined tasks
- The model already understands the domain
- Quick classifications or transformations

### Few-Shot Prompting

Provide examples to guide the model:

```
Classify the sentiment as positive, negative, or neutral.

Examples:
- "Amazing product!" → positive
- "Terrible quality." → negative
- "Product works." → neutral

Review: "The product is okay but shipping was slow."
```

**When to use:**
- Complex or ambiguous tasks
- Domain-specific terminology
- Consistent output format required
- Better accuracy needed

**Impact**: Can improve accuracy by 20-50% vs zero-shot for complex tasks.

### Chain-of-Thought (CoT)

Encourage step-by-step reasoning:

```
Solve this problem step by step:

A store has 150 items. They sell 30% in the morning and half of
the remainder in the afternoon. How many are left?

Let's think step by step:
```

**When to use:**
- Multi-step problems (math, logic)
- Code debugging and analysis
- Complex decision-making
- When you need to verify reasoning

**Why it works:**
- Forces explicit intermediate steps
- Reduces errors in multi-step tasks
- Makes errors visible and debuggable
- Improves logical consistency

### Agent Loops

Iterative problem-solving with planning:

```
Goal: Plan a birthday party

Step 1: Break down into tasks
Step 2: Prioritize tasks
Step 3: Execute each task
Step 4: Review progress
Step 5: Adjust plan if needed
```

**Components:**
1. **Planning**: Break goal into sub-tasks
2. **Execution**: Work through tasks
3. **Observation**: Check results
4. **Iteration**: Refine approach

**Note**: This example shows a simplified agent loop. Production agents add:
- Tool use (API calls, database queries, etc.)
- Memory (context persistence across steps)
- Error recovery and retries
- Parallel task execution

## Prompting Best Practices

### 1. Be Specific

❌ Bad: "Write code for sorting"
✅ Good: "Write a Python function that sorts a list of dictionaries by a specified key in descending order"

### 2. Provide Context

❌ Bad: "Fix this bug"
✅ Good: "This Python function should return prime numbers, but it's including 1. Why?"

### 3. Request Format

❌ Bad: "List the capitals"
✅ Good: "List the capitals in JSON format: [{\"country\": \"...\", \"capital\": \"...\"}]"

### 4. Use Examples (Few-Shot)

```
Convert names to email format.

Examples:
- John Smith → john.smith@company.com
- Mary Jane → mary.jane@company.com

Convert: Robert Brown
```

### 5. Break Down Complex Tasks

For complex requests, use chain-of-thought:
- "Let's solve this step by step:"
- "First, analyze... Then, consider... Finally, conclude..."

### 6. Iterate and Refine

Prompting is iterative:
1. Start with a simple prompt
2. Test the output
3. Add constraints or examples
4. Test again
5. Refine until satisfied

## Common Patterns

### Classification

```
Classify the following as {class1}, {class2}, or {class3}:

"{text}"

Classification:
```

### Extraction

```
Extract the following information from this text:
- Name:
- Email:
- Phone:

Text: "{text}"
```

### Transformation

```
Rewrite this {source_format} as {target_format}:

Input: "{text}"

Output:
```

### Generation

```
Generate a {type} that {requirements}.

{optional_examples}

{type}:
```

## Troubleshooting

### LLM not responding

**Problem**: No response after sending prompt

**Solutions**:
1. Check llama-server is running: `curl http://localhost:8033/health`
2. Verify port 8033 is not blocked
3. Check terminal for error messages
4. Try restarting llama-server

### Inconsistent outputs

**Problem**: Different results for same prompt

**Solutions**:
1. Add more examples (few-shot)
2. Be more specific in instructions
3. Request explicit format
4. Use lower temperature (see model-routing example)

### Poor quality responses

**Problem**: Responses don't meet expectations

**Solutions**:
1. Use chain-of-thought for complex tasks
2. Provide domain-specific examples
3. Break down into simpler sub-prompts
4. Add constraints or requirements explicitly

## Try These Experiments

### 1. Compare Prompting Styles

Same task with different approaches:

**Zero-Shot**:
```
Is this code correct? <code>
```

**Few-Shot**:
```
Code review examples:
- def add(a,b): return a+b → Correct
- def sub(a b): return a-b → Syntax error: missing comma

Is this correct? <code>
```

**Chain-of-Thought**:
```
Review this code step by step:
1. Check syntax
2. Verify logic
3. Consider edge cases

<code>
```

### 2. Build a Multi-Step Agent

Try longer goals:
- "Create a 7-day workout plan"
- "Design a database schema for a blog"
- "Plan a 3-course dinner menu"

Watch how the agent breaks down and executes the plan.

### 3. Experiment with System Prompts

Try different personas:
- "You are an expert Python developer"
- "You are a helpful teacher explaining to a beginner"
- "You are a code reviewer focused on security"

Notice how the response style changes.

## Related Documentation

- [Prompting and Interaction Patterns](../../../docs/01-core-concepts/prompting.md) - Full conceptual guide
- [Day-to-Day Workflows](../../../docs/03-ai-assisted-development/day-to-day-workflows.md) - Practical prompting in development

## Next Steps

After mastering prompting:

1. **03-mcp-protocol**: Add tools to your agents
2. **01-product-patterns**: Build production UIs
3. **03-output-control**: Structure and validate responses

## Technical Notes

### Implementation

This example uses:
- `useLlama` hook from `@examples/shared/lib/hooks`
- `ChatThread` component for conversation display
- llama-server for local inference (free!)
- Real-time streaming responses

### Agent Loop Simplified

The agent loop here is educational. Production agents need:
- **Tools**: API access, file operations, database queries
- **Memory**: Long-term context and learning
- **Planning**: More sophisticated goal decomposition
- **Error handling**: Retry logic, fallbacks
- **Approval gates**: Human-in-the-loop for risky actions

See the **Multi-Agent Orchestration** example (coming later) for production patterns.
