# Deployment, Versioning, and Change Management

Treating AI artifacts as first-class release components.

## TL;DR

- Version **everything**: prompts, templates, tool schemas, eval sets, corpora
- Use **release playbooks** for behavior changes—AI changes need extra care
- Build **rollback strategies** that work in minutes, not hours
- **Compatibility management** matters when tools and schemas evolve
- AI changes are behavior changes—test and monitor accordingly

## Core Concepts

### What to Version

AI systems have more moving parts than traditional software.

```typescript
interface AISystemArtifacts {
  // Prompt artifacts
  prompts: {
    systemPrompts: VersionedPrompt[];
    userPromptTemplates: VersionedTemplate[];
    fewShotExamples: VersionedExamples[];
  };

  // Tool artifacts
  tools: {
    toolDefinitions: VersionedToolSchema[];
    toolImplementations: VersionedCode[];
  };

  // Data artifacts
  data: {
    evalSets: VersionedEvalSet[];
    trainingData: VersionedDataset[];
    corpusVersions: VersionedCorpus[];
  };

  // Config artifacts
  config: {
    modelConfigs: VersionedModelConfig[];
    routingRules: VersionedRoutingConfig[];
    safetyFilters: VersionedFilterConfig[];
  };
}

interface VersionedArtifact {
  id: string;
  version: string;  // semver
  content: unknown;
  metadata: {
    createdAt: Date;
    createdBy: string;
    changelog: string;
    evalResults?: EvalResults;
  };
}
```

### Version Schema

Use semantic versioning with AI-specific considerations.

```typescript
// Version interpretation for AI artifacts
const versioningPolicy = {
  major: {
    triggers: [
      'Breaking change to output format',
      'Tool schema incompatibility',
      'Significant behavior change',
      'Model upgrade with different characteristics',
    ],
    requires: ['Full regression testing', 'Stakeholder review', 'Migration plan'],
  },

  minor: {
    triggers: [
      'New capability added',
      'Improved accuracy/quality',
      'New tool added (backward compatible)',
      'Prompt optimization',
    ],
    requires: ['Regression testing', 'A/B test or canary'],
  },

  patch: {
    triggers: [
      'Bug fix',
      'Typo correction',
      'Minor prompt wording change',
      'Performance optimization',
    ],
    requires: ['Targeted testing', 'Quick canary'],
  },
};

function determineVersionBump(
  changes: Change[]
): 'major' | 'minor' | 'patch' {
  if (changes.some(c => isBreakingChange(c))) return 'major';
  if (changes.some(c => isNewFeature(c))) return 'minor';
  return 'patch';
}
```

### Storage and Retrieval

```typescript
// Store versioned artifacts
interface ArtifactStore {
  // Prompts stored in version control + database
  prompts: {
    storage: 'git + database';
    format: 'markdown with frontmatter';
    index: 'searchable by version, tags';
  };

  // Eval sets stored with results
  evals: {
    storage: 'database';
    format: 'json';
    retention: '1 year';
  };

  // Corpora stored in object storage
  corpora: {
    storage: 's3-compatible';
    format: 'parquet or jsonl';
    versioning: 'content-addressed';
  };
}

// Example: Versioned prompt storage
interface StoredPrompt {
  id: string;
  version: string;
  name: string;
  content: string;
  variables: string[];
  metadata: {
    description: string;
    createdAt: Date;
    author: string;
    evalResults: {
      version: string;
      passRate: number;
      metrics: Record<string, number>;
    };
  };
}

async function getPrompt(
  name: string,
  version?: string
): Promise<StoredPrompt> {
  if (version) {
    return db.prompts.findUnique({ where: { name, version } });
  }
  // Get latest production version
  return db.prompts.findFirst({
    where: { name, status: 'production' },
    orderBy: { version: 'desc' },
  });
}
```

### Release Playbooks

AI changes need structured releases.

```typescript
interface ReleasePlaybook {
  name: string;
  type: 'prompt' | 'tool' | 'model' | 'corpus';
  steps: PlaybookStep[];
  rollbackProcedure: RollbackProcedure;
  monitoringChecklist: string[];
}

const promptReleasePlaybook: ReleasePlaybook = {
  name: 'prompt-release',
  type: 'prompt',
  steps: [
    {
      name: 'Pre-release checks',
      tasks: [
        'Run full eval suite',
        'Compare metrics to baseline',
        'Review prompt changes',
        'Check for unintended behavior changes',
      ],
      gate: 'All evals pass',
    },
    {
      name: 'Staging deployment',
      tasks: [
        'Deploy to staging environment',
        'Run smoke tests',
        'Manual QA if significant change',
      ],
      gate: 'Staging tests pass',
    },
    {
      name: 'Canary deployment',
      tasks: [
        'Deploy to 5% of production traffic',
        'Monitor for 1 hour',
        'Check error rates, latency, user feedback',
      ],
      gate: 'No degradation in metrics',
    },
    {
      name: 'Gradual rollout',
      tasks: [
        'Increase to 25% traffic',
        'Monitor for 2 hours',
        'Increase to 50% traffic',
        'Monitor for 2 hours',
        'Increase to 100% traffic',
      ],
      gate: 'Metrics stable at each stage',
    },
    {
      name: 'Post-release',
      tasks: [
        'Update baseline metrics',
        'Archive previous version',
        'Document changes in changelog',
        'Notify stakeholders',
      ],
      gate: 'Documentation complete',
    },
  ],
  rollbackProcedure: {
    trigger: 'Error rate > 2x baseline OR user complaints spike',
    steps: [
      'Route 100% traffic to previous version',
      'Notify on-call',
      'Investigate root cause',
    ],
    maxRollbackTime: '5 minutes',
  },
  monitoringChecklist: [
    'Error rate',
    'Latency P50/P95',
    'User feedback score',
    'Refusal rate',
    'Token usage',
  ],
};
```

