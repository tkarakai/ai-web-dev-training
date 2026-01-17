'use client';

import { useState, useCallback } from 'react';
import { Card } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import {
  Artifact,
  ReleasePlaybook,
  FeatureFlag,
  RollbackPoint,
  DeploymentMetrics,
  VersionBump,
  sampleArtifacts,
  sampleFeatureFlags,
  versionBumpTriggers,
  bumpVersion,
  checkCompatibility,
  createReleasePlaybook,
  simulateReleaseStep,
  simulateDeploymentMetrics,
  statusColors,
  releaseStepColors,
  artifactTypeColors,
} from '../lib/versioning';
import { generateId } from '@examples/shared/lib/utils';

type Tab = 'artifacts' | 'releases' | 'rollback' | 'flags';

export default function DeploymentVersioningPage() {
  const [activeTab, setActiveTab] = useState<Tab>('artifacts');
  const [artifacts, setArtifacts] = useState<Artifact[]>(sampleArtifacts);
  const [releasePlaybook, setReleasePlaybook] = useState<ReleasePlaybook | null>(null);
  const [isRunningRelease, setIsRunningRelease] = useState(false);
  const [rollbackPoints, setRollbackPoints] = useState<RollbackPoint[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>(sampleFeatureFlags);
  const [deploymentMetrics, setDeploymentMetrics] = useState<DeploymentMetrics | null>(null);

  // Start a release
  const startRelease = useCallback((artifact: Artifact) => {
    const playbook = createReleasePlaybook(artifact);
    playbook.status = 'running';
    playbook.startedAt = new Date();
    setReleasePlaybook(playbook);
    setActiveTab('releases');
  }, []);

  // Run release steps
  const runReleaseSteps = useCallback(async () => {
    if (!releasePlaybook) return;
    setIsRunningRelease(true);

    for (let i = 0; i < releasePlaybook.steps.length; i++) {
      setReleasePlaybook(prev => prev ? { ...prev, currentStep: i } : null);

      const step = releasePlaybook.steps[i];
      const result = await simulateReleaseStep(step, (updated) => {
        setReleasePlaybook(prev => {
          if (!prev) return null;
          const steps = [...prev.steps];
          steps[i] = updated;
          return { ...prev, steps };
        });
      });

      // Update metrics during canary stages
      if (step.name.includes('Canary') || step.name.includes('rollout')) {
        const percentage = step.name.includes('5%') ? 5 :
          step.name.includes('25%') ? 25 : 100;
        setDeploymentMetrics(simulateDeploymentMetrics(percentage));
      }

      if (result.status === 'failed') {
        setReleasePlaybook(prev => prev ? {
          ...prev,
          status: 'failed',
          rollbackReason: result.output,
        } : null);
        setIsRunningRelease(false);
        return;
      }
    }

    // Complete release
    setReleasePlaybook(prev => prev ? {
      ...prev,
      status: 'completed',
      completedAt: new Date(),
    } : null);

    // Update artifact status
    setArtifacts(prev => prev.map(a =>
      a.id === releasePlaybook.artifact.id
        ? { ...a, status: 'production' as const }
        : a.status === 'production' && a.name === releasePlaybook.artifact.name
          ? { ...a, status: 'deprecated' as const }
          : a
    ));

    // Create rollback point
    const rollbackPoint: RollbackPoint = {
      id: generateId('rollback'),
      artifactType: releasePlaybook.artifactType,
      version: releasePlaybook.artifact.version,
      artifact: releasePlaybook.artifact,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    setRollbackPoints(prev => [rollbackPoint, ...prev]);

    setIsRunningRelease(false);
  }, [releasePlaybook]);

  // Rollback to a point
  const executeRollback = useCallback((point: RollbackPoint) => {
    setArtifacts(prev => prev.map(a =>
      a.name === point.artifact.name && a.status === 'production'
        ? { ...a, status: 'deprecated' as const }
        : a.id === point.artifact.id
          ? { ...a, status: 'production' as const }
          : a
    ));

    if (releasePlaybook) {
      setReleasePlaybook(prev => prev ? {
        ...prev,
        status: 'rolled_back',
        rollbackReason: `Rolled back to version ${point.version}`,
      } : null);
    }
  }, [releasePlaybook]);

  // Toggle feature flag
  const toggleFlag = useCallback((flagId: string) => {
    setFeatureFlags(prev => prev.map(f =>
      f.id === flagId
        ? { ...f, enabled: !f.enabled, updatedAt: new Date() }
        : f
    ));
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'artifacts', label: 'Artifacts' },
    { id: 'releases', label: 'Releases' },
    { id: 'rollback', label: 'Rollback' },
    { id: 'flags', label: 'Feature Flags' },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Deployment & Versioning</h1>
          <p className="text-muted-foreground mt-2">
            Artifact versioning, release playbooks, rollback strategies, and feature flags
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-colors ${
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
          {activeTab === 'artifacts' && (
            <ArtifactsTab
              artifacts={artifacts}
              onStartRelease={startRelease}
            />
          )}

          {activeTab === 'releases' && (
            <ReleasesTab
              playbook={releasePlaybook}
              isRunning={isRunningRelease}
              metrics={deploymentMetrics}
              onRunSteps={runReleaseSteps}
            />
          )}

          {activeTab === 'rollback' && (
            <RollbackTab
              points={rollbackPoints}
              artifacts={artifacts}
              onRollback={executeRollback}
            />
          )}

          {activeTab === 'flags' && (
            <FlagsTab
              flags={featureFlags}
              onToggle={toggleFlag}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function ArtifactsTab({
  artifacts,
  onStartRelease,
}: {
  artifacts: Artifact[];
  onStartRelease: (artifact: Artifact) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Version Bump Guide */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Semantic Versioning for AI</h3>
        <div className="grid grid-cols-3 gap-4">
          {(['major', 'minor', 'patch'] as VersionBump[]).map(bump => (
            <div key={bump} className="border rounded p-3">
              <h4 className="font-medium capitalize text-lg mb-2">{bump}</h4>
              <div className="mb-3">
                <span className="text-sm font-medium text-muted-foreground">Triggers:</span>
                <ul className="text-xs mt-1 space-y-1">
                  {versionBumpTriggers[bump].triggers.slice(0, 3).map((t, i) => (
                    <li key={i}>- {t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Requires:</span>
                <ul className="text-xs mt-1 space-y-1">
                  {versionBumpTriggers[bump].requires.map((r, i) => (
                    <li key={i}>- {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Artifacts List */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Versioned Artifacts</h3>
        <div className="space-y-3">
          {artifacts.map(artifact => (
            <div key={artifact.id} className="p-4 border rounded">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className={artifactTypeColors[artifact.type]}>
                      {artifact.type}
                    </Badge>
                    <h4 className="font-medium">{artifact.name}</h4>
                    <span className="font-mono text-sm">v{artifact.version}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {artifact.changelog}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[artifact.status]}>
                    {artifact.status}
                  </Badge>
                  {artifact.status === 'staging' && (
                    <Button size="sm" onClick={() => onStartRelease(artifact)}>
                      Start Release
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Author: {artifact.author}</span>
                <span>Created: {artifact.createdAt.toLocaleDateString()}</span>
                {artifact.evalResults && (
                  <span className="text-green-600">
                    Pass rate: {(artifact.evalResults.passRate * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Compatibility Check */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Version Compatibility</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 border rounded">
            <h4 className="font-medium text-sm mb-2">Compatible</h4>
            <p className="text-xs text-muted-foreground mb-2">
              Client 2.3.0 / Server 2.4.0
            </p>
            {(() => {
              const result = checkCompatibility('2.3.0', '2.4.0');
              return (
                <div>
                  <Badge variant="success">Compatible</Badge>
                  {result.warnings.length > 0 && (
                    <p className="text-xs text-yellow-600 mt-2">
                      {result.warnings[0]}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="p-3 border rounded">
            <h4 className="font-medium text-sm mb-2">Incompatible</h4>
            <p className="text-xs text-muted-foreground mb-2">
              Client 1.5.0 / Server 2.0.0
            </p>
            {(() => {
              const result = checkCompatibility('1.5.0', '2.0.0');
              return (
                <div>
                  <Badge variant="destructive">Incompatible</Badge>
                  <p className="text-xs text-red-600 mt-2">
                    {result.warnings[0]}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      </Card>
    </div>
  );
}

function ReleasesTab({
  playbook,
  isRunning,
  metrics,
  onRunSteps,
}: {
  playbook: ReleasePlaybook | null;
  isRunning: boolean;
  metrics: DeploymentMetrics | null;
  onRunSteps: () => void;
}) {
  if (!playbook) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">
          No release in progress. Start a release from the Artifacts tab.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Release Header */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold text-lg">{playbook.name}</h3>
            <p className="text-sm text-muted-foreground">
              {playbook.artifact.name} v{playbook.artifact.version}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={
              playbook.status === 'completed' ? 'success' :
              playbook.status === 'failed' || playbook.status === 'rolled_back' ? 'destructive' :
              'secondary'
            }>
              {playbook.status}
            </Badge>
            {playbook.status === 'running' && !isRunning && (
              <Button onClick={onRunSteps}>
                Run Release Steps
              </Button>
            )}
          </div>
        </div>

        {playbook.rollbackReason && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            {playbook.rollbackReason}
          </div>
        )}
      </Card>

      {/* Release Steps */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Release Playbook</h3>
        <div className="space-y-3">
          {playbook.steps.map((step, i) => (
            <div
              key={step.name}
              className={`p-4 rounded border ${releaseStepColors[step.status]}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i <= playbook.currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {i + 1}
                  </span>
                  <h4 className="font-medium">{step.name}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{step.status}</Badge>
                  {step.duration && (
                    <span className="text-xs text-muted-foreground">
                      {(step.duration / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
              <div className="ml-8">
                <ul className="text-sm text-muted-foreground space-y-1">
                  {step.tasks.map((task, j) => (
                    <li key={j}>- {task}</li>
                  ))}
                </ul>
                <p className="text-xs mt-2">Gate: {step.gate}</p>
                {step.output && (
                  <p className={`text-xs mt-2 ${step.status === 'failed' ? 'text-red-600' : 'text-green-600'}`}>
                    {step.output}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Deployment Metrics */}
      {metrics && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Deployment Metrics</h3>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded">
              <p className="text-sm text-muted-foreground">Traffic</p>
              <p className="text-2xl font-bold">{metrics.trafficPercentage}%</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded">
              <p className="text-sm text-muted-foreground">Error Rate</p>
              <p className={`text-2xl font-bold ${metrics.errorRate < 0.03 ? 'text-green-600' : 'text-red-600'}`}>
                {(metrics.errorRate * 100).toFixed(2)}%
              </p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded">
              <p className="text-sm text-muted-foreground">Latency P50</p>
              <p className="text-2xl font-bold">{metrics.latencyP50}ms</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded">
              <p className="text-sm text-muted-foreground">Latency P95</p>
              <p className="text-2xl font-bold">{metrics.latencyP95}ms</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded">
              <p className="text-sm text-muted-foreground">Feedback</p>
              <p className={`text-2xl font-bold ${metrics.userFeedback >= 4 ? 'text-green-600' : 'text-yellow-600'}`}>
                {metrics.userFeedback.toFixed(1)}/5
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function RollbackTab({
  points,
  artifacts,
  onRollback,
}: {
  points: RollbackPoint[];
  artifacts: Artifact[];
  onRollback: (point: RollbackPoint) => void;
}) {
  const productionArtifacts = artifacts.filter(a => a.status === 'production');

  return (
    <div className="space-y-6">
      {/* Rollback Strategies */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Rollback Strategies</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border rounded">
            <h4 className="font-medium mb-2">Instant</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Swap versions atomically in &lt;5 minutes
            </p>
            <Badge variant="destructive">Critical Issues</Badge>
          </div>
          <div className="p-4 border rounded">
            <h4 className="font-medium mb-2">Gradual</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Shift traffic incrementally over hours
            </p>
            <Badge variant="secondary">Non-Critical</Badge>
          </div>
          <div className="p-4 border rounded">
            <h4 className="font-medium mb-2">Manual</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Requires review and approval
            </p>
            <Badge variant="outline">Planned</Badge>
          </div>
        </div>
      </Card>

      {/* Current Production */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Current Production Artifacts</h3>
        {productionArtifacts.length > 0 ? (
          <div className="space-y-2">
            {productionArtifacts.map(artifact => (
              <div key={artifact.id} className="p-3 border rounded flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Badge className={artifactTypeColors[artifact.type]}>{artifact.type}</Badge>
                  <span>{artifact.name}</span>
                  <span className="font-mono text-sm">v{artifact.version}</span>
                </div>
                <Badge variant="success">production</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No production artifacts</p>
        )}
      </Card>

      {/* Rollback Points */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Available Rollback Points</h3>
        {points.length > 0 ? (
          <div className="space-y-3">
            {points.map(point => (
              <div key={point.id} className="p-4 border rounded">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className={artifactTypeColors[point.artifactType]}>
                        {point.artifactType}
                      </Badge>
                      <span className="font-medium">{point.artifact.name}</span>
                      <span className="font-mono text-sm">v{point.version}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {point.artifact.changelog}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onRollback(point)}
                  >
                    Rollback
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Created: {point.createdAt.toLocaleString()} |
                  Expires: {point.expiresAt.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No rollback points available. Complete a release to create one.
          </p>
        )}
      </Card>
    </div>
  );
}

function FlagsTab({
  flags,
  onToggle,
}: {
  flags: FeatureFlag[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Feature Flags</h3>
        <div className="space-y-3">
          {flags.map(flag => (
            <div key={flag.id} className="p-4 border rounded">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium font-mono">{flag.name}</h4>
                    <Badge variant={flag.enabled ? 'success' : 'secondary'}>
                      {flag.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {flag.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={flag.enabled ? 'destructive' : 'default'}
                  onClick={() => onToggle(flag.id)}
                >
                  {flag.enabled ? 'Disable' : 'Enable'}
                </Button>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                {flag.percentage !== undefined && (
                  <span>Rollout: {flag.percentage}%</span>
                )}
                {flag.tiers && (
                  <span>Tiers: {flag.tiers.join(', ')}</span>
                )}
                <span>Updated: {flag.updatedAt.toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-4">Rollout Strategies</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border rounded">
            <h4 className="font-medium mb-2">Percentage</h4>
            <p className="text-sm text-muted-foreground">
              Enable for X% of users based on user ID hash
            </p>
            <div className="mt-3 h-2 bg-muted rounded overflow-hidden">
              <div className="h-full bg-primary" style={{ width: '25%' }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">25% rollout</p>
          </div>
          <div className="p-4 border rounded">
            <h4 className="font-medium mb-2">Tier-based</h4>
            <p className="text-sm text-muted-foreground">
              Enable for specific user tiers (free, pro, enterprise)
            </p>
            <div className="flex gap-1 mt-3">
              <Badge variant="outline">pro</Badge>
              <Badge variant="outline">enterprise</Badge>
            </div>
          </div>
          <div className="p-4 border rounded">
            <h4 className="font-medium mb-2">Boolean</h4>
            <p className="text-sm text-muted-foreground">
              Simple on/off for all users
            </p>
            <div className="flex gap-2 mt-3">
              <Badge variant="success">ON</Badge>
              <Badge variant="secondary">OFF</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
