'use client';

import { useState, useCallback } from 'react';
import { Button } from '@examples/shared/components/ui/button';
import { Card } from '@examples/shared/components/ui/card';
import { Badge } from '@examples/shared/components/ui/badge';
import {
  VoiceState,
  VoiceResponse,
  PipelineTimings,
  LatencyOptimization,
  RiskyAction,
  sttProviders,
  ttsProviders,
  latencyOptimizations as defaultOptimizations,
  riskyActions,
  voiceUseCases,
  processVoiceInput,
  getConfidenceLevel,
  getLatencyRating,
  getVoiceError,
  stateColors,
  confidenceColors,
  latencyColors,
  impactColors,
  latencyThresholds,
} from '../lib/voice';

type TabId = 'pipeline' | 'latency' | 'turn-taking' | 'confirmations' | 'errors';

export default function VoiceInterfacesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('pipeline');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'pipeline', label: 'Voice Pipeline' },
    { id: 'latency', label: 'Latency' },
    { id: 'turn-taking', label: 'Turn-Taking' },
    { id: 'confirmations', label: 'Confirmations' },
    { id: 'errors', label: 'Error Recovery' },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Voice Interfaces Demo
          </h1>
          <p className="text-slate-600">
            STT/TTS pipeline, latency optimization, turn-taking, and error handling
          </p>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(tab => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'outline'}
              onClick={() => setActiveTab(tab.id)}
              size="sm"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'pipeline' && <PipelineTab />}
        {activeTab === 'latency' && <LatencyTab />}
        {activeTab === 'turn-taking' && <TurnTakingTab />}
        {activeTab === 'confirmations' && <ConfirmationsTab />}
        {activeTab === 'errors' && <ErrorsTab />}
      </div>
    </main>
  );
}

