# Context Management

> How to provide the right information to LLMs—maximizing accuracy while avoiding overload and leakage.

## TL;DR

- Context is your most valuable resource: **relevant context dramatically improves output quality**
- More context isn't always better—**focus beats volume**
- Long conversations drift; use **summaries and checkpoints** to stay on track
- **Never put secrets or PII in prompts** unless you've verified the provider's data handling
- Write **LLM-friendly documentation**: explicit contracts, examples, edge cases

## Core Concepts

### What Goes in Context

Everything the model sees forms its context:

```typescript
// The context window contains ALL of this:
const totalContext = [
  systemPrompt,           // Your instructions and constraints
  conversationHistory,    // Previous messages in this thread
  retrievedDocuments,     // RAG results, file contents
  userMessage,            // Current request
  // ... and the response being generated
].join('');

// If totalContext exceeds the model's limit, you have a problem
```

Context directly impacts:
- **Accuracy**: More relevant context → better answers
- **Cost**: More tokens → higher bills
- **Latency**: More tokens → slower responses
- **Focus**: Irrelevant context → confused outputs

### The Relevance Principle

Include information that's:
- **Directly relevant** to the current task
- **Not inferrable** from common knowledge
- **Necessary** for correct behavior

Exclude:
- Information the model already knows
- Tangentially related content
- Duplicate or redundant information

```typescript
// Bad: Dumping everything
const badContext = `
Here's our entire codebase documentation...
[50 pages of docs]

