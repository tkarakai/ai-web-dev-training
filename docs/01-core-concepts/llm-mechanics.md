# LLM Mechanics

Understanding how LLMs process text, generate outputs, and incur costs—the foundation for everything else.

## TL;DR

- LLMs process text as **tokens** (roughly 4 characters each); you pay per token for both input and output
- **Context window** is your budget—everything the model can "see" at once (typically 128K-200K tokens for top models)
- Model outputs are **non-deterministic by default**; identical prompts can produce different results
- **Open-source models** trade quality for control and privacy; worth it for specific use cases
- Cost = (input tokens × input price) + (output tokens × output price); output tokens cost 2-5x more

## Core Concepts

### Tokens and Tokenization

> [!NOTE]
> **Token**: The smallest unit of text an LLM processes. Not characters, not words—tokens. Roughly 4 characters or ¾ of a word in English. `"hello"` = 1 token; `"anthropomorphic"` = 4 tokens.

LLMs don't see text—they see tokens. The model breaks your input into tokens, processes them, and generates new tokens as output.
v
```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM Request/Response Flow                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Your Text           Tokenizer            Model                │
│   ──────────         ───────────          ────────              │
│                                                                 │
│   "Hello, world!"  →  [15496, 11,   →    [Neural    →  [2159]   │
│                        1917, 0]           Network]              │
│                                                                 │
│        │                  │                  │            │     │
│        │                  │                  │            ▼     │
│        │                  │                  │       Detokenize │
│        │                  │                  │            │     │
│        ▼                  ▼                  ▼            ▼     │
│   Input Text         Token IDs          Prediction    "Hi!"     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

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

> [!NOTE]
> **Context Window**: The maximum number of tokens an LLM can process in a single request. This includes your prompt *and* the model's response. Think of it as the model's "working memory."

| Model | Context Window | Rough Equivalent |
|-------|---------------|------------------|
| GPT-4o | 128K tokens | ~300 pages |
| Claude 3.5 Sonnet | 200K tokens | ~500 pages |
| Gemini 2.5 Pro | 1M-2M tokens | ~2500-5000 pages |

Practical implications:
- Large context ≠ free context. More tokens = more cost and latency.
- Models perform better on content near the beginning and end of context ("lost in the middle" problem)
- Context windows have expanded dramatically—use this for RAG, long documents, and multi-file code analysis

### What Goes in Context

Everything the model sees forms its context. The context window contains:
- **System prompt**: Your instructions and constraints
- **Conversation history**: Previous messages in the thread
- **Retrieved documents**: RAG results, file contents
- **User message**: Current request
- **Model response**: The output being generated

All of this counts toward your token limit and affects:
- **Accuracy**: More relevant context leads to better answers
- **Cost**: More tokens means higher bills
- **Latency**: More tokens means slower responses
- **Focus**: Irrelevant context leads to confused outputs

If the total context exceeds the model's limit, content gets cut off—usually silently, often from the middle.

### The Relevance Principle

> [!NOTE]
> **Context Relevance**: The degree to which provided information directly helps answer the current question. High relevance produces accurate answers. Low relevance causes confusion, hallucination, or wasted tokens.

```
  ┌─────────────────┐     ┌─────────────────┐
  │ HIGH RELEVANCE  │     │  LOW RELEVANCE  │
  │                 │     │                 │
  │ • Login code    │     │ • Entire repo   │
  │ • Auth types    │     │ • Unrelated     │
  │ • Error logs    │     │   modules       │
  │                 │     │ • Generic docs  │
  └────────┬────────┘     └────────┬────────┘
           │                       │
           ▼                       ▼
      ┌─────────┐            ┌───────────┐
      │  GOOD   │            │   POOR    │
      │ Focused │            │ Confused  │
      │ Correct │            │ Verbose   │
      └─────────┘            └───────────┘
```

**Include information that's:**
- Directly relevant to the current task
- Not inferrable from common knowledge
- Necessary for correct behavior

**Exclude:**
- Information the model already knows
- Tangentially related content
- Duplicate or redundant information

**Example comparison:**

Bad approach - dumping everything:
```
Here's our entire codebase documentation...
[50 pages of docs]

Now answer this question about the login function.
```

Good approach - focused context:
```
Here's the login function and its tests:
[actual login function code]

Related types:
[relevant type definitions]

Question: Why does login fail when the session token is expired?
```

The focused approach is faster, cheaper, and produces better results.

### Sampling and Temperature

> [!NOTE]
> **Sampling**: The process of selecting the next token from a probability distribution. The model doesn't "know" what comes next—it predicts probabilities and picks one.

> [!NOTE]
> **Temperature**: A parameter (0-2) controlling randomness in token selection. Lower = more deterministic and focused. Higher = more random and creative.

LLMs are probabilistic. Given a prompt, the model calculates probabilities for every possible next token and samples from that distribution.

```
Temperature Effect on Token Selection
─────────────────────────────────────

Prompt: "The capital of France is"

