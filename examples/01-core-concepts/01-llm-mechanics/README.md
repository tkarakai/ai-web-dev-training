# LLM Mechanics - Interactive Learning Tool

Interactive educational tools for understanding how LLMs work: tokenization, context windows, sampling parameters, and cost calculation.

## What You'll Learn

- How text is converted into tokens
- Token estimation strategies
- Context window limits and management
- Sampling parameters (temperature, top-p, top-k)
- API cost calculation across different models

## Features

### Token Visualizer
- Real-time token estimation as you type
- Character and word count
- Comparison of simple vs accurate estimation methods
- Sample texts for quick testing

### Cost Calculator
- Cost estimates for major LLM providers
- Per-model pricing (GPT-4o, Claude, Gemini, local models)
- Input vs output token costs
- Cost breakdown and totals

### Context Window Simulator (Coming Soon)
- Visualize context window limits
- See how messages fit in context
- Understand "lost in the middle" problem

### Sampling Playground (Coming Soon)
- Interactive temperature slider
- Compare outputs at different temperatures
- Explore top-p and top-k parameters

## Running This Example

```bash
# From this directory
bun install
bun run dev

# Open http://localhost:3000
```

**Note**: This example does **not** require llama-server or any AI API access. It's a pure frontend educational tool.

## Key Concepts

### Tokens

Tokens are the smallest unit of text an LLM processes. They're not characters, not words — they're somewhere in between:

- `"hello"` = 1 token
- `"anthropomorphic"` = 4 tokens
- `" world"` = 1 token (note the leading space)

Why tokens matter:
- **Cost**: You pay per token (input + output)
- **Limits**: Context windows are measured in tokens
- **Truncation**: Exceed the limit and content gets cut off

### Token Estimation

This example uses two estimation methods:

1. **Simple** (~4 chars/token): Fast but less accurate
2. **Accurate** (word + char hybrid): Better approximation

For production, use precise tokenizers:
- OpenAI: [tiktoken](https://github.com/openai/tiktoken)
- Claude: Anthropic's tokenizer
- Or your model's specific tokenizer

### Context Windows

The context window is the maximum number of tokens an LLM can process in one request:

| Model | Context Window | Equivalent |
|-------|---------------|------------|
| GPT-4o | 128K tokens | ~300 pages |
| Claude 3.5 Sonnet | 200K tokens | ~500 pages |
| Gemini 2.5 Pro | 1M tokens | ~2500 pages |

Important: Large context ≠ free context. More tokens = more cost and latency.

### Cost Structure

All LLM APIs follow this pattern:

```
Total cost = (input_tokens × input_price) + (output_tokens × output_price)
```

Key points:
- **Output costs more**: 2-5x more expensive than input
- **Caching helps**: Cached tokens cost ~10% of regular price
- **Local is free**: Models like llama.cpp have zero API costs

### Model Pricing (Jan 2026)

This example includes up-to-date pricing for:

- **OpenAI**: GPT-5, GPT-4o, o1, and mini variants
- **Anthropic**: Claude Opus, Sonnet, Haiku 4.5
- **Google**: Gemini 3 Pro/Flash, Gemini 2.5 variants
- **Local**: gpt-oss-20b (free!)

Pricing is per 1M tokens. Example:

```
GPT-4o-mini:
- Input: $0.15/1M tokens
- Output: $0.60/1M tokens

For 1000 input + 500 output tokens:
- Input cost: (1000 / 1,000,000) × $0.15 = $0.00015
- Output cost: (500 / 1,000,000) × $0.60 = $0.0003
- Total: $0.00045
```

## Try It Out

1. **Start with samples**: Click "Short", "Function", or "Paragraph" to see pre-loaded examples
2. **Paste your own text**: Try a long document, code file, or conversation
3. **Switch models**: See how costs vary dramatically between models
4. **Notice the patterns**:
   - More tokens = higher cost (obviously)
   - Output tokens cost 2-5x more than input
   - Local models (gpt-oss-20b) are free!

## Common Observations

### Why are output tokens more expensive?

Generating tokens is computationally expensive. The model must:
1. Process all previous context
2. Calculate probabilities for next token
3. Sample from distribution
4. Repeat for each output token

Input processing is parallelizable; output generation is sequential.

### Why estimate when I can count precisely?

For quick calculations and learning, estimation is fine. For production:
- Use tiktoken for OpenAI models
- Use model-specific tokenizers
- Count tokens before API calls (avoid surprises)

### How do I reduce costs?

1. **Use cheaper models** for simple tasks (classification, extraction)
2. **Keep prompts concise** — every token costs money
3. **Limit output length** with `max_tokens`
4. **Cache aggressively** — cached tokens cost ~10%
5. **Go local** for high-volume, privacy-sensitive, or offline use

## Related Documentation

- [LLM Mechanics](../../../docs/01-core-concepts/llm-mechanics.md) - Full conceptual guide
- [Model Routing](../../../docs/04-shipping-ai-features/model-routing.md) - Choose models dynamically
- [API Integration](../../../docs/04-shipping-ai-features/api-integration.md) - Caching and optimization

## Next Steps

After understanding tokens and costs:

1. **02-prompting**: Learn prompt engineering patterns
2. **03-mcp-protocol**: Explore tool-use patterns
3. **01-product-patterns**: Build production UIs

## Technical Notes

### Implementation

This example uses:
- Token estimation utilities from `@examples/shared/lib/utils/tokens`
- Model pricing constants (updated Jan 2026)
- React state for interactivity
- No external APIs (fully offline)

### Limitations

- **Estimates only**: Not byte-perfect tokenization
- **English-focused**: Accuracy varies for other languages
- **Simplified**: Doesn't account for special tokens, BPE edge cases

For precise counts, integrate tiktoken or your model's tokenizer.
