'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Input } from '@examples/shared/components/ui/input';
import { Badge } from '@examples/shared/components/ui/badge';
import { ChatThread } from '@examples/shared/components/chat/chat-thread';
import { useLlama } from '@examples/shared/lib/hooks';
import { ArrowLeft, Play, Pause, RotateCcw } from 'lucide-react';
import type { AIMessage } from '@examples/shared/types';
import { generateId } from '@examples/shared/lib/utils';

export default function AgentPage() {
  const { messages, isLoading, sendMessage, clearMessages } = useLlama();
  const [goal, setGoal] = React.useState('Plan a birthday party for a 10-year-old');
  const [isRunning, setIsRunning] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [showMetadata, setShowMetadata] = React.useState(true);
  const [showRawData, setShowRawData] = React.useState(false);
  const maxSteps = 5;

  const runAgentStep = async (currentMessages: AIMessage[]) => {
    if (step >= maxSteps) {
      setIsRunning(false);
      return;
    }

    const agentPrompt = `You are an AI agent working on this goal: "${goal}"

${step === 0 ? 'Break down this goal into clear, actionable steps. List 3-5 specific tasks.' : `Previous steps completed: ${step}/${maxSteps}

Continue working on the goal. What's the next step to take? Be specific and actionable.`}`;

    await sendMessage(agentPrompt);
    setStep((prev) => prev + 1);
  };

  const startAgent = async () => {
    if (!goal.trim()) return;
    clearMessages();
    setStep(0);
    setIsRunning(true);
    setTimeout(() => runAgentStep([]), 500);
  };

  const stopAgent = () => {
    setIsRunning(false);
  };

  const resetAgent = () => {
    setIsRunning(false);
    setStep(0);
    clearMessages();
  };

  // Auto-continue agent loop
  React.useEffect(() => {
    if (isRunning && !isLoading && step > 0 && step < maxSteps) {
      const timer = setTimeout(() => {
        runAgentStep(messages);
      }, 2000);
      return () => clearTimeout(timer);
    } else if (step >= maxSteps) {
      setIsRunning(false);
    }
  }, [isRunning, isLoading, step, messages]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="mb-4 inline-block">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Playground
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-2">Agent Loop</h1>
        <p className="text-muted-foreground">
          Watch an AI agent break down and work through a multi-step task
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column - Controls */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Configuration</CardTitle>
              <CardDescription>
                Define a goal for the agent to work on
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Goal</label>
                <Input
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Enter a goal or task..."
                  disabled={isRunning}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Examples: "Plan a road trip", "Create a weekly meal plan", "Organize a team meeting"
                </p>
              </div>

              <div className="flex gap-2">
                {!isRunning ? (
                  <Button
                    onClick={startAgent}
                    disabled={!goal.trim() || isLoading}
                    className="flex-1"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Agent
                  </Button>
                ) : (
                  <Button
                    onClick={stopAgent}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Stop Agent
                  </Button>
                )}
                <Button onClick={resetAgent} variant="outline">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Agent Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant={isRunning ? 'default' : 'secondary'}>
                  {isRunning ? 'Running' : isLoading ? 'Thinking' : 'Idle'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Progress:</span>
                <span className="text-sm font-medium">{step} / {maxSteps} steps</span>
              </div>

              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(step / maxSteps) * 100}%` }}
                />
              </div>

              {step >= maxSteps && (
                <div className="text-sm text-green-600 dark:text-green-400">
                  ✓ Agent completed all steps
                </div>
              )}
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">How Agent Loops Work</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>
                <strong className="text-foreground">1. Plan:</strong> Agent breaks down the goal into steps
              </div>
              <div>
                <strong className="text-foreground">2. Act:</strong> Executes each step sequentially
              </div>
              <div>
                <strong className="text-foreground">3. Observe:</strong> Reviews progress after each action
              </div>
              <div>
                <strong className="text-foreground">4. Repeat:</strong> Continues until goal is achieved
              </div>
              <div className="pt-3 border-t text-xs">
                <p>
                  <strong>Note:</strong> This is a simplified demonstration. Production agents use tools, memory, and more sophisticated planning.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Agent Output */}
        <div className="space-y-6">
          <Card className="h-[700px] flex flex-col">
            <CardHeader>
              <CardTitle>Agent Thoughts & Actions</CardTitle>
              <CardDescription>
                {messages.length === 0
                  ? 'Start the agent to see its reasoning process'
                  : `Observing step ${step} of ${maxSteps}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ChatThread
                messages={messages}
                isLoading={isLoading}
                showMetadata={showMetadata}
                showRawData={showRawData}
                className="h-full"
              />
            </CardContent>
          </Card>

          {/* Display Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Display Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMetadata}
                  onChange={(e) => setShowMetadata(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show metadata (model, tokens, latency)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRawData}
                  onChange={(e) => setShowRawData(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show raw HTTP request/response</span>
              </label>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
