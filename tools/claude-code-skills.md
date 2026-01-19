# Claude Code Plugins & Skills

> Extend Claude Code with commands, agents, skills, and hooks

## TL;DR

- Plugins extend Claude Code with commands, agents, skills, and hooks
- Official plugins at [github.com/anthropics/claude-code/plugins](https://github.com/anthropics/claude-code/tree/main/plugins)
- Key plugins: `frontend-design` (distinctive UIs), `/code-review` (parallel PR review), `/feature-dev` (structured development)
- Install via `.claude/settings.json` configuration
- Create custom plugins with `/plugin-dev:create-plugin`

## How Skills Work

Skills are pre-defined instruction sets that Claude loads when invoked. They:
1. Inject a specialized system prompt
2. May have access to specific tools
3. Follow a defined workflow for their task
4. Return structured output when complete

```
┌─────────────────────────────────────────┐
│         User: /commit                   │
│                   │                     │
│                   ▼                     │
│    ┌─────────────────────────────┐     │
│    │   Skill Instructions        │     │
│    │   - Check git status        │     │
│    │   - Review staged changes   │     │
│    │   - Write commit message    │     │
│    │   - Execute commit          │     │
│    └─────────────────────────────┘     │
│                   │                     │
│                   ▼                     │
│         Commit completed                │
└─────────────────────────────────────────┘
```

## Built-in Commands

These are always available:

| Command | Description |
|---------|-------------|
| `/help` | Show available commands and usage |
| `/clear` | Clear conversation history |
| `/compact` | Summarize conversation to save context |
| `/cost` | Show token usage for current session |
| `/quit` | Exit Claude Code |
| `/tasks` | List running and completed background tasks |

## Official Plugins

Anthropic maintains official plugins at [github.com/anthropics/claude-code/plugins](https://github.com/anthropics/claude-code/tree/main/plugins). Plugins can include commands, agents, skills, and hooks.

### Frontend Design

Creates distinctive, production-grade UIs that avoid generic AI aesthetics. Auto-invokes for frontend work.

**What it provides:**
- Guidance on bold design choices over safe defaults
- Typography, animations, and visual detail patterns
- Avoids the "looks AI-generated" problem

```bash
# Auto-activates when working on frontend
> "Build a landing page for our product"
# Plugin influences output toward distinctive design
```

### Code Review (`/code-review`)

Automated PR review using 5 parallel Sonnet agents:

| Agent | Focus |
|-------|-------|
| CLAUDE.md compliance | Project conventions |
| Bug detection | Logic errors, edge cases |
| Historical context | Patterns from codebase history |
| PR history | Related past changes |
| Code comments | Inline review suggestions |

```bash
> /code-review
# Runs all agents in parallel, aggregates findings
```

### Commit Commands

Git workflow automation:

| Command | Action |
|---------|--------|
| `/commit` | Stage and commit with conventional message |
| `/commit-push-pr` | Commit, push, and create PR in one flow |
| `/clean_gone` | Remove local branches deleted on remote |

### Feature Dev (`/feature-dev`)

Structured 7-phase feature development workflow with specialized agents:

- `code-explorer` — understand existing patterns
- `code-architect` — design the implementation
- `code-reviewer` — validate the result

```bash
> /feature-dev
# Guided workflow from exploration to implementation
```

### PR Review Toolkit (`/pr-review-toolkit:review-pr`)

Comprehensive PR review with selectable aspects:

```bash
> /pr-review-toolkit:review-pr all
# Or pick specific aspects:
> /pr-review-toolkit:review-pr tests errors types
```

| Agent | Analyzes |
|-------|----------|
| `comment-analyzer` | Documentation quality |
| `pr-test-analyzer` | Test coverage |
| `silent-failure-hunter` | Error handling gaps |
| `type-design-analyzer` | Type safety |
| `code-reviewer` | Code quality |
| `code-simplifier` | Complexity reduction |

### Security Guidance

Hook that monitors for security issues during edits:

- Command injection patterns
- XSS vulnerabilities
- `eval()` usage
- Dangerous HTML injection
- `pickle` deserialization
- `os.system` calls

Warns before you introduce common vulnerabilities.

### Plugin Dev (`/plugin-dev:create-plugin`)

8-phase guided workflow for building your own plugins:

```bash
> /plugin-dev:create-plugin
# Interactive plugin creation with validation
```

Includes agents for creation, validation, and skill review.

### Hookify (`/hookify`)

Create custom hooks from conversation patterns:

```bash
> /hookify
# Analyze recent conversations for patterns to prevent

> /hookify:list
# Show configured hooks
```

### Other Plugins

| Plugin | Purpose |
|--------|---------|
| `agent-sdk-dev` | Agent SDK project scaffolding (`/new-sdk-app`) |
| `claude-opus-4-5-migration` | Migrate prompts between model versions |
| `ralph-wiggum` | Iterative loops (`/ralph-loop`) for autonomous work |
| `explanatory-output-style` | Adds educational context to responses |
| `learning-output-style` | Interactive mode requesting code contributions |

## Plugin Structure

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json      # Metadata
├── commands/            # Slash commands
├── agents/              # Specialized agents
├── skills/              # Agent skills
├── hooks/               # Event handlers
└── README.md
```

Install plugins by configuring them in `.claude/settings.json`.

## Creating Custom Plugins

Use `/plugin-dev:create-plugin` for guided plugin creation, or build manually:

### When to Create a Plugin

- Repeatable multi-step workflows your team runs often
- Standard output formats or conventions to enforce
- Complex operations that benefit from specialized agents
- Security or quality hooks you want always-on

### Custom Plugin Ideas

| Plugin | Components |
|--------|------------|
| `/deploy` | Command + hook for pre-deploy checks |
| `/db-migrate` | Command + agent for migration review |
| `/component` | Skill for React component scaffolding |
| `/api-route` | Command with type generation agent |

## Plugins vs Sub-agents

| Aspect | Plugins | Sub-agents |
|--------|---------|------------|
| Invocation | Slash command or auto-trigger | `Task` tool |
| Context | Full conversation | Fresh context (usually) |
| Execution | Same conversation | Separate process |
| Use case | Standardized workflows | Exploration, parallel work |
| Persistence | Installed in config | Per-invocation |

Use plugins for **structured, repeatable workflows**.
Use sub-agents for **exploration and parallel execution**.

## Best Practices

### Use Commands for Consistency

```bash
# Preferred: Using the plugin command
> /commit
# Follows all conventions, runs proper workflow

# Works but less consistent:
> "commit this"
```

### Combine Plugins in Workflows

```bash
> "Fix the failing test in auth.test.ts"
# Claude fixes the test

> /code-review
# Plugin reviews the changes

> /commit
# Plugin handles the commit
```

### Discover Available Plugins

```bash
/help
# Lists all installed commands and skills
```

## Limitations

- Plugins require installation/configuration
- Some depend on external tools (`gh`, `git`, etc.)
- Hooks run on every matching event (can't skip selectively)
- Plugin state doesn't persist across sessions

## Related

- [Claude Code Overview](./claude-code.md) — main CLI reference
- [Sub-agents](./claude-code-subagents.md) — autonomous task delegation
