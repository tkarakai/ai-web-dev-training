# LLM Mechanics

> Understanding how LLMs process text, generate outputs, and incur costs—the foundation for everything else.

## TL;DR

- LLMs process text as **tokens** (roughly 4 characters each); you pay per token for both input and output
- **Context window** is your budget—everything the model can "see" at once (typically 128K-200K tokens for top models)
- Model outputs are **non-deterministic by default**; identical prompts can produce different results
- **Open-source models** trade quality for control and privacy; worth it for specific use cases
- Cost = (input tokens × input price) + (output tokens × output price); output tokens cost 2-5x more

## Core Concepts

### Tokens and Tokenization

LLMs don't see text—they see tokens. A token is roughly 4 characters or ¾ of a word in English. The model breaks your input into tokens, processes them, and generates new tokens as output.

```typescript
// Rough token estimation (actual tokenization varies by model)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Examples:
// "Hello, world!" → ~4 tokens
// A typical function (50 lines) → ~400-600 tokens
// This entire document → ~2000 tokens
```

Why it matters:
- **Cost**: You pay per token, both input and output
- **Limits**: Context windows are measured in tokens
- **Truncation**: Exceed the limit and content gets cut off—usually silently

Use [OpenAI's tokenizer](https://platform.openai.com/tokenizer) or [tiktoken](https://github.com/openai/tiktoken) to count tokens precisely.

### Context Windows

The context window is everything the model can see at once: your system prompt, conversation history, any documents you've included, and the response it's generating.

| Model | Context Window | Rough Equivalent |
|-------|---------------|------------------|
| GPT-4o | 128K tokens | ~300 pages |
| Claude 3.5 Sonnet | 200K tokens | ~500 pages |
| Gemini 2.5 Pro | 1M-2M tokens | ~2500-5000 pages |

Practical implications:
- Large context ≠ free context. More tokens = more cost and latency.
- Models perform better on content near the beginning and end of context ("lost in the middle" problem)
- Context windows have expanded dramatically—use this for RAG, long documents, and multi-file code analysis

### Sampling and Temperature

LLMs are probabilistic. Given a prompt, the model calculates probabilities for every possible next token and samples from that distribution.

**Temperature** controls randomness:
- `temperature: 0` — Always pick the most likely token (deterministic-ish)
- `temperature: 0.7` — Default; balanced creativity and coherence
- `temperature: 1.0+` — More random; useful for brainstorming, risky for code

```typescript
// For code generation, prefer low temperature
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.2, // More deterministic
});
```

**Other sampling parameters:**
- `top_p` (nucleus sampling): Consider only tokens comprising the top P% of probability mass
- `top_k`: Consider only the K most likely tokens
- `seed`: Some APIs support seeds for reproducibility (but it's not guaranteed)

### Determinism and Reproducibility

Even with `temperature: 0`, LLM outputs aren't fully deterministic. Floating-point operations, GPU parallelism, and API-side batching introduce variance.

This matters for:
- **Testing**: The same test can pass or fail on different runs
- **Debugging**: Reproducing an issue requires logging the exact prompt and response
- **Production**: "Close enough" isn't good enough for structured outputs

Mitigation strategies:
1. Log everything—prompts, responses, model version, parameters
2. Use structured outputs with validation (see [Output Control](../04-shipping-ai-features/output-control.md))
3. Design for variance: test with multiple runs, use fuzzy assertions
4. Pin model versions in production (e.g., `gpt-4o-2024-11-20` not `gpt-4o`)

### Cost Structure

LLM API pricing follows a consistent pattern:

```
Total cost = (input_tokens × input_price) + (output_tokens × output_price)
```

Current pricing (January 2025, per 1M tokens):

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| GPT-4o | $2.50 | $10.00 | Good all-rounder |
| GPT-4o mini | $0.15 | $0.60 | Best value for simpler tasks |
| Claude 3.5 Sonnet | $3.00 | $15.00 | Strong for coding |
| Claude 3.5 Haiku | $0.80 | $4.00 | Fast, cheap |
| Gemini 2.5 Flash | $0.15 | $0.60 | Google's budget option |

Cost optimization:
- Output tokens cost 2-5x more than input—keep responses concise
- Use cheaper models for simple tasks (classification, extraction)
- Cache aggressively; cached tokens cost ~10% of regular price
- Batch requests when latency allows

### Latency

LLM latency has two components:

1. **Time to first token (TTFT)**: How long before the response starts streaming
2. **Tokens per second**: How fast the full response generates

Typical ranges:
- Cloud APIs: 200-500ms TTFT, 50-100 tokens/second
- Local models: Depends heavily on hardware; 10-50 tokens/second on consumer GPUs

Latency optimization:
- Stream responses to improve perceived speed
- Use smaller models for latency-sensitive paths
- Consider local models for offline or low-latency requirements
- Place API calls close to users (edge functions, regional deployments)

## Open-Source vs. Proprietary Models

This is a genuine trade-off, not a clear winner.

### When to Use Proprietary APIs (OpenAI, Anthropic, Google)

- **Quality matters most**: Top proprietary models still lead benchmarks
- **Speed to production**: No infrastructure to manage
- **Multimodal needs**: Vision, audio, tool use are more mature
- **Scale uncertainty**: Pay-per-use vs. fixed infrastructure costs

### When to Use Open-Source Models

- **Data privacy**: Sensitive data never leaves your infrastructure
- **Cost at scale**: Fixed GPU costs beat per-token pricing at high volume
- **Offline/edge**: No network dependency
- **Customization**: Fine-tuning without vendor restrictions
- **Regulatory requirements**: Data residency, audit requirements

### Running Models Locally

**Hardware requirements** (rough guidelines):

| Model Size | RAM/VRAM Needed | Example Models |
|------------|-----------------|----------------|
| 7B params | 8GB | Mistral 7B, Llama 3.1 8B |
| 13B params | 16GB | Llama 2 13B |
| 70B params | 48GB+ | Llama 3.1 70B |

**Quantization** reduces memory requirements by using lower precision:
- Q8 (8-bit): ~50% size reduction, minimal quality loss
- Q4 (4-bit): ~75% size reduction, noticeable but usable quality loss

**Key tools:**

[Ollama](https://ollama.ai/) — Easiest setup, good API, covers most use cases
```bash
# Install and run a model
ollama run llama3.1:8b
```

[llama.cpp](https://github.com/ggerganov/llama.cpp) — Maximum control, best performance, steeper learning curve

[LM Studio](https://lmstudio.ai/) — GUI-based, good for experimentation

**GPU considerations:**
- NVIDIA (CUDA): Best supported, most documentation
- Apple Silicon (Metal): Excellent for local dev on Mac
- AMD (ROCm): Improving but less mature
- CPU-only: Viable for small models, 10-20x slower than GPU

### Model Discovery

[Hugging Face](https://huggingface.co/models) is the primary source for open model weights. Filter by:
- Task (text-generation, feature-extraction)
- Library (transformers, GGUF for llama.cpp)
- Size and license

For llama.cpp, look for **GGUF** format models. [TheBloke](https://huggingface.co/TheBloke) (now continued by the community) provides quantized versions of popular models.

## Common Pitfalls

- **Ignoring token costs in prompts.** That 50-page document you're including? That's $0.50+ per request on GPT-4o.
- **Assuming determinism.** Tests that assert exact string matches will flake. Design for variance.
- **Over-specifying temperature.** Unless you have a specific reason, stick with defaults (0.7) or low values (0-0.2) for code.
- **Choosing models by vibes.** Benchmark on your actual use case. The "best" model varies by task.

## Related

- [Context Management](./context-management.md) — How to use your context window effectively
- [Prompting](./prompting.md) — How to write prompts that work
- [Model Routing](../04-shipping-ai-features/model-routing.md) — Choosing models dynamically in production