### Rollback Strategies

```typescript
interface RollbackConfig {
  artifactType: string;
  strategy: 'instant' | 'gradual' | 'manual';
  previousVersion: string;
  currentVersion: string;
}

class RollbackManager {
  // Instant rollback for critical issues
  async instantRollback(config: RollbackConfig): Promise<void> {
    const start = Date.now();

    // Swap versions atomically
    await this.swapVersions(config.artifactType, config.previousVersion);

    // Clear caches
    await this.clearAffectedCaches(config.artifactType);

    // Update routing
    await this.updateRouting(config.artifactType, config.previousVersion);

    const duration = Date.now() - start;
    logger.info('Instant rollback completed', { duration, config });

    // Alert team
    await this.alertTeam({
      type: 'rollback',
      config,
      duration,
    });
  }

  // Gradual rollback for less critical issues
  async gradualRollback(
    config: RollbackConfig,
    schedule: RollbackSchedule
  ): Promise<void> {
    for (const stage of schedule.stages) {
      await this.setTrafficSplit(
        config.artifactType,
        config.previousVersion,
        stage.percentage
      );

      await sleep(stage.duration);

      const metrics = await this.checkMetrics(config.artifactType);
      if (!metrics.healthy) {
        // Accelerate to instant rollback
        await this.instantRollback(config);
        return;
      }
    }

    // Complete rollback
    await this.setTrafficSplit(config.artifactType, config.previousVersion, 100);
  }

  // Store rollback points
  async createRollbackPoint(artifactType: string): Promise<RollbackPoint> {
    const current = await this.getCurrentVersion(artifactType);

    return {
      id: crypto.randomUUID(),
      artifactType,
      version: current.version,
      snapshot: current,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };
  }
}
```

### Compatibility Management

Handle schema evolution gracefully.

```typescript
interface ToolSchemaVersion {
  version: string;
  schema: ToolSchema;
  breaking: boolean;
  migrationFrom?: string;  // Previous version this migrates from
}

// Manage tool schema versions
class SchemaVersionManager {
  // Check compatibility
  isCompatible(
    clientVersion: string,
    serverVersion: string
  ): { compatible: boolean; warnings?: string[] } {
    const client = this.parseVersion(clientVersion);
    const server = this.parseVersion(serverVersion);

    // Major version mismatch = incompatible
    if (client.major !== server.major) {
      return { compatible: false };
    }

    // Minor version: server newer is OK
    if (server.minor > client.minor) {
      return {
        compatible: true,
        warnings: ['Server has newer features client may not use'],
      };
    }

    // Client newer than server: may be issues
    if (client.minor > server.minor) {
      return {
        compatible: true,
        warnings: ['Client expects features server may not have'],
      };
    }

    return { compatible: true };
  }

  // Apply migrations
  async migrateSchema(
    data: unknown,
    fromVersion: string,
    toVersion: string
  ): Promise<unknown> {
    const migrations = this.getMigrationPath(fromVersion, toVersion);

    let current = data;
    for (const migration of migrations) {
      current = await migration.transform(current);
    }

    return current;
  }
}

// Example migration
const toolSchemaMigrations = [
  {
    from: '1.0.0',
    to: '2.0.0',
    transform: (data: v1.ToolCall) => ({
      ...data,
      // V2 requires explicit type field
      type: 'function',
      // V2 renames 'args' to 'arguments'
      function: {
        name: data.name,
        arguments: JSON.stringify(data.args),
      },
    }),
  },
];
```

### Configuration Management

```typescript
// Environment-specific configuration
interface EnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  artifacts: {
    prompts: { version: string; overrides?: Partial<Prompt>[] };
    models: { primary: string; fallbacks: string[] };
    evals: { required: string[]; optional: string[] };
  };
  features: {
    [key: string]: boolean | string | number;
  };
}

const productionConfig: EnvironmentConfig = {
  environment: 'production',
  artifacts: {
    prompts: { version: '2.3.1' },
    models: {
      primary: 'gpt-4o',
      fallbacks: ['claude-3-5-sonnet', 'gpt-4o-mini'],
    },
    evals: {
      required: ['golden-conversations', 'safety-tests'],
      optional: ['edge-cases'],
    },
  },
  features: {
    enableNewRAG: false,  // Feature flag
    maxTokens: 4096,
    enableVoice: true,
  },
};

// Feature flags for gradual rollout
class FeatureFlags {
  async isEnabled(
    feature: string,
    context: { userId: string; tier: string }
  ): Promise<boolean> {
    const flag = await this.getFlag(feature);

    if (!flag) return false;
    if (flag.enabled === false) return false;
    if (flag.enabled === true) return true;

    // Percentage rollout
    if (typeof flag.percentage === 'number') {
      const bucket = this.hashToBucket(context.userId);
      return bucket < flag.percentage;
    }

    // Tier-based
    if (flag.tiers) {
      return flag.tiers.includes(context.tier);
    }

    return false;
  }
}
```

## Common Pitfalls

- **Not versioning prompts.** "It was working yesterday" is undebuggable without versions.
- **No rollback plan.** Every deploy should have a tested rollback procedure.
- **Breaking changes without migration.** Plan for clients on old versions.
- **Skipping canary.** AI behavior changes can be subtle; catch them early.

## Related

- [Evals and CI/CD](./evals-cicd.md) — Testing before deployment
- [Observability](./observability.md) — Monitoring after deployment
- [API Integration](./api-integration.md) — Handling version compatibility

## Previous

- [Model Routing and Cost Engineering](./model-routing.md)

## Next

- [Voice Interfaces](./voice-interfaces.md)
