# Claude Code Sub-agents

> Delegate complex, multi-step tasks to specialized autonomous agents

## TL;DR

- Sub-agents are spawned via the `Task` tool to handle specific workloads
- Each agent type has different capabilities and tool access
- Use for exploration, planning, research, and parallel execution
- Agents run autonomously and return results to the main conversation
- Background agents let you continue working while tasks complete

## How Sub-agents Work

Sub-agents are separate Claude instances spawned to handle discrete tasks. They:
- Receive a prompt and set of tools
- Work autonomously until completion
- Return a summary to the parent conversation
- Can run in parallel with other agents

```
┌─────────────────────────────────────────────┐
│           Main Conversation                 │
│                                             │
│    ┌──────────┐  ┌──────────┐              │
│    │  Explore │  │   Plan   │   (parallel) │
│    │  Agent   │  │  Agent   │              │
│    └────┬─────┘  └────┬─────┘              │
│         │             │                     │
│         ▼             ▼                     │
│    ┌────────────────────────┐              │
│    │   Results returned to   │              │
│    │   main conversation     │              │
│    └────────────────────────┘              │
└─────────────────────────────────────────────┘
```

## Agent Types

| Type | Purpose | Tools Available |
|------|---------|-----------------|
| `Explore` | Codebase exploration, finding files, searching code | Read, Glob, Grep, WebFetch |
| `Plan` | Design implementation strategies, identify files | Read, Glob, Grep (no editing) |
| `Bash` | Run shell commands, git operations | Bash only |
| `general-purpose` | Complex multi-step tasks, research | All tools |

### Explore Agent

Fast, read-only exploration. Use for:
- Finding files by pattern
- Searching code for keywords
- Understanding codebase structure
- Answering "where is X?" questions

```bash
> "Find all the API route handlers"
# Claude spawns Explore agent to glob and grep efficiently
```

Thoroughness levels:
- `quick`: Basic pattern matching
- `medium`: Moderate exploration
- `very thorough`: Comprehensive search across naming conventions

### Plan Agent

Designs implementation approaches without making changes. Outputs:
- Step-by-step implementation plans
- Critical files to modify
- Architectural considerations

```bash
> "Plan how to add rate limiting to our API"
# Plan agent explores codebase, returns structured approach
```

### Bash Agent

Isolated shell execution. Use for:
- Running builds or tests
- Git operations
- Package management
- Any terminal workflow

### General-purpose Agent

Full capability for complex tasks. Has access to all tools including file editing. Use when the task requires both exploration and modification.

## Practical Patterns

### Parallel Exploration

When exploring multiple aspects, agents run concurrently:

```bash
> "I need to understand both the auth flow and the payment processing"
# Two Explore agents spawn in parallel, each focused on one area
```

### Background Execution

Long-running tasks can run in background while you continue working:

```bash
> "Run the full test suite in the background"
# Agent spawns, you continue. Results available via /tasks
```

Check background task status:
```bash
/tasks
# Lists running and completed background tasks
```

### Chained Agents

Complex workflows chain multiple agents:

```
User: "Add comprehensive logging to the API layer"

1. Explore agent → finds all API routes and current logging
2. Plan agent → designs logging strategy
3. Main conversation → implements changes
4. Bash agent → runs tests
```

### Resuming Agents

Agents can be resumed to continue work:

```bash
# Initial agent returns with partial findings
# Resume for follow-up work
> "Continue investigating the caching issue we found"
# Resumes previous agent with full context preserved
```

## When to Use Sub-agents

| Scenario | Agent Type | Why |
|----------|------------|-----|
| "Where is X defined?" | Explore | Fast file/code search |
| "How should I implement Y?" | Plan | Design before coding |
| "Run tests and report" | Bash | Isolated shell execution |
| "Research this error" | general-purpose | May need web search + code |
| Multiple independent searches | Parallel Explore | Speed through concurrency |

## When Not to Use

- **Simple file reads**: Use `Read` tool directly
- **Specific class/function lookup**: Use `Glob` directly
- **Single file edits**: Main conversation handles fine
- **Quick commands**: Direct `Bash` is faster

## Best Practices

### Clear Prompts

Agents work autonomously, so be specific:

```bash
# Good: Clear scope and expected output
> "Explore the authentication system. Find where tokens are validated,
   how sessions are managed, and what middleware is involved."

# Less good: Vague scope
> "Look at the auth stuff"
```

### Scope Appropriately

Match agent type to task scope:
- Read-only exploration → Explore
- Implementation design → Plan
- Needs file changes → general-purpose

### Monitor Background Tasks

Don't forget about background agents:
```bash
/tasks                    # List all tasks
# Read output file when complete
```

## Limitations

- Agents don't see the full parent conversation (except context-aware types)
- Each agent invocation costs tokens
- Background tasks may complete after you've moved on
- Complex agent chains add latency

## Related

- [Claude Code Overview](./claude-code.md) — main CLI reference
- [Skills](./claude-code-skills.md) — custom command patterns