Now answer this question about the login function.
`;

// Good: Focused context
const goodContext = `
Here's the login function and its tests:
\`\`\`typescript
${loginFunction}
\`\`\`

Related types:
\`\`\`typescript
${authTypes}
\`\`\`

Question: Why does login fail when the session token is expired?
`;
```

### Context Window Strategies

When content exceeds your context window:

**1. Chunking**: Split large documents into smaller pieces

```typescript
function chunkDocument(text: string, maxTokens: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split('\n\n');

  let currentChunk = '';
  for (const paragraph of paragraphs) {
    if (estimateTokens(currentChunk + paragraph) > maxTokens) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += '\n\n' + paragraph;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
```

**2. Summarization**: Condense verbose content

```typescript
async function summarizeForContext(
  longDocument: string,
  focusArea: string
): Promise<string> {
  const response = await llm.chat({
    messages: [
      {
        role: 'system',
        content: 'Summarize the following document, focusing on information relevant to the specified area. Preserve specific details, code snippets, and technical specifications.',
      },
      {
        role: 'user',
        content: `Focus area: ${focusArea}\n\nDocument:\n${longDocument}`,
      },
    ],
  });

  return response.content;
}
```

**3. Retrieval**: Only include what's relevant (RAG)

```typescript
async function getRelevantContext(
  query: string,
  documents: Document[],
  maxChunks: number = 5
): Promise<string> {
  // Embed the query
  const queryEmbedding = await embed(query);

  // Find most similar chunks
  const ranked = documents
    .map((doc) => ({
      doc,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxChunks);

  return ranked.map((r) => r.doc.content).join('\n\n---\n\n');
}
```

### Managing Long Conversations

Long conversations drift. The model loses track of earlier context and constraints.

**Problem signs:**
- Model forgets earlier decisions
- Contradicts previous statements
- Ignores constraints from earlier in the thread
- Quality degrades over time

**Solution: Periodic summaries**

```typescript
interface ConversationState {
  summary: string;           // Condensed history
  recentMessages: Message[]; // Last N messages in full
  keyDecisions: string[];    // Important choices made
  constraints: string[];     // Active constraints
}

async function compactConversation(
  messages: Message[],
  keepRecent: number = 10
): Promise<ConversationState> {
  const recent = messages.slice(-keepRecent);
  const older = messages.slice(0, -keepRecent);

  if (older.length === 0) {
    return {
      summary: '',
      recentMessages: recent,
      keyDecisions: [],
      constraints: [],
    };
  }

  const summaryResponse = await llm.chat({
    messages: [
      {
        role: 'system',
        content: `Summarize this conversation history. Extract:
1. A brief narrative summary
2. Key decisions made
3. Active constraints or requirements

Be concise but preserve important technical details.`,
      },
      {
        role: 'user',
        content: older.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
      },
    ],
  });

  // Parse the summary response into structured data
  return parseSummaryResponse(summaryResponse.content, recent);
}
```

**Use checkpoints** for long tasks:

```typescript
// After each major step
const checkpoint = {
  completedSteps: ['setup', 'data-model', 'api-routes'],
  currentStep: 'authentication',
  decisions: {
    authMethod: 'JWT',
    sessionDuration: '24h',
  },
  nextSteps: ['testing', 'deployment'],
};

// Include checkpoint in subsequent prompts
const prompt = `
## Current State
${JSON.stringify(checkpoint, null, 2)}

## Task
Continue with ${checkpoint.currentStep}...
`;
```

### Avoiding Data Leakage

LLM prompts can become training data (depending on provider). Treat them accordingly.

**Never include in prompts:**
- API keys, passwords, tokens
- Personal Identifiable Information (PII)
- Customer data
- Proprietary business logic (if concerned about IP)

**Before including data:**

```typescript
function sanitizeForLLM(content: string): string {
  return content
    // Remove obvious secrets
    .replace(/(['"]?)(?:api[_-]?key|secret|password|token)(['"]?)\s*[:=]\s*(['"])[^'"]+\3/gi, '$1$2$3: [REDACTED]$3')
    // Remove emails
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    // Remove phone numbers
    .replace(/\+?[\d\s-]{10,}/g, '[PHONE]')
    // Remove credit card patterns
    .replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, '[CARD]');
}
```

**Provider data policies vary:**
- OpenAI: Opt-out of training via API settings
- Anthropic: Doesn't train on API data by default
- Check your provider's current terms

### LLM-Friendly Documentation

If your documentation will be used as LLM context (for agents, RAG, or direct inclusion), write it accordingly.

**Good LLM-friendly docs:**

```markdown
# createUser(data: UserInput): Promise<User>

Creates a new user account.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data.email | string | Yes | Valid email address |
| data.password | string | Yes | Min 8 characters |
| data.name | string | No | Display name |

## Returns

A `User` object with `id`, `email`, `name`, `createdAt`.

## Errors

- `ValidationError`: Invalid email or password too short
- `ConflictError`: Email already registered

## Example

\`\`\`typescript
const user = await createUser({
  email: 'test@example.com',
  password: 'securepassword123',
  name: 'Test User',
});
// Returns: { id: '123', email: 'test@example.com', ... }
\`\`\`

## Do NOT

- Call without email validation
- Store plain text passwords (handled internally)
- Call in loops without rate limiting
```

**Key principles:**
- Explicit parameter tables (not prose descriptions)
- Concrete examples with realistic values
- Error conditions listed explicitly
- "Do NOT" sections for common mistakes
- Stable headings for retrieval

### Handling Stale Documentation

Models have training cutoff dates. Documentation may be newer than the model's knowledge.

**Solutions:**

1. **Include docs directly in context** (simplest)

```typescript
const prompt = `
Use this documentation (may differ from your training):

${currentDocs}

Now implement: ${task}
`;
```

2. **Use retrieval tools** (RAG, MCP servers)

```typescript
// MCP server for documentation
const docServer = {
  tools: [
    {
      name: 'search_docs',
      description: 'Search current API documentation',
      parameters: { query: 'string' },
    },
    {
      name: 'get_doc',
      description: 'Get documentation for a specific function',
      parameters: { functionName: 'string' },
    },
  ],
};
```

3. **Convert web docs to Markdown snapshots**

```bash
# Example: Download and convert React docs
npx @anthropic-ai/doc-snapshot https://react.dev/reference --output ./docs/react
```

4. **Use Context7 MCP server** for popular libraries

[Context7](https://github.com/upstash/context7) provides up-to-date documentation for popular libraries, automatically converted to LLM-friendly format.

## Common Pitfalls

- **Context stuffing.** More context isn't always better. Irrelevant context confuses models.
- **Forgetting the model's knowledge.** Don't explain JavaScript syntax to an LLM. Explain your specific code.
- **No sanitization.** Always check for secrets before sending to LLM APIs.
- **Ignoring context limits.** Silent truncation causes mysterious failures. Monitor token counts.

## Related

- [LLM Mechanics](./llm-mechanics.md) — Context windows and token costs
- [RAG Systems](../04-shipping-ai-features/rag-systems.md) — Production retrieval systems
- [Message Design](../04-shipping-ai-features/message-design-state.md) — Managing state in applications
