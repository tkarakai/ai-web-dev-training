'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { generateId } from '@examples/shared/lib/utils';
import {
  ApproachLevel,
  TrainingExample,
  ModelVersion,
  TrainingJob,
  EvalResults,
  decisionFramework,
  useCaseExamples,
  sampleExamples,
  validateExample,
  calculateDatasetMetrics,
  simulateTrainingProgress,
  simulateEvalResults,
  statusColors,
  sourceColors,
  qualityColors,
} from '../lib/fine-tuning';

type Tab = 'decision' | 'data' | 'training' | 'evaluation' | 'lifecycle';

export default function FineTuningPage() {
  const [activeTab, setActiveTab] = useState<Tab>('decision');
  const [selectedLevel, setSelectedLevel] = useState<ApproachLevel>('prompting');
  const [examples, setExamples] = useState<TrainingExample[]>(sampleExamples);
  const [trainingJob, setTrainingJob] = useState<TrainingJob | null>(null);
  const [modelVersions, setModelVersions] = useState<ModelVersion[]>([]);
  const [baseEval, setBaseEval] = useState<EvalResults | null>(null);
  const [fineTunedEval, setFineTunedEval] = useState<EvalResults | null>(null);

  // Validate examples
  const validateAllExamples = useCallback(() => {
    setExamples(prev => prev.map(ex => validateExample(ex)));
  }, []);

  // Start training
  const startTraining = useCallback(() => {
    const verifiedExamples = examples.filter(ex => ex.quality === 'verified');
    if (verifiedExamples.length < 3) {
      alert('Need at least 3 verified examples to start training');
      return;
    }

    const job: TrainingJob = {
      id: generateId('job'),
      modelName: 'support-assistant-v1',
      baseModel: 'llama-3.2-3b',
      status: 'pending',
      progress: 0,
      epochs: 3,
      currentEpoch: 0,
      events: [],
    };

    setTrainingJob(job);

    const cancel = simulateTrainingProgress(job, (updated) => {
      setTrainingJob(updated);

      if (updated.status === 'completed') {
        // Create model version
        const version: ModelVersion = {
          id: generateId('model'),
          name: job.modelName,
          baseModel: job.baseModel,
          status: 'evaluating',
          trainedAt: new Date(),
          datasetSize: verifiedExamples.length,
        };
        setModelVersions(prev => [version, ...prev]);

        // Simulate evaluation
        setTimeout(() => {
          const base = simulateEvalResults(false);
          const tuned = simulateEvalResults(true);
          setBaseEval(base);
          setFineTunedEval(tuned);

          setModelVersions(prev => prev.map(v =>
            v.id === version.id
              ? {
                  ...v,
                  status: 'staging' as const,
                  evalResults: tuned,
                  comparisonToBase: {
                    accuracyDelta: tuned.accuracy - base.accuracy,
                    latencyDelta: tuned.latencyMs - base.latencyMs,
                    costDelta: tuned.costPerRequest - base.costPerRequest,
                  },
                }
              : v
          ));
        }, 1500);
      }
    });

    return cancel;
  }, [examples]);

  // Promote model
  const promoteModel = useCallback((versionId: string, target: 'production' | 'deprecated') => {
    setModelVersions(prev => prev.map(v => {
      if (v.id === versionId) {
        return { ...v, status: target };
      }
      if (target === 'production' && v.status === 'production') {
        return { ...v, status: 'deprecated' };
      }
      return v;
    }));
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'decision', label: 'Decision Framework' },
    { id: 'data', label: 'Data Pipeline' },
    { id: 'training', label: 'Training' },
    { id: 'evaluation', label: 'Evaluation' },
    { id: 'lifecycle', label: 'Lifecycle' },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Fine-Tuning Strategy</h1>
          <p className="text-muted-foreground mt-2">
            When to fine-tune, data pipeline, training, and lifecycle management
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'decision' && (
            <DecisionTab
              selectedLevel={selectedLevel}
              onSelectLevel={setSelectedLevel}
            />
          )}

          {activeTab === 'data' && (
            <DataTab
              examples={examples}
              onValidate={validateAllExamples}
            />
          )}

          {activeTab === 'training' && (
            <TrainingTab
              job={trainingJob}
              examples={examples}
              onStartTraining={startTraining}
            />
          )}

          {activeTab === 'evaluation' && (
            <EvaluationTab
              baseEval={baseEval}
              fineTunedEval={fineTunedEval}
            />
          )}

          {activeTab === 'lifecycle' && (
            <LifecycleTab
              versions={modelVersions}
              onPromote={promoteModel}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function DecisionTab({
  selectedLevel,
  onSelectLevel,
}: {
  selectedLevel: ApproachLevel;
  onSelectLevel: (level: ApproachLevel) => void;
}) {
  const selected = decisionFramework.find(d => d.level === selectedLevel);

  return (
    <div className="space-y-6">
      {/* Decision Flow */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Decision Framework: Try Simpler Approaches First</h3>
        <div className="space-y-4">
          {decisionFramework.map((node, i) => (
            <div key={node.level} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => onSelectLevel(node.level)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                    selectedLevel === node.level
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {i + 1}
                </button>
                {i < decisionFramework.length - 1 && (
                  <div className="w-0.5 h-8 bg-muted mt-2" />
                )}
              </div>
              <div className="flex-1">
                <button
                  onClick={() => onSelectLevel(node.level)}
                  className={`w-full text-left p-4 rounded border transition-colors ${
                    selectedLevel === node.level
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{node.question}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {node.recommendation}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-muted-foreground">Cost: {node.cost}</div>
                      <div className="text-muted-foreground">Time: {node.time}</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Selected Level Details */}
      {selected && (
        <div className="grid grid-cols-2 gap-6">
          <Card className="p-4">
            <h3 className="font-semibold text-green-600 mb-4">When to Use {selected.level}</h3>
            <ul className="space-y-2">
              {selected.when.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-green-500">+</span>
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold text-red-600 mb-4">When NOT to Use {selected.level}</h3>
            <ul className="space-y-2">
              {selected.whenNot.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-red-500">-</span>
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Use Cases */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="font-semibold text-green-600 mb-4">Good for Fine-Tuning</h3>
          <div className="space-y-3">
            {useCaseExamples.goodForFineTuning.map((use, i) => (
              <div key={i} className="p-3 bg-green-50 rounded border border-green-200">
                <h4 className="font-medium text-sm">{use.name}</h4>
                <p className="text-xs text-muted-foreground">{use.description}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold text-red-600 mb-4">Bad for Fine-Tuning</h3>
          <div className="space-y-3">
            {useCaseExamples.badForFineTuning.map((use, i) => (
              <div key={i} className="p-3 bg-red-50 rounded border border-red-200">
                <h4 className="font-medium text-sm">{use.name}</h4>
                <p className="text-xs text-muted-foreground">{use.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function DataTab({
  examples,
  onValidate,
}: {
  examples: TrainingExample[];
  onValidate: () => void;
}) {
  const metrics = calculateDatasetMetrics(examples);

  return (
    <div className="space-y-6">
      {/* Dataset Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Total Examples</h4>
          <p className="text-2xl font-bold">{metrics.total}</p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Verified</h4>
          <p className="text-2xl font-bold text-green-600">{metrics.byQuality.verified}</p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Avg Tokens</h4>
          <p className="text-2xl font-bold">{metrics.avgTokens.toFixed(0)}</p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Avg Feedback</h4>
          <p className="text-2xl font-bold">{metrics.avgFeedbackScore.toFixed(1)}/5</p>
        </Card>
      </div>

      {/* Source Distribution */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Data Sources</h3>
          <Button onClick={onValidate} variant="outline">
            Validate All
          </Button>
        </div>
        <div className="flex gap-4 mb-4">
          <Badge className={sourceColors.human}>
            Human: {metrics.bySource.human}
          </Badge>
          <Badge className={sourceColors.production}>
            Production: {metrics.bySource.production}
          </Badge>
          <Badge className={sourceColors.synthetic}>
            Synthetic: {metrics.bySource.synthetic}
          </Badge>
        </div>
        <div className="h-4 bg-muted rounded overflow-hidden flex">
          <div
            className="bg-green-500"
            style={{ width: `${(metrics.bySource.human / metrics.total) * 100}%` }}
          />
          <div
            className="bg-blue-500"
            style={{ width: `${(metrics.bySource.production / metrics.total) * 100}%` }}
          />
          <div
            className="bg-purple-500"
            style={{ width: `${(metrics.bySource.synthetic / metrics.total) * 100}%` }}
          />
        </div>
      </Card>

      {/* Examples List */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Training Examples</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {examples.map(ex => (
            <div key={ex.id} className="p-3 border rounded">
              <div className="flex justify-between items-start mb-2">
                <div className="flex gap-2">
                  <Badge className={sourceColors[ex.source]}>{ex.source}</Badge>
                  <Badge className={qualityColors[ex.quality]}>{ex.quality}</Badge>
                </div>
                {ex.feedbackScore && (
                  <span className="text-sm text-muted-foreground">
                    Feedback: {ex.feedbackScore}/5
                  </span>
                )}
              </div>
              <div className="space-y-1 text-sm">
                {ex.messages.slice(0, 3).map((msg, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-medium text-muted-foreground w-16">
                      {msg.role}:
                    </span>
                    <span className="line-clamp-1">{msg.content}</span>
                  </div>
                ))}
              </div>
              {ex.issues && ex.issues.length > 0 && (
                <div className="mt-2 text-xs text-red-600">
                  Issues: {ex.issues.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function TrainingTab({
  job,
  examples,
  onStartTraining,
}: {
  job: TrainingJob | null;
  examples: TrainingExample[];
  onStartTraining: () => void;
}) {
  const verifiedCount = examples.filter(ex => ex.quality === 'verified').length;

  return (
    <div className="space-y-6">
      {/* Training Controls */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold">Start Training</h3>
            <p className="text-sm text-muted-foreground">
              {verifiedCount} verified examples available
            </p>
          </div>
          <Button
            onClick={onStartTraining}
            disabled={job?.status === 'running' || verifiedCount < 3}
          >
            {job?.status === 'running' ? 'Training...' : 'Start Training'}
          </Button>
        </div>

        {verifiedCount < 3 && (
          <p className="text-sm text-yellow-600">
            Need at least 3 verified examples. Validate your data first.
          </p>
        )}
      </Card>

      {/* Training Progress */}
      {job && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Training Job: {job.modelName}</h3>
            <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'destructive' : 'secondary'}>
              {job.status}
            </Badge>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span>{job.progress.toFixed(0)}%</span>
            </div>
            <div className="h-3 bg-muted rounded overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
            <div>
              <span className="text-muted-foreground">Epoch:</span>
              <span className="ml-2">{job.currentEpoch}/{job.epochs}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Train Loss:</span>
              <span className="ml-2 font-mono">{job.trainingLoss?.toFixed(4) || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Val Loss:</span>
              <span className="ml-2 font-mono">{job.validationLoss?.toFixed(4) || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Base Model:</span>
              <span className="ml-2">{job.baseModel}</span>
            </div>
          </div>

          {/* Training Events */}
          <div className="border rounded p-3 bg-muted/30 max-h-48 overflow-y-auto">
            <h4 className="font-medium text-sm mb-2">Events</h4>
            <div className="space-y-1 text-xs font-mono">
              {job.events.map((event, i) => (
                <div key={i} className={`${
                  event.type === 'error' ? 'text-red-600' :
                  event.type === 'success' ? 'text-green-600' :
                  event.type === 'warning' ? 'text-yellow-600' :
                  'text-muted-foreground'
                }`}>
                  [{event.timestamp.toLocaleTimeString()}] {event.message}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function EvaluationTab({
  baseEval,
  fineTunedEval,
}: {
  baseEval: EvalResults | null;
  fineTunedEval: EvalResults | null;
}) {
  if (!baseEval || !fineTunedEval) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">
          Complete a training job to see evaluation results
        </p>
      </Card>
    );
  }

  const metrics: { name: string; key: keyof EvalResults; format: (v: number) => string; higherIsBetter: boolean }[] = [
    { name: 'Accuracy', key: 'accuracy', format: (v) => `${(v * 100).toFixed(1)}%`, higherIsBetter: true },
    { name: 'Format Compliance', key: 'formatCompliance', format: (v) => `${(v * 100).toFixed(1)}%`, higherIsBetter: true },
    { name: 'Quality Score', key: 'qualityScore', format: (v) => `${v.toFixed(2)}/5`, higherIsBetter: true },
    { name: 'Latency', key: 'latencyMs', format: (v) => `${v.toFixed(0)}ms`, higherIsBetter: false },
    { name: 'Cost/Request', key: 'costPerRequest', format: (v) => `$${v.toFixed(4)}`, higherIsBetter: false },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Model Comparison: Base vs Fine-Tuned</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Metric</th>
                <th className="text-right py-2">Base Model</th>
                <th className="text-right py-2">Fine-Tuned</th>
                <th className="text-right py-2">Change</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(metric => {
                const baseVal = baseEval[metric.key];
                const tunedVal = fineTunedEval[metric.key];
                const delta = tunedVal - baseVal;
                const improved = metric.higherIsBetter ? delta > 0 : delta < 0;

                return (
                  <tr key={metric.key} className="border-b">
                    <td className="py-3 font-medium">{metric.name}</td>
                    <td className="py-3 text-right font-mono">{metric.format(baseVal)}</td>
                    <td className="py-3 text-right font-mono">{metric.format(tunedVal)}</td>
                    <td className={`py-3 text-right font-mono ${improved ? 'text-green-600' : 'text-red-600'}`}>
                      {delta > 0 ? '+' : ''}{metric.key === 'costPerRequest' ? `$${delta.toFixed(4)}` : metric.key === 'latencyMs' ? `${delta.toFixed(0)}ms` : `${(delta * 100).toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Visual Comparison */}
      <div className="grid grid-cols-3 gap-4">
        {['accuracy', 'formatCompliance', 'qualityScore'].map(key => {
          const baseVal = baseEval[key as keyof EvalResults] as number;
          const tunedVal = fineTunedEval[key as keyof EvalResults] as number;
          const max = key === 'qualityScore' ? 5 : 1;

          return (
            <Card key={key} className="p-4">
              <h4 className="font-medium text-sm mb-4 capitalize">{key.replace(/([A-Z])/g, ' $1')}</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Base</span>
                    <span>{((baseVal / max) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-gray-400" style={{ width: `${(baseVal / max) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Fine-Tuned</span>
                    <span>{((tunedVal / max) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${(tunedVal / max) * 100}%` }} />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function LifecycleTab({
  versions,
  onPromote,
}: {
  versions: ModelVersion[];
  onPromote: (id: string, target: 'production' | 'deprecated') => void;
}) {
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Model Versions</h3>

        {versions.length === 0 ? (
          <p className="text-muted-foreground">
            No model versions yet. Complete a training job to see versions here.
          </p>
        ) : (
          <div className="space-y-4">
            {versions.map(version => (
              <div key={version.id} className={`p-4 rounded border ${statusColors[version.status]}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">{version.name}</h4>
                    <p className="text-sm opacity-75">
                      Base: {version.baseModel} | Dataset: {version.datasetSize} examples
                    </p>
                  </div>
                  <Badge variant="outline">{version.status}</Badge>
                </div>

                {version.evalResults && (
                  <div className="grid grid-cols-5 gap-4 text-sm mb-3">
                    <div>
                      <span className="opacity-75">Accuracy:</span>
                      <span className="ml-1 font-mono">{(version.evalResults.accuracy * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="opacity-75">Format:</span>
                      <span className="ml-1 font-mono">{(version.evalResults.formatCompliance * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="opacity-75">Quality:</span>
                      <span className="ml-1 font-mono">{version.evalResults.qualityScore.toFixed(2)}/5</span>
                    </div>
                    <div>
                      <span className="opacity-75">Latency:</span>
                      <span className="ml-1 font-mono">{version.evalResults.latencyMs.toFixed(0)}ms</span>
                    </div>
                    <div>
                      <span className="opacity-75">Cost:</span>
                      <span className="ml-1 font-mono">${version.evalResults.costPerRequest.toFixed(4)}</span>
                    </div>
                  </div>
                )}

                {version.comparisonToBase && (
                  <div className="flex gap-4 text-xs mb-3">
                    <span className={version.comparisonToBase.accuracyDelta > 0 ? 'text-green-600' : 'text-red-600'}>
                      Accuracy: {version.comparisonToBase.accuracyDelta > 0 ? '+' : ''}{(version.comparisonToBase.accuracyDelta * 100).toFixed(1)}%
                    </span>
                    <span className={version.comparisonToBase.latencyDelta < 0 ? 'text-green-600' : 'text-red-600'}>
                      Latency: {version.comparisonToBase.latencyDelta > 0 ? '+' : ''}{version.comparisonToBase.latencyDelta.toFixed(0)}ms
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  {version.status === 'staging' && (
                    <Button
                      size="sm"
                      onClick={() => onPromote(version.id, 'production')}
                    >
                      Promote to Production
                    </Button>
                  )}
                  {version.status === 'production' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPromote(version.id, 'deprecated')}
                    >
                      Deprecate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Lifecycle Flow */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Model Lifecycle</h3>
        <div className="flex items-center justify-between">
          {['training', 'evaluating', 'staging', 'production', 'deprecated'].map((status, i, arr) => (
            <div key={status} className="flex items-center">
              <div className={`px-4 py-2 rounded ${statusColors[status as ModelVersion['status']]}`}>
                {status}
              </div>
              {i < arr.length - 1 && (
                <div className="mx-2 text-muted-foreground">→</div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