function PipelineTab() {
  const [voiceState, setVoiceState] = useState<VoiceState>({ type: 'idle' });
  const [timings, setTimings] = useState<Partial<PipelineTimings>>({});
  const [history, setHistory] = useState<VoiceResponse[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const startVoiceInteraction = useCallback(async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    setTimings({});

    try {
      const response = await processVoiceInput(
        state => setVoiceState(state),
        timing => setTimings(timing)
      );
      setHistory(prev => [response, ...prev].slice(0, 5));
    } catch (error) {
      setVoiceState({ type: 'error', error: 'Processing failed' });
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  return (
    <div className="space-y-6">
      {/* Pipeline Architecture */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Voice Pipeline: STT → LLM → TTS</h2>
        <p className="text-slate-600 mb-6">
          Voice interactions flow through three stages. Click below to simulate a voice interaction.
        </p>

        {/* Pipeline Visualization */}
        <div className="flex items-center justify-between mb-6 p-4 bg-slate-50 rounded-lg overflow-x-auto">
          <PipelineStage
            name="VAD"
            description="Voice Activity Detection"
            latency={timings.vadLatency}
            active={voiceState.type === 'listening'}
          />
          <Arrow />
          <PipelineStage
            name="STT"
            description="Speech-to-Text"
            latency={timings.sttLatency}
            active={voiceState.type === 'listening'}
          />
          <Arrow />
          <PipelineStage
            name="LLM"
            description="Language Model"
            latency={timings.llmComplete}
            active={voiceState.type === 'processing'}
            subLatency={timings.llmTTFT ? `TTFT: ${Math.round(timings.llmTTFT)}ms` : undefined}
          />
          <Arrow />
          <PipelineStage
            name="TTS"
            description="Text-to-Speech"
            latency={timings.ttsLatency}
            active={voiceState.type === 'speaking'}
          />
        </div>

        {/* Current State */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">State:</span>
            <Badge className={stateColors[voiceState.type]}>
              {voiceState.type.toUpperCase()}
            </Badge>
          </div>
          {timings.totalLatency && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Total:</span>
              <span className={`font-mono text-sm ${latencyColors[getLatencyRating(timings.totalLatency)]}`}>
                {Math.round(timings.totalLatency)}ms
              </span>
              <Badge variant="outline" className={latencyColors[getLatencyRating(timings.totalLatency)]}>
                {getLatencyRating(timings.totalLatency)}
              </Badge>
            </div>
          )}
        </div>

        {/* Transcript/Response Display */}
        {voiceState.transcript && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-600 font-medium">Heard: </span>
            <span className="text-blue-900">{voiceState.transcript}</span>
          </div>
        )}
        {voiceState.response && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg">
            <span className="text-sm text-green-600 font-medium">Response: </span>
            <span className="text-green-900">{voiceState.response}</span>
          </div>
        )}

        <Button
          onClick={startVoiceInteraction}
          disabled={isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <span className="animate-pulse">●</span> Processing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <MicIcon /> Simulate Voice Input
            </span>
          )}
        </Button>
      </Card>

      {/* Provider Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* STT Providers */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">STT Providers</h3>
          <div className="space-y-3">
            {sttProviders.map(provider => (
              <div
                key={provider.name}
                className="p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{provider.name}</span>
                  {provider.streaming && (
                    <Badge variant="outline" className="text-xs">Streaming</Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">Latency:</span>
                    <span className="ml-1 font-mono">{provider.latency}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Accuracy:</span>
                    <span className="ml-1">{provider.accuracy}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Cost:</span>
                    <span className="ml-1 font-mono text-xs">{provider.cost}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">Best for: {provider.bestFor}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* TTS Providers */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">TTS Providers</h3>
          <div className="space-y-3">
            {ttsProviders.map(provider => (
              <div
                key={provider.name}
                className="p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{provider.name}</span>
                  {provider.streaming && (
                    <Badge variant="outline" className="text-xs">Streaming</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">Latency:</span>
                    <span className="ml-1 font-mono">{provider.latency}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Quality:</span>
                    <span className="ml-1">{provider.quality}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">Best for: {provider.bestFor}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* History */}
      {history.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Interactions</h3>
          <div className="space-y-3">
            {history.map(item => (
              <div
                key={item.id}
                className="p-3 border rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={confidenceColors[getConfidenceLevel(item.transcript.confidence)]}>
                      {Math.round(item.transcript.confidence * 100)}% conf
                    </Badge>
                    <span className={`text-sm font-mono ${latencyColors[getLatencyRating(item.timings.totalLatency)]}`}>
                      {Math.round(item.timings.totalLatency)}ms
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {item.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-1">
                  <span className="font-medium">User:</span> {item.transcript.text}
                </p>
                <p className="text-sm text-slate-800">
                  <span className="font-medium">AI:</span> {item.response}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function LatencyTab() {
  const [optimizations, setOptimizations] = useState<LatencyOptimization[]>(defaultOptimizations);

  const toggleOptimization = (name: string) => {
    setOptimizations(prev =>
      prev.map(opt =>
        opt.name === name ? { ...opt, enabled: !opt.enabled } : opt
      )
    );
  };

  const enabledSavings = optimizations
    .filter(opt => opt.enabled)
    .reduce((total, opt) => {
      const match = opt.savings.match(/-(\d+)/);
      return total + (match ? parseInt(match[1]) : 0);
    }, 0);

  const baseLatency = 1800;
  const optimizedLatency = Math.max(800, baseLatency - enabledSavings);

  return (
    <div className="space-y-6">
      {/* Latency Thresholds */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Latency Thresholds</h2>
        <p className="text-slate-600 mb-6">
          Users expect &lt;1s response time. &gt;2s feels broken.
        </p>

        <div className="relative h-12 bg-gradient-to-r from-green-200 via-yellow-200 to-red-200 rounded-lg mb-4">
          <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-medium">
            <span>0ms</span>
            <span className="text-green-700">1000ms</span>
            <span className="text-yellow-700">1500ms</span>
            <span className="text-orange-700">2000ms</span>
            <span className="text-red-700">3000ms+</span>
          </div>

          {/* Current Position Marker */}
          <div
            className="absolute top-0 h-full w-1 bg-slate-800 transition-all duration-500"
            style={{
              left: `${Math.min(100, (optimizedLatency / 3000) * 100)}%`,
            }}
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <Badge variant="default">{optimizedLatency}ms</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          <div className="p-2 bg-green-50 rounded">
            <span className="text-green-700 font-medium">Excellent</span>
            <p className="text-xs text-green-600">&lt;1000ms</p>
          </div>
          <div className="p-2 bg-blue-50 rounded">
            <span className="text-blue-700 font-medium">Good</span>
            <p className="text-xs text-blue-600">&lt;1500ms</p>
          </div>
          <div className="p-2 bg-yellow-50 rounded">
            <span className="text-yellow-700 font-medium">Acceptable</span>
            <p className="text-xs text-yellow-600">&lt;2000ms</p>
          </div>
          <div className="p-2 bg-red-50 rounded">
            <span className="text-red-700 font-medium">Poor</span>
            <p className="text-xs text-red-600">&gt;2000ms</p>
          </div>
        </div>
      </Card>

      {/* Optimizations */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Latency Optimizations</h3>
        <p className="text-slate-600 mb-4">
          Toggle optimizations to see their impact on total latency.
        </p>

        <div className="space-y-3">
          {optimizations.map(opt => (
            <div
              key={opt.name}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                opt.enabled
                  ? 'bg-green-50 border-green-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
              onClick={() => toggleOptimization(opt.name)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      opt.enabled
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-slate-300'
                    }`}
                  >
                    {opt.enabled && '✓'}
                  </div>
                  <span className="font-medium">{opt.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={impactColors[opt.impact]}>
                    {opt.impact} impact
                  </Badge>
                  <span className="font-mono text-green-600 text-sm">
                    {opt.savings}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-600 ml-8">{opt.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-slate-100 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Base latency:</span>
            <span className="font-mono">{baseLatency}ms</span>
          </div>
          <div className="flex items-center justify-between text-green-600">
            <span>Savings from optimizations:</span>
            <span className="font-mono">-{enabledSavings}ms</span>
          </div>
          <hr className="my-2 border-slate-300" />
          <div className="flex items-center justify-between font-semibold">
            <span>Optimized latency:</span>
            <span className={`font-mono ${latencyColors[getLatencyRating(optimizedLatency)]}`}>
              {optimizedLatency}ms
            </span>
          </div>
        </div>
      </Card>

      {/* Pipeline Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Typical Pipeline Latency</h3>
        <div className="space-y-4">
          {[
            { stage: 'VAD', range: '50-100ms', color: 'bg-blue-200' },
            { stage: 'STT', range: '200-500ms', color: 'bg-purple-200' },
            { stage: 'LLM (TTFT)', range: '200-800ms', color: 'bg-yellow-200' },
            { stage: 'LLM (Complete)', range: '500-2000ms', color: 'bg-orange-200' },
            { stage: 'TTS', range: '100-300ms', color: 'bg-green-200' },
          ].map(({ stage, range, color }) => (
            <div key={stage} className="flex items-center gap-4">
              <span className="w-28 text-sm text-slate-600">{stage}</span>
              <div className={`h-6 rounded ${color}`} style={{ width: range.includes('2000') ? '60%' : range.includes('800') ? '40%' : '20%' }} />
              <span className="font-mono text-sm">{range}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-slate-500 mt-4">
          Target total: &lt;1500ms for good user experience
        </p>
      </Card>
    </div>
  );
}

function TurnTakingTab() {
  const [state, setState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [events, setEvents] = useState<{ event: string; from: string; to: string; time: Date }[]>([]);

  const simulateEvent = (event: string) => {
    const transitions: Record<string, Record<string, string>> = {
      idle: { wake_word: 'listening', button_press: 'listening' },
      listening: { speech_end: 'processing', timeout: 'idle' },
      processing: { response_ready: 'speaking', error: 'idle' },
      speaking: { speech_complete: 'idle', barge_in: 'listening' },
    };

    const newState = transitions[state]?.[event];
    if (newState) {
      setEvents(prev => [
        { event, from: state, to: newState, time: new Date() },
        ...prev,
      ].slice(0, 10));
      setState(newState as typeof state);
    }
  };

  const getAvailableEvents = () => {
    const eventMap: Record<string, string[]> = {
      idle: ['wake_word', 'button_press'],
      listening: ['speech_end', 'timeout'],
      processing: ['response_ready', 'error'],
      speaking: ['speech_complete', 'barge_in'],
    };
    return eventMap[state] || [];
  };

  return (
    <div className="space-y-6">
      {/* State Machine Visualization */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Voice State Machine</h2>
        <p className="text-slate-600 mb-6">
          Voice interfaces use a state machine for turn-taking between user and AI.
        </p>

        <div className="flex items-center justify-center gap-4 mb-8 flex-wrap">
          {(['idle', 'listening', 'processing', 'speaking'] as const).map(s => (
            <div
              key={s}
              className={`px-6 py-4 rounded-lg border-2 transition-all ${
                state === s
                  ? 'border-blue-500 bg-blue-50 scale-110'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="text-center">
                <div className="text-2xl mb-1">
                  {s === 'idle' && '⏸️'}
                  {s === 'listening' && '🎤'}
                  {s === 'processing' && '⚙️'}
                  {s === 'speaking' && '🔊'}
                </div>
                <span className={`font-medium ${state === s ? 'text-blue-700' : 'text-slate-600'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Event Buttons */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-slate-600 mb-3">Trigger Event:</h4>
          <div className="flex gap-2 flex-wrap">
            {getAvailableEvents().map(event => (
              <Button
                key={event}
                variant="outline"
                size="sm"
                onClick={() => simulateEvent(event)}
              >
                {event.replace(/_/g, ' ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Event Log */}
        {events.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 font-medium text-sm">
              Event Log
            </div>
            <div className="divide-y max-h-60 overflow-y-auto">
              {events.map((e, i) => (
                <div key={i} className="px-4 py-2 text-sm flex items-center gap-4">
                  <span className="text-slate-400 text-xs">
                    {e.time.toLocaleTimeString()}
                  </span>
                  <Badge variant="outline">{e.event}</Badge>
                  <span className="text-slate-500">
                    {e.from} → {e.to}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Turn-Taking Config */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Turn-Taking Configuration</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium mb-2">Listen Timeout</h4>
            <p className="text-sm text-slate-600 mb-2">
              How long to wait for user to start speaking
            </p>
            <span className="font-mono text-lg">5000ms</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium mb-2">Endpointing Delay</h4>
            <p className="text-sm text-slate-600 mb-2">
              Silence duration indicating turn end
            </p>
            <span className="font-mono text-lg">500ms</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium mb-2">Listening Cue</h4>
            <p className="text-sm text-slate-600 mb-2">
              Audio feedback when listening starts
            </p>
            <span className="text-lg">🔔 Chime</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium mb-2">Processing Cue</h4>
            <p className="text-sm text-slate-600 mb-2">
              Audio feedback during processing
            </p>
            <span className="text-lg">⏳ Ambient</span>
          </div>
        </div>
      </Card>

      {/* Barge-In */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Barge-In (Interruption)</h3>
        <p className="text-slate-600 mb-4">
          Allow users to interrupt the AI while it's speaking.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-2">Low Sensitivity</h4>
            <p className="text-sm text-slate-600">
              Requires clear, sustained speech to trigger. Fewer false positives.
            </p>
          </div>
          <div className="p-4 border-2 border-blue-200 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-700 mb-2">Medium Sensitivity</h4>
            <p className="text-sm text-blue-600">
              Balanced detection. Good for most use cases.
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-2">High Sensitivity</h4>
            <p className="text-sm text-slate-600">
              Quick response to any speech. May have false triggers.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ConfirmationsTab() {
  const [selectedAction, setSelectedAction] = useState<RiskyAction | null>(null);
  const [confirmationState, setConfirmationState] = useState<'idle' | 'asking' | 'confirmed' | 'cancelled'>('idle');
  const [userResponse, setUserResponse] = useState('');

  const startConfirmation = (action: RiskyAction) => {
    setSelectedAction(action);
    setConfirmationState('asking');
    setUserResponse('');
  };

  const handleResponse = (response: string) => {
    setUserResponse(response);
    if (!selectedAction) return;

    if (selectedAction.acceptPhrases.some(p => response.toLowerCase().includes(p))) {
      setConfirmationState('confirmed');
    } else if (selectedAction.rejectPhrases.some(p => response.toLowerCase().includes(p))) {
      setConfirmationState('cancelled');
    }
  };

  const reset = () => {
    setSelectedAction(null);
    setConfirmationState('idle');
    setUserResponse('');
  };

  return (
    <div className="space-y-6">
      {/* Why Confirmations */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Confirmations for Risky Actions</h2>
        <p className="text-slate-600 mb-4">
          Voice has no "undo click" - confirm before destructive or sensitive actions.
        </p>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            <strong>Key principle:</strong> "Delete everything" shouldn't just work.
            Always confirm actions that can't be easily undone.
          </p>
        </div>
      </Card>

      {/* Risky Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Risky Actions</h3>
        <p className="text-slate-600 mb-4">
          Select an action to see the confirmation flow.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {riskyActions.map(action => (
            <div
              key={action.id}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedAction?.id === action.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => startConfirmation(action)}
            >
              <h4 className="font-medium mb-1">{action.description}</h4>
              <p className="text-sm text-slate-600 mb-2">
                Action: <code className="bg-slate-100 px-1 rounded">{action.action}</code>
              </p>
              <div className="flex flex-wrap gap-1">
                {action.acceptPhrases.slice(0, 3).map(phrase => (
                  <Badge key={phrase} className="bg-green-100 text-green-700 text-xs">
                    {phrase}
                  </Badge>
                ))}
                {action.rejectPhrases.slice(0, 2).map(phrase => (
                  <Badge key={phrase} className="bg-red-100 text-red-700 text-xs">
                    {phrase}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Confirmation Flow */}
        {selectedAction && (
          <div className="border-2 border-blue-200 rounded-lg p-6 bg-blue-50">
            <h4 className="font-semibold mb-4">Confirmation Flow</h4>

            {confirmationState === 'asking' && (
              <>
                <div className="mb-4 p-4 bg-white rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🔊</span>
                    <span className="font-medium">AI says:</span>
                  </div>
                  <p className="text-slate-700 italic">
                    "{selectedAction.confirmationPrompt.replace(/\{[^}]+\}/g, '[value]')}"
                  </p>
                </div>

                <p className="text-sm text-slate-600 mb-3">Simulate user response:</p>
                <div className="flex flex-wrap gap-2">
                  {[...selectedAction.acceptPhrases, ...selectedAction.rejectPhrases].map(phrase => (
                    <Button
                      key={phrase}
                      variant="outline"
                      size="sm"
                      onClick={() => handleResponse(phrase)}
                      className={
                        selectedAction.acceptPhrases.includes(phrase)
                          ? 'border-green-300 hover:bg-green-50'
                          : 'border-red-300 hover:bg-red-50'
                      }
                    >
                      "{phrase}"
                    </Button>
                  ))}
                </div>
              </>
            )}

            {confirmationState === 'confirmed' && (
              <div className="p-4 bg-green-100 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">✅</span>
                  <span className="font-medium text-green-700">Action Confirmed</span>
                </div>
                <p className="text-green-600">
                  User said: "{userResponse}" - proceeding with {selectedAction.action}
                </p>
                <Button size="sm" variant="outline" className="mt-3" onClick={reset}>
                  Reset
                </Button>
              </div>
            )}

            {confirmationState === 'cancelled' && (
              <div className="p-4 bg-red-100 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">❌</span>
                  <span className="font-medium text-red-700">Action Cancelled</span>
                </div>
                <p className="text-red-600">
                  User said: "{userResponse}" - {selectedAction.action} was not performed
                </p>
                <Button size="sm" variant="outline" className="mt-3" onClick={reset}>
                  Reset
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function ErrorsTab() {
  const [selectedError, setSelectedError] = useState<'low_confidence' | 'silence' | 'timeout' | 'system' | null>(null);

  const errorScenarios = [
    {
      type: 'low_confidence' as const,
      title: 'Low Confidence Recognition',
      description: 'STT returns transcript but with low confidence score',
      example: 'User speaks unclearly or with background noise',
    },
    {
      type: 'silence' as const,
      title: 'No Speech Detected',
      description: 'User triggered listening but said nothing',
      example: 'User pressed button but got distracted',
    },
    {
      type: 'timeout' as const,
      title: 'Response Timeout',
      description: 'System took too long to respond',
      example: 'LLM or TTS service is slow',
    },
    {
      type: 'system' as const,
      title: 'System Error',
      description: 'Technical failure in pipeline',
      example: 'API error, network issue',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Error Recovery */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Error Recovery Patterns</h2>
        <p className="text-slate-600 mb-4">
          Most voice sessions have misunderstandings. Design for errors, not just success.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {errorScenarios.map(scenario => (
            <div
              key={scenario.type}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedError === scenario.type
                  ? 'border-red-500 bg-red-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setSelectedError(scenario.type)}
            >
              <h4 className="font-medium mb-1">{scenario.title}</h4>
              <p className="text-sm text-slate-600 mb-2">{scenario.description}</p>
              <p className="text-xs text-slate-400">Example: {scenario.example}</p>
            </div>
          ))}
        </div>

        {/* Recovery Display */}
        {selectedError && (
          <div className="mt-6 p-4 border-2 border-red-200 bg-red-50 rounded-lg">
            <h4 className="font-semibold mb-3">Recovery Response</h4>
            <div className="p-4 bg-white rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🔊</span>
                <span className="font-medium">AI says:</span>
              </div>
              <p className="text-slate-700 italic">
                "{getVoiceError(selectedError, selectedError === 'low_confidence' ? 0.4 : undefined).recovery}"
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* When to Use Voice */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">When to Use Voice</h3>
        <p className="text-slate-600 mb-4">
          Voice adds complexity. Only use where it genuinely adds value.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-green-700 mb-3 flex items-center gap-2">
              <span>✓</span> Good Fit
            </h4>
            <div className="space-y-2">
              {voiceUseCases.goodFit.map(item => (
                <div key={item.use} className="p-3 bg-green-50 rounded-lg">
                  <span className="font-medium text-green-800">{item.use}</span>
                  <p className="text-sm text-green-600">{item.example}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-medium text-red-700 mb-3 flex items-center gap-2">
              <span>✗</span> Poor Fit
            </h4>
            <div className="space-y-2">
              {voiceUseCases.poorFit.map(item => (
                <div key={item.use} className="p-3 bg-red-50 rounded-lg">
                  <span className="font-medium text-red-800">{item.use}</span>
                  <p className="text-sm text-red-600">{item.example}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Common Pitfalls */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Common Pitfalls</h3>
        <div className="space-y-3">
          {[
            {
              pitfall: 'Ignoring latency',
              impact: '>2s response time kills voice UX',
              fix: 'Measure and optimize every pipeline stage',
            },
            {
              pitfall: 'No confirmation for actions',
              impact: '"Delete everything" just works',
              fix: 'Confirm before destructive actions',
            },
            {
              pitfall: 'Optimizing only for happy path',
              impact: 'Poor handling of misunderstandings',
              fix: 'Design error recovery flows first',
            },
            {
              pitfall: 'Voice where text is better',
              impact: 'Frustrating experience, low adoption',
              fix: 'Evaluate if voice adds genuine value',
            },
          ].map(item => (
            <div key={item.pitfall} className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-start gap-4">
                <span className="text-red-500 text-lg">⚠️</span>
                <div className="flex-1">
                  <h5 className="font-medium">{item.pitfall}</h5>
                  <p className="text-sm text-red-600 mb-1">{item.impact}</p>
                  <p className="text-sm text-green-600">Fix: {item.fix}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Helper Components
function PipelineStage({
  name,
  description,
  latency,
  active,
  subLatency,
}: {
  name: string;
  description: string;
  latency?: number;
  active: boolean;
  subLatency?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center p-4 rounded-lg min-w-[100px] transition-all ${
        active ? 'bg-blue-100 scale-105' : 'bg-white'
      }`}
    >
      <span className="font-bold text-lg">{name}</span>
      <span className="text-xs text-slate-500 text-center">{description}</span>
      {latency !== undefined && (
        <span className="font-mono text-sm text-blue-600 mt-1">
          {Math.round(latency)}ms
        </span>
      )}
      {subLatency && (
        <span className="text-xs text-slate-400">{subLatency}</span>
      )}
    </div>
  );
}

function Arrow() {
  return (
    <div className="text-slate-400 text-2xl px-2">→</div>
  );
}

function MicIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-14 0m14 0v2a7 7 0 01-14 0v-2m14 0h-4m-6 0H5m7-7a3 3 0 00-3 3v4a3 3 0 006 0V7a3 3 0 00-3-3z"
      />
    </svg>
  );
}
