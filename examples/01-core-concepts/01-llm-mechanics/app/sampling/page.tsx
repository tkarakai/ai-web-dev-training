'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Slider } from '@examples/shared/components/ui/slider';
import { useLlama } from '@examples/shared/lib/hooks';
import { ArrowLeft, Thermometer, Filter, RotateCcw, Play } from 'lucide-react';

const SAMPLE_PROMPTS = [
  'Complete this sentence: The future of AI is',
  'Write a creative opening line for a story',
  'Suggest a name for a new tech startup',
  'Complete: Once upon a time in a land far away,',
];

export default function SamplingPage() {
  const { messages, isLoading, sendMessage, clearMessages } = useLlama();
  const [temperature, setTemperature] = React.useState([0.7]);
  const [topP, setTopP] = React.useState([0.9]);
  const [selectedPrompt, setSelectedPrompt] = React.useState(SAMPLE_PROMPTS[0]);
  const [customPrompt, setCustomPrompt] = React.useState('');

  const handleGenerate = async () => {
    const prompt = customPrompt.trim() || selectedPrompt;

    const systemPrompt = `You are a helpful assistant. Generate a short, creative response (2-3 sentences max).

Temperature: ${temperature[0]}
Top-P: ${topP[0]}

User prompt: ${prompt}`;

    await sendMessage(systemPrompt);
  };

  const getTemperatureDescription = (temp: number) => {
    if (temp < 0.3) return 'Deterministic - Very focused, predictable outputs';
    if (temp < 0.7) return 'Balanced - Mix of consistency and creativity';
    if (temp < 1.2) return 'Creative - More varied and unexpected outputs';
    return 'Very Creative - Highly random, potentially incoherent';
  };

  const getTopPDescription = (p: number) => {
    if (p < 0.5) return 'Restricted - Only most likely tokens considered';
    if (p < 0.9) return 'Balanced - Good mix of likely tokens';
    return 'Diverse - Wide range of token choices allowed';
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="mb-4 inline-block">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Token Visualizer
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-2">Sampling Playground</h1>
        <p className="text-muted-foreground">
          Experiment with temperature and top-p to see how they affect LLM outputs
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Controls */}
        <div className="space-y-6">
          {/* Temperature Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Thermometer className="w-4 h-4 text-primary" />
                Temperature
              </CardTitle>
              <CardDescription className="text-xs">
                Controls randomness in output selection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary">{temperature[0].toFixed(2)}</span>
                  <Badge variant={temperature[0] < 0.7 ? 'secondary' : temperature[0] < 1.2 ? 'default' : 'warning'} className="text-xs">
                    {temperature[0] < 0.3 ? 'Focused' : temperature[0] < 1.2 ? 'Balanced' : 'Random'}
                  </Badge>
                </div>

                <Slider
                  min={0}
                  max={2}
                  step={0.1}
                  value={temperature}
                  onValueChange={setTemperature}
                  className="w-full"
                />

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.0</span>
                  <span>1.0</span>
                  <span>2.0</span>
                </div>
              </div>

              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  {getTemperatureDescription(temperature[0])}
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
                  <div>
                    <strong>Low (0.0-0.3):</strong> Deterministic, factual tasks
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <strong>Medium (0.5-0.9):</strong> General purpose, balanced
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500 mt-1 flex-shrink-0" />
                  <div>
                    <strong>High (1.0+):</strong> Creative writing, brainstorming
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top-P Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="w-4 h-4 text-primary" />
                Top-P (Nucleus Sampling)
              </CardTitle>
              <CardDescription className="text-xs">
                Limits token selection to cumulative probability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary">{topP[0].toFixed(2)}</span>
                  <Badge variant={topP[0] < 0.8 ? 'secondary' : 'default'} className="text-xs">
                    {topP[0] < 0.8 ? 'Restricted' : 'Diverse'}
                  </Badge>
                </div>

                <Slider
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={topP}
                  onValueChange={setTopP}
                  className="w-full"
                />

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.1</span>
                  <span>0.5</span>
                  <span>1.0</span>
                </div>
              </div>

              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  {getTopPDescription(topP[0])}
                </p>
              </div>

              <div className="p-3 bg-muted rounded-lg text-xs">
                <strong>How it works:</strong> With top-p=0.9, the model only considers tokens whose cumulative probability adds up to 90%. This dynamically adjusts the vocabulary size based on confidence.
              </div>
            </CardContent>
          </Card>

          {/* Preset Configurations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Presets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setTemperature([0.2]);
                  setTopP([0.5]);
                }}
              >
                <span className="text-xs">🎯 Precise (temp=0.2, top-p=0.5)</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setTemperature([0.7]);
                  setTopP([0.9]);
                }}
              >
                <span className="text-xs">⚖️ Balanced (temp=0.7, top-p=0.9)</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setTemperature([1.2]);
                  setTopP([0.95]);
                }}
              >
                <span className="text-xs">🎨 Creative (temp=1.2, top-p=0.95)</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setTemperature([1.5]);
                  setTopP([1.0]);
                }}
              >
                <span className="text-xs">🎲 Wild (temp=1.5, top-p=1.0)</span>
              </Button>
            </CardContent>
          </Card>

          {/* Key Concepts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Understanding Sampling</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div>
                <strong className="text-foreground">Temperature:</strong> Scales the probability distribution. Lower = more confident, higher = more random.
              </div>
              <div>
                <strong className="text-foreground">Top-P:</strong> Considers only tokens that collectively have probability p. More adaptive than top-k.
              </div>
              <div>
                <strong className="text-foreground">Best Practice:</strong> Use temperature for creativity level, top-p for vocabulary diversity.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Generation */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prompt Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select or Create Prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sample Prompts</label>
                <div className="grid grid-cols-1 gap-2">
                  {SAMPLE_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedPrompt(prompt);
                        setCustomPrompt('');
                      }}
                      className={`text-left p-3 rounded-lg border transition-colors text-sm ${
                        selectedPrompt === prompt && !customPrompt
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary hover:bg-accent'
                      }`}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Or enter custom prompt</label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Enter your own prompt..."
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm min-h-[80px]"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || (!customPrompt.trim() && !selectedPrompt)}
                  className="flex-1"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isLoading ? 'Generating...' : 'Generate Response'}
                </Button>
                <Button
                  variant="outline"
                  onClick={clearMessages}
                  disabled={messages.length === 0}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Note: Running multiple generations with the same prompt will show variation based on your sampling parameters.
              </p>
            </CardContent>
          </Card>

          {/* Generated Responses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generated Responses ({messages.length})</CardTitle>
              <CardDescription className="text-xs">
                Compare outputs with different sampling parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Thermometer className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No responses yet. Adjust parameters and click "Generate Response" to see results.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200'
                          : 'bg-slate-50 dark:bg-slate-900/30 border border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {message.role}
                        </Badge>
                        {message.metadata?.latencyMs && (
                          <Badge variant="outline" className="text-xs">
                            {message.metadata.latencyMs}ms
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visualization Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">What to Observe</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <h4 className="font-semibold">With Low Temperature (0.1-0.3)</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• More repetitive outputs</li>
                  <li>• Predictable, safe responses</li>
                  <li>• Good for factual content</li>
                  <li>• Less variation between runs</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">With High Temperature (1.0+)</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• More diverse outputs</li>
                  <li>• Unexpected word choices</li>
                  <li>• Better for creative tasks</li>
                  <li>• High variation between runs</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">With Low Top-P (0.5)</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Restricts vocabulary</li>
                  <li>• More conventional language</li>
                  <li>• Fewer surprising words</li>
                  <li>• Consistent style</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">With High Top-P (0.95+)</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Allows rare words</li>
                  <li>• More vocabulary variety</li>
                  <li>• Potentially unusual choices</li>
                  <li>• Greater expressiveness</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
