# Multi-Agent Systems and Orchestration

> When to use multiple agents, orchestration patterns, and managing complexity.

## TL;DR

- **Single agent** for well-scoped tasks; **multi-agent** for complex/open-ended problems
- Orchestration patterns: **sequential, parallel, hierarchical, maker-checker**
- Key challenges: **communication, state management, conflict resolution, cost multiplication**
- Always maintain **human checkpoints** for high-stakes decisions
- Multi-agent adds complexity—use only when justified

## Core Concepts

### When to Use Multiple Agents

Single agent is simpler. Use it when possible.

| Use Case | Single Agent | Multi-Agent |
|----------|--------------|-------------|
| Well-defined task | ✓ | |
| Predictable workflow | ✓ | |
| One tool set needed | ✓ | |
| Complex/open-ended problem | | ✓ |
| Specialized sub-tasks | | ✓ |
| Different expertise needed | | ✓ |
| Quality checks required | | ✓ |

**Multi-agent is justified when:**
- A single agent would need too many tools (>10-15)
- Sub-tasks require different system prompts or personas
- Built-in verification improves output quality
- Tasks can be parallelized for speed

### Orchestration Patterns

**1. Sequential (Pipeline)**

Agents hand off to each other in order.

```typescript
interface PipelineStage {
  name: string;
  agent: Agent;
  inputTransform?: (prev: StageOutput) => AgentInput;
  validation?: (output: StageOutput) => boolean;
}

async function runPipeline(
  stages: PipelineStage[],
  initialInput: unknown
): Promise<unknown> {
  let currentInput = initialInput;

  for (const stage of stages) {
    const agentInput = stage.inputTransform
      ? stage.inputTransform(currentInput)
      : currentInput;

    const output = await stage.agent.run(agentInput);

    if (stage.validation && !stage.validation(output)) {
      throw new Error(`Stage ${stage.name} failed validation`);
    }

    currentInput = output;
  }

  return currentInput;
}

// Example: Research → Analysis → Report
const researchPipeline: PipelineStage[] = [
  { name: 'research', agent: researchAgent },
  { name: 'analyze', agent: analysisAgent, inputTransform: formatFindings },
  { name: 'report', agent: reportAgent },
];
```

**2. Parallel (Fan-out/Fan-in)**

Multiple agents work simultaneously, results aggregated.

```typescript
interface ParallelTask {
  id: string;
  agent: Agent;
  input: AgentInput;
}

interface AggregationStrategy<T> {
  combine: (results: Map<string, AgentOutput>) => T;
  handleFailure: (taskId: string, error: Error) => AgentOutput | null;
}

async function runParallel<T>(
  tasks: ParallelTask[],
  strategy: AggregationStrategy<T>
): Promise<T> {
  const results = new Map<string, AgentOutput>();

  const promises = tasks.map(async (task) => {
    try {
      const output = await task.agent.run(task.input);
      results.set(task.id, output);
    } catch (error) {
      const fallback = strategy.handleFailure(task.id, error);
      if (fallback) {
        results.set(task.id, fallback);
      }
    }
  });

  await Promise.all(promises);

  return strategy.combine(results);
}

// Example: Parallel analysis from multiple perspectives
const analyses = await runParallel(
  [
    { id: 'technical', agent: technicalReviewAgent, input: codeChange },
    { id: 'security', agent: securityReviewAgent, input: codeChange },
    { id: 'performance', agent: performanceReviewAgent, input: codeChange },
  ],
  {
    combine: (results) => mergeReviews(results),
    handleFailure: (id, error) => ({ type: 'skipped', reason: error.message }),
  }
);
```

**3. Hierarchical (Orchestrator-Workers)**

One agent delegates to specialists.

```typescript
interface OrchestratorConfig {
  orchestrator: Agent;
  workers: Map<string, Agent>;
  maxDelegations: number;
}

async function runHierarchical(
  config: OrchestratorConfig,
  task: string
): Promise<AgentOutput> {
  let delegationCount = 0;
  const context: Message[] = [];

  while (delegationCount < config.maxDelegations) {
    const orchestratorResponse = await config.orchestrator.run({
      task,
      context,
      availableWorkers: Array.from(config.workers.keys()),
    });

    if (orchestratorResponse.type === 'final_answer') {
      return orchestratorResponse;
    }

    if (orchestratorResponse.type === 'delegate') {
      const { workerId, subtask } = orchestratorResponse;
      const worker = config.workers.get(workerId);

      if (!worker) {
        context.push({ role: 'system', content: `Worker ${workerId} not found` });
        continue;
      }

      const workerResult = await worker.run(subtask);
      context.push({
        role: 'system',
        content: `Worker ${workerId} result: ${JSON.stringify(workerResult)}`,
      });

      delegationCount++;
    }
  }

  throw new Error('Max delegations exceeded');
}
```

**4. Maker-Checker (Critique Loop)**

One agent creates, another critiques, iterate.

```typescript
interface MakerCheckerConfig {
  maker: Agent;
  checker: Agent;
  maxIterations: number;
  acceptanceThreshold: number;  // Score 0-1
}

async function runMakerChecker(
  config: MakerCheckerConfig,
  task: string
): Promise<{ output: AgentOutput; iterations: number }> {
  let currentDraft: AgentOutput | null = null;
  let feedback: string | null = null;

  for (let i = 0; i < config.maxIterations; i++) {
    // Maker creates/revises
    currentDraft = await config.maker.run({
      task,
      previousDraft: currentDraft,
      feedback,
    });

    // Checker evaluates
    const critique = await config.checker.run({
      task,
      draft: currentDraft,
    });

    if (critique.score >= config.acceptanceThreshold) {
      return { output: currentDraft, iterations: i + 1 };
    }

    feedback = critique.feedback;
  }

  // Return best effort after max iterations
  return { output: currentDraft!, iterations: config.maxIterations };
}

// Example: Code generation with review
const result = await runMakerChecker(
  {
    maker: codeGeneratorAgent,
    checker: codeReviewerAgent,
    maxIterations: 3,
    acceptanceThreshold: 0.8,
  },
  'Implement a rate limiter with sliding window'
);
```

