# Fine-Tuning and Customization Strategy

When to fine-tune, when to use alternatives, and how to manage the lifecycle.

## TL;DR

- Fine-tuning is **rarely the first choice**—prompting and RAG solve most problems
- Use the **decision framework**: prompting → RAG → fine-tuning → custom model
- Fine-tuning **maintenance burden** is high: data pipelines, evals, monitoring
- **Data quality matters** more than data quantity
- Plan the full lifecycle: data collection → training → evaluation → deployment → monitoring

## Core Concepts

### Decision Framework

Before fine-tuning, try simpler approaches.

```
┌─────────────────────────────────────────────────────────────────┐
│ Problem: Model doesn't do what I want                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Can better prompting solve it?                               │
│    - Clear instructions, examples, constraints                  │
│    - Cost: Low, Time: Hours                                     │
└─────────────────────────────────────────────────────────────────┘
                              │ No
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Can RAG/context solve it?                                    │
│    - Provide relevant documents, knowledge base                 │
│    - Cost: Medium, Time: Days                                   │
└─────────────────────────────────────────────────────────────────┘
                              │ No
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Is fine-tuning appropriate?                                  │
│    - Style/format changes, domain adaptation                    │
│    - Cost: High, Time: Weeks                                    │
└─────────────────────────────────────────────────────────────────┘
                              │ No
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Do you need a custom model?                                  │
│    - Unique architecture, full control                          │
│    - Cost: Very High, Time: Months                              │
└─────────────────────────────────────────────────────────────────┘
```

### When Fine-Tuning Makes Sense

| Good Use Cases | Poor Use Cases |
|----------------|----------------|
| Consistent output format/style | Adding new knowledge |
| Domain-specific terminology | One-off tasks |
| Reducing prompt size | Problems solvable by prompting |
| Company voice/tone | Small datasets (<100 examples) |
| Specific task patterns | Frequently changing requirements |

### Data Pipeline

```typescript
interface FineTuningDataset {
  examples: TrainingExample[];
  metadata: DatasetMetadata;
  splits: {
    train: number;
    validation: number;
    test: number;
  };
}

interface TrainingExample {
  id: string;
  messages: Message[];
  source: 'human' | 'synthetic' | 'production';
  quality: 'verified' | 'unverified';
  createdAt: Date;
}

// Data collection pipeline
async function collectTrainingData(
  config: DataCollectionConfig
): Promise<FineTuningDataset> {
  const examples: TrainingExample[] = [];

  // Source 1: Human-created examples
  const humanExamples = await getHumanAnnotatedExamples(config.humanDataPath);
  examples.push(...humanExamples.map(e => ({
    ...e,
    source: 'human' as const,
    quality: 'verified' as const,
  })));

  // Source 2: Production logs (with filtering)
  const productionExamples = await getProductionExamples({
    minFeedbackScore: 4,  // Only positive feedback
    dateRange: config.productionDateRange,
  });
  examples.push(...productionExamples.map(e => ({
    ...e,
    source: 'production' as const,
    quality: 'unverified' as const,
  })));

  // Source 3: Synthetic data (use carefully)
  if (config.useSynthetic) {
    const syntheticExamples = await generateSyntheticExamples(
      config.syntheticConfig
    );
    examples.push(...syntheticExamples.map(e => ({
      ...e,
      source: 'synthetic' as const,
      quality: 'unverified' as const,
    })));
  }

  // Deduplicate and validate
  const deduplicated = deduplicateExamples(examples);
  const validated = await validateExamples(deduplicated);

  // Split
  return createSplits(validated, config.splitRatios);
}
```

### Data Quality

Quality matters more than quantity.

```typescript
// Quality validation checks
async function validateExamples(
  examples: TrainingExample[]
): Promise<TrainingExample[]> {
  const validated: TrainingExample[] = [];

  for (const example of examples) {
    const issues: string[] = [];

    // Check format
    if (!isValidMessageFormat(example.messages)) {
      issues.push('invalid_format');
    }

    // Check length
    const tokens = countTokens(example.messages);
    if (tokens < MIN_TOKENS || tokens > MAX_TOKENS) {
      issues.push('invalid_length');
    }

    // Check for PII
    if (containsPII(example.messages)) {
      issues.push('contains_pii');
    }

    // Check for quality signals
    if (example.source === 'production') {
      const feedbackScore = await getFeedbackScore(example.id);
      if (feedbackScore < MIN_FEEDBACK_SCORE) {
        issues.push('low_feedback');
      }
    }

    // Check for leakage
    if (containsTestDataPatterns(example.messages)) {
      issues.push('potential_leakage');
    }

    if (issues.length === 0) {
      validated.push(example);
    } else {
      await logRejectedExample(example, issues);
    }
  }

  return validated;
}
```

### Fine-Tuning Process

**OpenAI fine-tuning:**

