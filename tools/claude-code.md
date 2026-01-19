# Claude Code

> Anthropic's official CLI for AI-assisted development—an agentic coding assistant that runs in your terminal

## TL;DR

- Terminal-based AI assistant with full filesystem and shell access
- Agentic by default: reads files, runs commands, edits code autonomously
- Context-aware through your codebase, git state, and environment
- Extensible via MCP servers, custom skills, and hooks
- Use sub-agents for complex multi-step tasks (see [claude-code-subagents.md](./claude-code-subagents.md))

## Core Capabilities

### Filesystem Operations

Claude Code can read, write, and edit files directly. No copy-paste workflow.

```bash
# Start in your project directory
cd my-project
claude

# Claude sees your codebase, git status, and environment
> "Fix the TypeScript errors in src/utils"
```

It uses dedicated tools for file operations:
- **Read**: View file contents (supports images, PDFs, notebooks)
- **Write**: Create new files
- **Edit**: Precise string replacements in existing files
- **Glob/Grep**: Find files by pattern or search content

### Shell Access

Runs bash commands with your permissions. Useful for:
- Running tests and builds
- Git operations
- Package management
- Any CLI workflow

```bash
> "Run the tests and fix any failures"
# Claude executes npm test, reads output, fixes code, re-runs
```

### Context Awareness

Claude Code automatically picks up:
- Current working directory and git status
- Recent commits and branch info
- Environment variables (sanitized)
- Project structure via `AGENTS.md` or `CLAUDE.md` files

Create an `AGENTS.md` in your repo root to give Claude project-specific context:

```markdown
# Agent Instructions

This is a Next.js 14 app using the App Router.
- Use server components by default
- Tests are in __tests__ folders, run with vitest
- Styles use Tailwind CSS
```

## Key Features

### Agentic Execution

Claude Code operates in a loop: read context, plan, execute, verify. It will:
1. Explore your codebase to understand the problem
2. Make changes across multiple files
3. Run tests or builds to verify
4. Iterate on failures

### Multi-file Edits

Complex refactors happen naturally:

```bash
> "Rename the User interface to Account and update all usages"
# Claude searches for all references, updates imports, fixes types
```

### Conversation Memory

Sessions maintain full context. Reference earlier work:

```bash
> "Actually, also add email validation to that form we just created"
```

Long conversations auto-summarize to fit context limits.

### Parallel Operations

Independent tasks run concurrently. When you ask Claude to:
- Search multiple patterns
- Read several files
- Run independent commands

It batches them in a single turn for speed.

## Practical Patterns

### Starting a Session

```bash
# Basic start
claude

# With initial prompt
claude "explain the auth flow in this codebase"

# Resume previous session
claude --resume
```

### Effective Prompts

Be specific about what you want:

```bash
# Good: Clear scope and success criteria
> "Add input validation to the signup form. Email should be valid format,
   password minimum 8 chars. Show inline errors."

# Less good: Vague outcome
> "Improve the signup form"
```

### Working with Git

Claude Code sees your git state and can commit changes:

```bash
> "Commit these changes with a descriptive message"
# Claude reads diff, writes conventional commit message
```

### Debugging Workflow

```bash
> "The user list isn't loading. Check the API route and component."
# Claude reads relevant files, traces the data flow, identifies the issue
```

## Configuration

### Environment Variables

```bash
# Required: API key
export ANTHROPIC_API_KEY="sk-..."

# Optional: Model selection
export CLAUDE_MODEL="claude-sonnet-4-20250514"
```

### Settings File

Claude Code uses `~/.claude/settings.json` for persistent config:

```json
{
  "permissions": {
    "allow": ["Read", "Write", "Edit"],
    "deny": ["Bash(rm -rf)"]
  }
}
```

### Project-level Config

Create `.claude/settings.json` in your repo for project-specific rules.

## Common Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear conversation history |
| `/compact` | Summarize conversation to save context |
| `/cost` | Show token usage and costs |
| `/quit` | Exit Claude Code |

## Limitations

- **Context window**: Can handle large codebases but very long files may need chunking
- **Execution time**: Complex operations have timeouts (configurable up to 10 min)
- **No GUI**: Terminal-only, no IDE integration (though VS Code extension exists separately)
- **API costs**: Token usage adds up on large refactors—monitor with `/cost`

## Related

- [Sub-agents](./claude-code-subagents.md) — delegate complex tasks to specialized agents
- [Skills](./claude-code-skills.md) — extend functionality with custom commands