Next token probabilities:     temp=0         temp=0.7        temp=1.5
                              ───────        ────────        ────────
  "Paris"     → 85%           ✓ Always       ✓ Usually       ✓ Often
  "the"       → 8%            ✗ Never        ✗ Rarely        ? Sometimes
  "a"         → 4%            ✗ Never        ✗ Rarely        ? Sometimes
  "located"   → 2%            ✗ Never        ✗ Very rare     ? Occasionally
  "unknown"   → 1%            ✗ Never        ✗ Very rare     ? Occasionally
```

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

> [!NOTE]
> **top_p (nucleus sampling)**: Only consider tokens that together make up P% of probability mass. `top_p=0.9` means ignore the bottom 10% of unlikely tokens.

> [!NOTE]
> **top_k**: Only consider the K most likely next tokens. `top_k=50` ignores all but the 50 most probable options.

- `top_p`: Consider only tokens comprising the top P% of probability mass
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

#### LLM pricing cheat sheet (checked Jan 15, 2026)

Prices are **USD per 1M tokens** unless otherwise noted.

Some providers also offer **cached input**, **batch**, or **priority** tiers; this sheet lists the most common “standard” rates where applicable.

**OpenAI (Standard tier)**

| Model | Input ($/1M) | Output ($/1M) | Notes |
|---|---:|---:|---|
| gpt-5.2 | 1.75 | 14.00 | Flagship GPT-5 family |
| gpt-5.1 | 1.25 | 10.00 | Slightly cheaper GPT-5 variant |
| gpt-5-mini | 0.25 | 2.00 | Best value in GPT-5 family |
| gpt-4o | 2.50 | 10.00 | Strong all‑rounder |
| gpt-4o-mini | 0.15 | 0.60 | Great for simple / high‑volume tasks |
| gpt-4.1 | 2.00 | 8.00 | Newer general model line |
| o1 | 15.00 | 60.00 | Reasoning model (higher cost) |
| o4-mini | 1.10 | 4.40 | Lower‑cost reasoning |


**Anthropic (Claude Developer Platform)**

| Model | Input ($/1M) | Output ($/1M) | Notes |
|---|---:|---:|---|
| Claude Opus 4.5 | 5.00 | 25.00 | Top-end Claude |
| Claude Sonnet 4.5 | 3.00 | 15.00 | Strong coding + agents |
| Claude Haiku 4.5 | 1.00 | 5.00 | Fast + cost-efficient |


**Google (Gemini API)**

| Model | Input ($/1M) | Output ($/1M) | Notes |
|---|---:|---:|---|
| Gemini 3 Pro Preview | 1.00 / 2.00 | 6.00 / 9.00 | Tiered by prompt size: **<=200k / >200k** tokens |
| Gemini 3 Flash Preview | 0.50 | 3.00 | Fast, strong grounding/search focus |
| Gemini 2.5 Flash | 0.30 | 2.50 | General “flash” tier |
| Gemini 2.5 Flash-Lite | 0.10 | 0.40 | Cheapest text tier |


**Popular open(-weights) models on OpenRouter**

> [!TIP]
> OpenRouter prices can vary by route/provider; rows below reflect the model listing prices shown on OpenRouter.

| Model (OpenRouter) | Input ($/1M) | Output ($/1M) | Why it’s popular |
|---|---:|---:|---|
| Meta: Llama 3.1 8B Instruct | 0.02 | 0.05 | Ultra-cheap + fast baseline |
| Meta: Llama 3.3 70B Instruct | 0.10 | 0.32 | Big open model, strong chat quality |
| Qwen: Qwen3 32B | 0.08 | 0.24 | Great price/perf mid-size model |
| Qwen: Qwen2.5 72B Instruct | 0.12 | 0.39 | Strong general 70B-class model |
| DeepSeek: V3.2 Exp | 0.25 | 0.38 | Popular for reasoning/coding per $ |
| DeepSeek: R1 | 0.70 | 2.40 | “Open reasoning” flagship (higher cost) |
| Mistral: Mixtral 8x7B Instruct | 0.54 | 0.54 | Classic MoE instruct model |

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

> [!NOTE]
> **Quantization**: Compressing model weights from 32-bit or 16-bit floats to lower precision (8-bit, 4-bit). Trades some quality for dramatically reduced memory and faster inference.

**Quantization** reduces memory requirements by using lower precision:
- Q8 (8-bit): ~50% size reduction, minimal quality loss
- Q4 (4-bit): ~75% size reduction, noticeable but usable quality loss

**Key tools:**

[Ollama](https://ollama.ai/) — Easiest setup, good API, covers most use cases

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

- [Day-to-Day Workflows](../03-ai-assisted-development/day-to-day-workflows.md) — Managing context in AI-assisted development
- [RAG Systems](../04-shipping-ai-features/rag-systems.md) — Context window management strategies for production
- [Model Routing](../04-shipping-ai-features/model-routing.md) — Choosing models dynamically in production

## Next:

- [Prompting and Interaction Patterns](./prompting.md)
