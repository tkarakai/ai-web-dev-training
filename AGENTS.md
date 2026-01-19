# Agent Instructions

This repository is a practical guide for using AI in web development. It targets senior full-stack engineers who are new to AI-assisted development.

## Repository Structure

```
docs/
├── README.md                      # Main TOC and navigation
├── 01-core-concepts/              # How LLMs work, prompting, context, protocols
├── 02-governance/                 # Policies, risks, ethics, compliance
├── 03-ai-assisted-development/    # Using AI to build software faster
└── 04-shipping-ai-features/       # Building AI-powered product features (includes evals, guardrails, thinking models)
```

## Audience

- **Role:** Senior full-stack developers (5+ years experience)
- **Background:** Strong in frontend and backend development, familiar with modern web architectures
- **AI experience:** Minimal to none—this is their first serious exposure to AI tooling
- **Primary language:** TypeScript/JavaScript. Use TS for all code examples unless the topic specifically requires another language (e.g., Python for ML fine-tuning scripts)
- **Learning style:** Prefer concise explanations with practical examples over theory

## Writing Guidelines

### Voice and Tone

- **Direct and practical.** Lead with the point, not the preamble.
- **Peer-to-peer.** Write like a senior engineer explaining to another senior engineer.
- **No hype.** Avoid "revolutionary", "game-changing", "powerful". Just explain what it does.
- **Honest about limitations.** AI tools have real constraints—acknowledge them.

### Structure for Crisp Writing

1. **First sentence = the takeaway.** Don't build up to the point; start with it.
2. **One concept per paragraph.** If you're explaining two things, split into two paragraphs.
3. **Use headings liberally.** Readers scan before they read.
4. **Prefer tables over prose** for comparisons, trade-offs, and decision matrices.
5. **Show, don't describe.** Code examples > abstract explanations.

### What to Cut