```typescript
import OpenAI from 'openai';

const openai = new OpenAI();

async function fineTuneOpenAI(
  dataset: FineTuningDataset,
  config: FineTuneConfig
): Promise<FineTuneJob> {
  // Upload training file
  const trainingFile = await openai.files.create({
    file: createJSONLFile(dataset.examples.filter(e => e.split === 'train')),
    purpose: 'fine-tune',
  });

  // Upload validation file
  const validationFile = await openai.files.create({
    file: createJSONLFile(dataset.examples.filter(e => e.split === 'validation')),
    purpose: 'fine-tune',
  });

  // Create fine-tuning job
  const job = await openai.fineTuning.jobs.create({
    training_file: trainingFile.id,
    validation_file: validationFile.id,
    model: config.baseModel,  // e.g., 'gpt-4o-mini-2024-07-18'
    hyperparameters: {
      n_epochs: config.epochs || 'auto',
      batch_size: config.batchSize || 'auto',
      learning_rate_multiplier: config.learningRate || 'auto',
    },
    suffix: config.modelSuffix,  // Custom identifier
  });

  return job;
}

// Monitor job progress
async function monitorFineTuning(jobId: string): Promise<void> {
  const events = await openai.fineTuning.jobs.listEvents(jobId);

  for await (const event of events) {
    console.log(`[${event.created_at}] ${event.message}`);

    if (event.type === 'error') {
      throw new Error(`Fine-tuning failed: ${event.message}`);
    }
  }
}
```

### Evaluation

Evaluate before and after fine-tuning.

```typescript
interface FineTuneEvaluation {
  baseModel: EvalResults;
  fineTunedModel: EvalResults;
  comparison: EvalComparison;
}

async function evaluateFineTunedModel(
  baseModelId: string,
  fineTunedModelId: string,
  testSet: TrainingExample[]
): Promise<FineTuneEvaluation> {
  // Evaluate base model
  const baseResults = await runEvaluation(baseModelId, testSet);

  // Evaluate fine-tuned model
  const fineTunedResults = await runEvaluation(fineTunedModelId, testSet);

  // Compare
  const comparison = compareResults(baseResults, fineTunedResults);

  // Check for regression
  if (comparison.regression) {
    console.warn('Fine-tuned model regressed on some metrics', comparison);
  }

  return {
    baseModel: baseResults,
    fineTunedModel: fineTunedResults,
    comparison,
  };
}

// Evaluation metrics
interface EvalResults {
  accuracy: number;
  formatCompliance: number;
  latencyP50: number;
  latencyP95: number;
  costPerRequest: number;
  qualityScores: Record<string, number>;
}
```

### Lifecycle Management

```typescript
interface FineTunedModelVersion {
  id: string;
  modelId: string;
  baseModel: string;
  trainedAt: Date;
  datasetVersion: string;
  evalResults: EvalResults;
  status: 'training' | 'evaluating' | 'staging' | 'production' | 'deprecated';
  metadata: Record<string, unknown>;
}

class FineTuneLifecycleManager {
  async promote(versionId: string, target: 'staging' | 'production'): Promise<void> {
    const version = await this.getVersion(versionId);

    // Validate before promotion
    if (target === 'production') {
      const validation = await this.validateForProduction(version);
      if (!validation.passed) {
        throw new Error(`Cannot promote: ${validation.reasons.join(', ')}`);
      }
    }

    // Update status
    await this.updateStatus(versionId, target);

    // Update routing
    if (target === 'production') {
      await this.updateProductionRouting(version.modelId);
    }

    // Notify
    await this.notifyTeam(`Model ${versionId} promoted to ${target}`);
  }

  async rollback(toVersionId: string): Promise<void> {
    const currentProduction = await this.getProductionVersion();
    const targetVersion = await this.getVersion(toVersionId);

    // Swap routing
    await this.updateProductionRouting(targetVersion.modelId);

    // Update statuses
    await this.updateStatus(currentProduction.id, 'deprecated');
    await this.updateStatus(toVersionId, 'production');

    // Alert
    await this.notifyTeam(`Rolled back to model ${toVersionId}`);
  }

  async scheduleRetrain(config: RetrainConfig): Promise<void> {
    // Schedule periodic retraining
    await scheduler.schedule({
      job: 'fine-tune-retrain',
      schedule: config.schedule,  // e.g., '0 0 * * 0' (weekly)
      params: {
        dataCollectionConfig: config.dataConfig,
        evalThresholds: config.thresholds,
      },
    });
  }
}
```

### Open-Source Fine-Tuning

For full control and privacy.

```typescript
// Using Hugging Face + PEFT for efficient fine-tuning
const openSourceFineTuneConfig = {
  // Base model
  baseModel: 'meta-llama/Llama-3.1-8B-Instruct',

  // PEFT/LoRA for efficient fine-tuning
  peftConfig: {
    method: 'lora',
    r: 16,  // Rank
    alpha: 32,
    targetModules: ['q_proj', 'v_proj'],
    dropout: 0.05,
  },

  // Training config
  trainingArgs: {
    outputDir: './fine-tuned-model',
    numTrainEpochs: 3,
    perDeviceTrainBatchSize: 4,
    gradientAccumulationSteps: 4,
    learningRate: 2e-4,
    warmupSteps: 100,
    loggingSteps: 10,
    evalSteps: 100,
    saveSteps: 100,
  },

  // Hardware requirements
  hardware: {
    gpu: 'A100-40GB',  // Or 2x RTX 4090
    estimatedTime: '2-4 hours',
  },
};
```

## Common Pitfalls

- **Fine-tuning first.** Try prompting and RAG before fine-tuning.
- **Small, low-quality data.** Garbage in, garbage out—quality over quantity.
- **No baseline comparison.** Always compare to the base model.
- **Forgetting maintenance.** Fine-tuned models need ongoing monitoring and retraining.

## Related

- [Evals and CI/CD](./evals-cicd.md) — Evaluating fine-tuned models

## Previous

- [RAG Systems](./rag-systems.md)

## Next

- [Model Routing and Cost Engineering](./model-routing.md)