### State Management Across Agents

```typescript
interface SharedState {
  taskId: string;
  goal: string;
  facts: Fact[];
  decisions: Decision[];
  artifacts: Artifact[];
  status: 'in_progress' | 'completed' | 'failed';
}

class AgentStateManager {
  private state: SharedState;
  private subscribers: Set<(state: SharedState) => void> = new Set();

  constructor(initialState: SharedState) {
    this.state = initialState;
  }

  getState(): Readonly<SharedState> {
    return Object.freeze({ ...this.state });
  }

  update(patch: Partial<SharedState>): void {
    this.state = { ...this.state, ...patch };
    this.notifySubscribers();
  }

  addFact(fact: Fact): void {
    // Check for conflicts with existing facts
    const conflicting = this.state.facts.find(
      f => f.subject === fact.subject && f.value !== fact.value
    );

    if (conflicting) {
      // Resolution strategy: newer wins, or escalate
      console.warn('Fact conflict detected', { existing: conflicting, new: fact });
    }

    this.state.facts = [...this.state.facts, fact];
    this.notifySubscribers();
  }

  addDecision(decision: Decision): void {
    this.state.decisions = [...this.state.decisions, decision];
    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.getState());
    }
  }
}
```

### Conflict Resolution

When agents disagree:

```typescript
interface Conflict {
  type: 'fact' | 'decision' | 'action';
  agents: string[];
  positions: Map<string, unknown>;
}

type ResolutionStrategy = 'voting' | 'authority' | 'human' | 'merge';

async function resolveConflict(
  conflict: Conflict,
  strategy: ResolutionStrategy
): Promise<unknown> {
  switch (strategy) {
    case 'voting':
      // Most common answer wins
      return getMostCommon(Array.from(conflict.positions.values()));

    case 'authority':
      // Designated agent's answer wins
      const authorityAgent = getAuthorityFor(conflict.type);
      return conflict.positions.get(authorityAgent);

    case 'human':
      // Escalate to human
      return await requestHumanResolution(conflict);

    case 'merge':
      // Attempt to combine positions
      return mergePositions(conflict.positions);
  }
}
```

### Cost and Latency Management

Multi-agent multiplies costs. Track and limit.

```typescript
interface AgentBudget {
  maxTokens: number;
  maxCost: number;
  maxLatencyMs: number;
}

class BudgetManager {
  private spent = { tokens: 0, cost: 0, latencyMs: 0 };

  constructor(private budget: AgentBudget) {}

  canAfford(estimated: { tokens: number; cost: number }): boolean {
    return (
      this.spent.tokens + estimated.tokens <= this.budget.maxTokens &&
      this.spent.cost + estimated.cost <= this.budget.maxCost
    );
  }

  record(usage: { tokens: number; cost: number; latencyMs: number }): void {
    this.spent.tokens += usage.tokens;
    this.spent.cost += usage.cost;
    this.spent.latencyMs += usage.latencyMs;
  }

  getRemaining(): AgentBudget {
    return {
      maxTokens: this.budget.maxTokens - this.spent.tokens,
      maxCost: this.budget.maxCost - this.spent.cost,
      maxLatencyMs: this.budget.maxLatencyMs - this.spent.latencyMs,
    };
  }
}
```

### Human-in-the-Loop Checkpoints

```typescript
interface Checkpoint {
  id: string;
  agentId: string;
  action: AgentAction;
  reason: string;
  options: CheckpointOption[];
  timeout: number;
  defaultOption: string;
}

async function humanCheckpoint(checkpoint: Checkpoint): Promise<string> {
  // Send to approval queue
  await notifyUser(checkpoint);

  // Wait for response with timeout
  const response = await Promise.race([
    waitForUserResponse(checkpoint.id),
    sleep(checkpoint.timeout).then(() => checkpoint.defaultOption),
  ]);

  // Log decision for audit
  await auditLog.record({
    checkpointId: checkpoint.id,
    decision: response,
    timestamp: new Date(),
  });

  return response;
}
```

### Audit Trail

```typescript
interface AgentAuditEntry {
  timestamp: Date;
  sessionId: string;
  agentId: string;
  action: string;
  input: unknown;
  output: unknown;
  tokensUsed: number;
  latencyMs: number;
  parentAgentId?: string;  // For hierarchical tracking
}

class AgentAuditor {
  private entries: AgentAuditEntry[] = [];

  record(entry: AgentAuditEntry): void {
    this.entries.push(entry);
  }

  getTrace(sessionId: string): AgentAuditEntry[] {
    return this.entries
      .filter(e => e.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  visualize(sessionId: string): string {
    const trace = this.getTrace(sessionId);
    // Generate Mermaid sequence diagram
    return generateSequenceDiagram(trace);
  }
}
```

## Common Pitfalls

- **Multi-agent by default.** Start simple; add agents only when needed.
- **No budget limits.** Agents can spiral costs without caps.
- **Silent failures.** Log and monitor every agent interaction.
- **No human checkpoints.** High-stakes decisions need human oversight.

## Related

- [API Integration Patterns](./api-integration.md) — Individual agent implementation
- [Security](./security.md) — Multi-agent security considerations
- [Observability](./observability.md) — Monitoring agent systems
