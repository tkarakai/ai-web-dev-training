# Product Patterns & UX

Production-ready chat interface patterns for AI applications, featuring streaming responses, confidence indicators, and source citations.

## Overview

This example demonstrates essential UX patterns for AI-powered applications:

- **Streaming Responses**: Real-time token-by-token display for better perceived performance
- **Confidence Indicators**: Visual representation of AI certainty levels (high/medium/low)
- **Source Citations**: Verifiable references with relevance scoring
- **Production Quality**: Proper error handling, loading states, and accessibility

## Running the Example

```bash
# From the examples root
cd examples
bun install
bun run dev --filter @examples/product-patterns

# Or from this directory
cd examples/02-shipping-ai-features/01-product-patterns
bun install
bun run dev
```

The app will be available at [http://localhost:3010](http://localhost:3010)

## Prerequisites

**llama-server must be running** (see [main README](../../README.md) for setup):

```bash
llama-server -hf ggml-org/gpt-oss-20b-GGUF --jinja -c 0 --host 127.0.0.1 --port 8033
```

## Features

### 1. Chat Interface (Main Page)

**URL**: `/`

The main chat interface combines all product patterns in a single, cohesive experience:

- Streaming responses with real-time display
- Confidence indicators (simulated based on response characteristics)
- Source citations (simulated for demo purposes)
- Metadata display (model, latency, token count)
- Example prompts for quick testing
- Clear message history

**Key Patterns**:
- Progressive disclosure of information
- Visual feedback during loading
- Graceful error handling
- Mobile-responsive design

### 2. Streaming Demo

**URL**: `/streaming`

Focused demonstration of streaming response patterns:

- Token-by-token display visualization
- Configurable streaming speed (slow/normal/fast)
- Token boundary visualization
- Streaming status indicators
- Connection health monitoring

**Why Stream?**
- **Faster Perceived Response**: Users see results immediately (~100-500ms for first token vs 5-10s for full response)
- **Better Engagement**: Progressive disclosure keeps users engaged
- **Cancellable**: Users can stop generation if content is irrelevant
- **Lower Latency**: First-token latency is significantly lower

**Implementation Details**:
- Protocol: Server-Sent Events (SSE)
- Buffering: Word-by-word with 50-100ms chunks
- Backpressure: Handled automatically by browser
- Error Recovery: Automatic reconnection with exponential backoff

### 3. Uncertainty Handling

**URL**: `/uncertainty`

Demonstrates confidence level communication:

- **High Confidence** (🟢): Factual, verifiable information
- **Medium Confidence** (🟡): Qualified statements, general guidance
- **Low Confidence** (🟠): Uncertain or speculative information

**Features**:
- Visual confidence indicators (color-coded badges)
- Confidence explanations
- Detection of hedging language ("maybe", "perhaps", "might")
- Detection of qualifiers ("it depends", "generally", "typically")

**Test Cases**:
1. "What is the capital of France?" → High confidence expected
2. "What might be the best programming language?" → Medium confidence expected
3. "What will be popular in 2030?" → Low confidence expected

**Why Show Confidence?**
- **Builds Trust**: Users appreciate honesty about uncertainty
- **Reduces Harm**: Prevents over-reliance on uncertain answers
- **Legal Protection**: Shows due diligence in high-stakes domains
- **User Empowerment**: Helps users make informed decisions

### 4. Citations & Sources

**URL**: `/citations`

Demonstrates source attribution patterns:

- Clickable source links with excerpts
- Relevance scoring (0-100%)
- Verified vs unverified source indicators
- Multiple citation display modes

**Citation Strategies**:
1. **RAG-Based**: Retrieve relevant documents → Include in context → LLM references sources → Return answer + metadata
2. **Post-Processing**: Generate response → Extract claims → Match to knowledge base → Add citations retroactively

**Source Quality Indicators**:
- ✅ **Verified**: Official or authoritative sources (green highlight)
- 🔗 **External**: Third-party sources requiring verification
- ⚠️ **Unverified**: Use with caution

**Demo Sources** (for testing):
- React 19 queries → Official React docs
- TypeScript queries → TypeScript handbook
- Next.js queries → Next.js documentation

## Reusable Components

This example exports production-ready components for use in other examples:

```tsx
import { ChatInterface } from '@examples/product-patterns/components';
import type { EnrichedMessage, Source, ConfidenceLevel } from '@examples/product-patterns/components';

export default function MyApp() {
  return (
    <ChatInterface
      title="My AI Assistant"
      showConfidence={true}
      showSources={true}
      showMetadata={true}
      height="700px"
      placeholder="Ask me anything..."
      enrichMessage={(msg, idx, allMessages) => {
        // Custom message enrichment logic
        return {
          ...msg,
          metadata: {
            ...msg.metadata,
            confidence: 'high',
            sources: [...],
          },
        };
      }}
    />
  );
}
```

### ChatInterface Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `"AI Assistant"` | Interface title |
| `description` | `string` | - | Optional description |
| `icon` | `ReactNode` | `<MessageSquare />` | Title icon |
| `systemPrompt` | `string` | - | Initial system prompt |
| `height` | `string` | `"600px"` | Container height |
| `showMetadata` | `boolean` | `false` | Show model/latency/tokens |
| `showConfidence` | `boolean` | `true` | Show confidence indicators |
| `showSources` | `boolean` | `true` | Show source citations |
| `placeholder` | `string` | `"Ask me anything..."` | Input placeholder |
| `onMessageSent` | `(msg: string) => void` | - | Message callback |
| `enrichMessage` | `(msg, idx, all) => EnrichedMessage` | - | Custom enrichment |

## Architecture

```
01-product-patterns/
├── app/
│   ├── page.tsx              # Main chat interface
│   ├── streaming/page.tsx    # Streaming demo
│   ├── uncertainty/page.tsx  # Confidence indicators
│   ├── citations/page.tsx    # Source citations
│   └── layout.tsx            # Root layout
├── components/
│   ├── chat-interface.tsx    # Reusable chat component (EXPORTED)
│   └── index.ts              # Component exports
├── package.json              # Exports components for other examples
├── tailwind.config.ts        # Tailwind configuration
└── README.md                 # This file
```

## Key Concepts

### 1. Progressive Building

This example is the **foundation** for later examples. Other examples import components:

```tsx
// In future examples (02-message-design, etc.)
import { ChatInterface } from '@examples/product-patterns/components';
```

### 2. Simulated Features

For educational purposes, confidence and citations are **simulated** in this demo:

- **Confidence**: Calculated based on response length and hedging language
- **Citations**: Matched based on keywords in user queries

In production, these would come from:
- RAG systems (for citations)
- LLM structured outputs (for confidence)
- Ground truth validation (for verification)

### 3. Production Patterns

All patterns follow production best practices:

✅ **DO**:
- Stream responses for better UX
- Show uncertainty when present
- Provide verifiable sources
- Handle errors gracefully
- Make interfaces accessible
- Test with real users

❌ **DON'T**:
- Hide AI uncertainty
- Make up sources
- Block UI during generation
- Ignore edge cases
- Skip error boundaries
- Over-complicate simple tasks

## Testing

```bash
# Run type checking
bun run typecheck

# Run tests (when implemented)
bun run test

# Build for production
bun run build
```

## Related Documentation

- [Product Patterns & UX](../../../docs/04-shipping-ai-features/product-patterns-ux.md)
- [Message Design](../../../docs/04-shipping-ai-features/message-design.md)
- [Output Control & Validation](../../../docs/04-shipping-ai-features/output-control-validation.md)

## Next Examples

After mastering these patterns, explore:

1. **02-message-design**: Persistent chat with Convex, conversation management
2. **03-output-control**: Structured outputs with Zod validation
3. **06-multi-agent**: Multi-agent orchestration patterns

## Troubleshooting

### llama-server not responding

**Error**: `llama-server not available at http://127.0.0.1:8033`

**Fix**: Ensure llama-server is running:
```bash
llama-server -hf ggml-org/gpt-oss-20b-GGUF --jinja -c 0 --host 127.0.0.1 --port 8033
```

### Build errors

**Error**: `Module not found: Can't resolve '@examples/shared'`

**Fix**: Install dependencies from workspace root:
```bash
cd examples
bun install
```

### Port already in use

**Error**: `Port 3010 is already in use`

**Fix**: Stop other instances or change port:
```bash
bun run dev -p 3011
```

## Contributing

When adding new patterns:

1. Follow existing structure (pages in `/app`, reusable components in `/components`)
2. Export reusable components via `components/index.ts`
3. Add comprehensive documentation
4. Include error handling and loading states
5. Test with real llama-server
6. Update this README

## License

Part of the AI Web Dev Training repository.
