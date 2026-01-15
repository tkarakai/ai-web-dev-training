# Tooling Ecosystem and Setup

> Choosing and configuring AI tools for development—from IDE copilots to local models.

## TL;DR

- **Three categories**: Inline autocomplete, project-aware IDE agents, CLI/terminal agents—each for different tasks
- **Match tool to task**: Autocomplete for flow-state; agents for multi-file work; CLI for delegation
- **Perceived speed ≠ actual speed**: Studies show AI can slow you down if you skip verification
- **Local models** provide privacy but require hardware; start with [Ollama](https://ollama.ai/)
- **MCP servers** extend tool capabilities—use them for docs, repo search, and integrations

## Core Concepts

### Tool Categories

**1. Inline Autocomplete (Copilots)**

Complete code as you type. Best for:
- Boilerplate and repetitive patterns
- API calls you've written before
- Test scaffolding
- Flow-state coding where you know what you want

Examples:
- [GitHub Copilot](https://github.com/features/copilot) — Most widely adopted, extensive VS Code integration
- [Codeium](https://codeium.com/) — Free tier, solid autocomplete
- [Supermaven](https://supermaven.com/) — Fast, large context window
- [Continue](https://continue.dev/) — Open-source, customizable

**2. Project-Aware IDE Agents**

Understand your codebase structure. Best for:
- Multi-file refactors
- Understanding unfamiliar code
- Generating code that fits existing patterns
- Chat-based exploration

Examples:
- [Cursor](https://cursor.sh/) — Full IDE replacement, highest ratings (~4.9/5)
- [Windsurf](https://codeium.com/windsurf) — Codeium's IDE, strong context awareness
- [Zed](https://zed.dev/) — Fast native editor with AI features

**3. CLI/Terminal Agents**

Run in your terminal, execute commands, modify files. Best for:
- Large autonomous tasks
- Repo-wide changes
- Tasks requiring shell access
- Delegation-style work

Examples:
- [Claude Code](https://claude.com/claude-code) — Anthropic's CLI, strong for complex tasks
- [aider](https://aider.chat/) — Open-source, git-aware, multiple model support
- [OpenAI Codex CLI](https://platform.openai.com/docs/guides/code) — OpenAI's offering

### Choosing the Right Tool

| Task | Best Tool Type | Why |
|------|---------------|-----|
| Writing a function you know | Autocomplete | Flow-state, minimal context switching |
| Understanding new codebase | IDE agent + chat | Needs project context |
| Multi-file refactor | IDE agent or CLI | Needs cross-file awareness |
| Large migration | CLI agent | Needs autonomy, file access |
| Quick question | Chat | Fastest for one-off queries |
| Debugging specific bug | IDE agent | Needs code context, iteration |

### The Speed Trap

Studies show perceived productivity gains don't always translate to actual time savings:

> "Developers who felt about 20% faster with AI assistants sometimes actually took 19% longer to finish tasks once debugging and cleanup were included."

**Why this happens:**
- Accepting code without understanding
- Debugging hallucinated APIs
- Fixing subtle bugs in generated code
- Context switching between accepting and verifying

**How to avoid it:**
- Understand before accepting
- Run tests immediately
- Treat generated code as a draft, not final
- Know when manual coding is faster

### Tool Selection Strategy

```typescript
// Mental model for tool selection
function chooseTool(task: Task): ToolType {
  if (task.requiresShellAccess || task.isLargeAutonomous) {
    return 'cli-agent';
  }

  if (task.spansMultipleFiles || task.requiresCodebaseContext) {
    return 'ide-agent';
  }

  if (task.isFlowStateCoding || task.isRepetitivePattern) {
    return 'autocomplete';
  }

  return 'ide-agent'; // Default for unknown
}
```

## Local Models

Running models locally provides data privacy—prompts never leave your machine.

### When to Use Local Models

| Scenario | Local Model Fit |
|----------|-----------------|
| Sensitive proprietary code | Good fit |
| Offline development | Good fit |
| Cost-sensitive high volume | Good fit |
| Maximum quality needed | Use cloud APIs |
| Complex reasoning tasks | Use cloud APIs |
| Tight latency requirements | Depends on hardware |

### Hardware Requirements

| Model Size | VRAM/RAM Needed | Example Hardware |
|------------|-----------------|------------------|
| 7-8B params | 8GB | MacBook Pro M1/M2, RTX 3060 |
| 13B params | 16GB | MacBook Pro M2 Pro, RTX 4070 |
| 34B params | 24GB+ | Mac Studio M2 Ultra, RTX 4090 |
| 70B+ params | 48GB+ | Multiple GPUs, Mac Studio Max |

### Getting Started with Ollama

[Ollama](https://ollama.ai/) is the easiest way to run local models:

```bash
# Install (macOS)
brew install ollama

# Or download from https://ollama.ai/download

# Start the service
ollama serve

# Pull and run a model
ollama run llama3.1:8b

# For coding, try:
ollama run codellama:7b
ollama run deepseek-coder:6.7b
```

**Configure with your IDE:**

Most AI-enabled IDEs can connect to Ollama's API at `http://localhost:11434`.

```json
// Example: Continue configuration (~/.continue/config.json)
{
  "models": [
    {
      "title": "Ollama Llama3.1",
      "provider": "ollama",
      "model": "llama3.1:8b"
    }
  ]
}
```

### llama.cpp for Maximum Control

[llama.cpp](https://github.com/ggerganov/llama.cpp) offers more control than Ollama:

```bash
# Build from source
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make -j

# Run with specific quantization
./main -m models/llama-3.1-8b-q4_k_m.gguf \
  -n 512 \
  --temp 0.2 \
  -p "Implement a function that..."
```

**GGUF format**: The standard for quantized models. Find models on [Hugging Face](https://huggingface.co/models?library=gguf).

### Model Recommendations

| Use Case | Recommended Model | Size |
|----------|-------------------|------|
| General coding | Llama 3.1 8B | 8B |
| Code-specific tasks | DeepSeek Coder 2 | 7-16B |
| Instruction following | Mistral 7B Instruct | 7B |
| Long context | Llama 3.1 (128K context) | 8B+ |

## MCP for Developer Tooling

Model Context Protocol (MCP) extends AI tools with external capabilities.

### Useful MCP Servers for Development

| Server | Purpose | Setup |
|--------|---------|-------|
| [filesystem](https://github.com/modelcontextprotocol/servers) | Read/write local files | Official |
| [github](https://github.com/modelcontextprotocol/servers) | GitHub operations | Official |
| [Context7](https://github.com/upstash/context7) | Up-to-date library docs | Community |
| [postgres](https://github.com/modelcontextprotocol/servers) | Database queries | Official |
| [Playwright](https://github.com/anthropics/mcp-servers) | Browser automation | Community |

### Configuration Example

```json
// ~/.config/claude-code/config.json or similar
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./src"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### Security Considerations

MCP servers have elevated privileges. Follow these practices:

```typescript
// Good: Scoped to project directory
{ "args": ["./src", "./tests"] }

// Bad: Full filesystem access
{ "args": ["/"] }

// Good: Read-only when possible
{ "args": ["--read-only", "./docs"] }

// Required: Auth for remote servers
{ "headers": { "Authorization": "Bearer ${TOKEN}" } }
```

## In Practice

### Recommended Setup for Full-Stack Development

**Minimal setup:**
1. GitHub Copilot or Codeium for autocomplete
2. Your existing IDE (VS Code, JetBrains)
3. Claude, ChatGPT, or similar for chat

**Intermediate setup:**
1. Cursor or Windsurf as primary IDE
2. Claude Code or aider for CLI tasks
3. Ollama for offline/private work

**Advanced setup:**
1. Cursor with custom MCP servers
2. Claude Code for autonomous tasks
3. Local models for sensitive code
4. Custom evals for quality control

### Configuration Checklist

- [ ] Primary IDE with AI features configured
- [ ] API keys in environment variables (not committed)
- [ ] Local model available for offline/sensitive work
- [ ] MCP servers for frequently-used integrations
- [ ] Keyboard shortcuts memorized for efficiency

## Common Pitfalls

- **Tool hopping.** Pick tools and learn them deeply; switching costs time.
- **Over-relying on one tool.** Different tasks need different tools.
- **Ignoring verification.** Speed gains evaporate if you ship bugs.
- **Under-utilizing context.** Feed relevant code to get relevant suggestions.

## Related

- [Day-to-Day Workflows](./day-to-day-workflows.md) — Using tools effectively
- [MCP Protocol Overview](../01-core-concepts/mcp-protocol.md) — How MCP works
- [LLM Mechanics](../01-core-concepts/llm-mechanics.md) — Understanding local model tradeoffs