- Definitions obvious to senior engineers (don't explain what an API is)
- Historical context unless directly relevant
- Excessive caveats and hedging
- Marketing language from vendor documentation
- Redundant transitions ("Now let's look at...", "As mentioned earlier...")

### Code Examples

- **Use TypeScript** for all code examples by default
- Include type annotations—they serve as documentation
- Keep examples minimal but complete (runnable when possible)
- Show realistic patterns, not toy examples
- If showing API calls, use `fetch` or standard Node.js patterns, not framework-specific clients unless the topic requires it

```typescript
// Good: Minimal, typed, realistic
async function chat(prompt: string): Promise<string> {
  const response = await fetch('https://api.example.com/v1/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

### When to Use Python

Only use Python when:
- The topic is inherently Python-ecosystem (fine-tuning with Hugging Face, ML pipelines)
- Showing tool-specific examples that only exist in Python
- Comparing language-specific approaches

When Python is necessary, keep it minimal and add a note explaining why.

## Markdown File Template

Each topic file should follow this structure:

```markdown
# Topic Name

> One-sentence summary of what this covers and why it matters.

## TL;DR

- 3-5 bullet points a senior engineer can skim in 30 seconds
- Actionable takeaways, not definitions
- What to do, not just what to know

## Core Concepts

[Main content. Crisp paragraphs, not walls of text.]

[Subheadings for each distinct concept.]

### Subtopic A

[Explanation with examples.]

### Subtopic B

[Explanation with examples.]

## In Practice

[Concrete examples, code snippets, decision frameworks.]

[This is where "practical guide" lives—real scenarios, real code.]

## Common Pitfalls

[This section is the mirror image of the  TL;DR section, except the negative side of the same, as a reminder at the end of the document]

- **Pitfall name.** Why it happens and what to do instead.
- **Another pitfall.** Brief explanation.

## Related

- [Other Topic](../section/other-topic.md) — one line on how it connects
- [External Resource](https://...) — only if genuinely useful, not filler

## Previous

[This section is only there if there is a previous document in the order defined in the README.md of the current folder]

- [Previous Topic](../section/prev-topic.md)

## Next

[This section is only there if there is a next document in the order defined in the README.md of the current folder]

- [Next Topic](../section/next-topic.md)
```

### Template Rules

| Element | Guideline |
|---------|-----------|
| Title | Match the TOC entry exactly |
| Summary quote | One sentence, starts with verb or noun, no period |
| TL;DR | 3-5 bullets, actionable, skimmable in 30 seconds |
| Core Concepts | 300-1000 words depending on topic complexity |
| In Practice | At least one code example or concrete scenario |
| Common Pitfalls | 3-5 items, brief, specific, opposite of TL;DR items |
| Related | 2-5 links max, internal preferred over external |

### File Length

- **Target:** 500-1500 words per file
- **Maximum:** 2000 words. If longer, split into subtopics.
- **Minimum:** 300 words. If shorter, consider merging with related topic.

## Section README Files

Each section directory has a README.md that:
- Introduces the section's purpose (2-3 sentences)
- Lists topics in reading order with one-line descriptions
- Notes prerequisites from other sections if any

## Cross-References

- Use relative links: `[Topic](../01-core-concepts/prompting.md)`
- Link to specific sections when relevant: `[memory hygiene](../04-shipping-ai-features/message-design-state.md#memory-and-persistence)`
- Don't over-link—only link on first mention or when genuinely helpful

## Topics from Main TOC

Reference `docs/README.md` (currently `docs/AI Web Dev_v0.1.md`) for:
- Complete list of topics to cover
- "Topics" bullets = what to explain
- "Enables you to" bullets = practical outcomes to demonstrate

## Tools, Frameworks, and Resources

**Be specific and practical.** Name actual tools, frameworks, libraries, APIs, and resources. Readers want instant usability, not abstract descriptions.

### Naming Guidelines

- **Do name:** specific tools, libraries, GitHub repos, documentation URLs
- **Do recommend:** "use X for Y" when there's a clear best choice
- **Do compare:** when multiple tools serve the same purpose, briefly explain trade-offs

### Open Source Preference

Prefer open source solutions unless a proprietary tool is the clear industry standard:

| Scenario | Approach |
|----------|----------|
| OSS is mature and capable | Use OSS, don't mention proprietary |
| Proprietary is gold standard | Lead with proprietary, mention OSS alternatives |
| Both are viable | Present both, note trade-offs (cost, features, lock-in) |

### Examples of Good Tool References

```markdown
## Good: Specific and actionable

For local LLM inference, use [Ollama](https://ollama.ai/) or
[llama.cpp](https://github.com/ggerganov/llama.cpp). Ollama is simpler
to set up; llama.cpp offers more control over quantization and memory.

For embeddings, [Voyage AI](https://www.voyageai.com/) and OpenAI's
`text-embedding-3-large` lead benchmarks. Open source alternative:
[BGE models](https://huggingface.co/BAAI/bge-large-en-v1.5) via
Hugging Face.
```

```markdown
## Bad: Vague and unhelpful

You can use various tools for local inference. There are both
open source and commercial options available. Choose based on
your requirements.
```

### Resource Links

Include links to:
- Official documentation
- GitHub repositories
- Key blog posts or papers that explain concepts well
- Community resources (Discord servers, forums) if notably active

Keep links current. Prefer permalinks or versioned docs when available.

## Enhancing Document Understanding

Use these techniques to make concepts scannable and clear:

### Definition Blocks

Use blockquote format for key term definitions at first introduction:

```markdown
> [!NOTE]
> **Term Name**: Concise definition (1-2 sentences). Focus on what it is and why it matters.
```

Example:
```markdown
> [!NOTE]
> **RAG (Retrieval-Augmented Generation)**: Architecture where an LLM's response is grounded in retrieved documents rather than relying solely on training data. Reduces hallucination and enables citing sources.
```

### ASCII Diagrams

Use ASCII diagrams to visualize:
- Process flows (sequential steps, pipelines)
- Architecture patterns (components and relationships)
- Decision trees (when to use X vs Y)
- Comparisons (side-by-side alternatives)

Guidelines:
- Keep diagrams simple—clarity over detail
- Use box drawing characters: `┌ ─ ┐ │ └ ┘ ├ ┤ ┬ ┴ ┼`
- Align elements for readability
- Add labels and arrows to show flow
- Include brief explanations below diagram

Example:
```markdown
```
Process Flow
────────────

   Input
     │
     ▼
┌─────────┐
│ Validate│
└────┬────┘
     │
     ▼
┌─────────┐
│ Process │
└────┬────┘
     │
     ▼
   Output
```
```

### Use Case Clarity

When a section applies to specific use cases, clarify upfront:

**Two main use cases:**
- **AI-assisted development**: Using AI tools to write code (IDE copilots, CLI agents)
- **AI-infused features**: Building AI capabilities into your product (chatbots, RAG systems)

Mark sections clearly:
```markdown
### Managing Context (AI-Assisted Development)

When using IDE copilots and CLI agents...

### Managing Context (Building AI Features)

When implementing RAG systems or chatbots...
```

Or use a callout:
```markdown
> **Use case:** This section applies to building AI-powered features, not day-to-day coding with AI assistants.
```

### Avoid Redundancy

Before writing "Common Pitfalls":
1. Check if pitfalls are already covered in main content
2. If yes, remove the section or consolidate
3. Only keep pitfalls that add new, actionable warnings

## Do Not

- Include time estimates ("this takes 2 weeks to learn")
- Create new top-level sections without discussion
- Use emojis in documentation
- Link to paywalled content without noting it
- Recommend abandoned projects (check last commit date)
- Add history of things, unless it is important for clarity
- Add marketing or news related content
