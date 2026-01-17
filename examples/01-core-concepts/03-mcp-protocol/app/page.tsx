'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Input } from '@examples/shared/components/ui/input';
import { ChatThread } from '@examples/shared/components/chat/chat-thread';
import { useLlama } from '@examples/shared/lib/hooks';
import { AVAILABLE_TOOLS, executeTool, formatToolsForLLM } from '../lib/tools';
import { Wrench, Zap, CheckCircle, XCircle } from 'lucide-react';
import type { AIMessage } from '@examples/shared/types';
import { generateId } from '@examples/shared/lib/utils';

const EXAMPLE_PROMPTS = [
  "What's the weather in San Francisco?",
  "Calculate 42 multiply 17",
  "What time is it in Tokyo?",
  "Search for information about TypeScript",
];

export default function MCPProtocolPage() {
  const { messages, isLoading, sendMessage, clearMessages } = useLlama();
  const [userInput, setUserInput] = React.useState('');
  const [toolCalls, setToolCalls] = React.useState<Array<{
    id: string;
    name: string;
    params: any;
    result: string;
    status: 'pending' | 'success' | 'error';
  }>>([]);

  const handleSend = async () => {
    if (!userInput.trim() || isLoading) return;

    const userMessage = userInput;
    setUserInput('');

    // Create system prompt with available tools
    const systemPrompt = `You are an AI assistant with access to the following tools:

${formatToolsForLLM()}

When you need to use a tool, respond ONLY with a JSON object in this format:
{
  "tool": "tool_name",
  "parameters": { ... }
}

If you don't need to use a tool, respond normally.

User question: ${userMessage}`;

    // Send to LLM
    await sendMessage(systemPrompt);

    // Check if response includes tool call
    // (In a real implementation, this would parse the LLM response)
    // For now, we'll simulate basic tool calling
    await simulateToolCall(userMessage);
  };

  const simulateToolCall = async (userMessage: string) => {
    // Simple pattern matching for demo purposes
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('weather')) {
      const location = extractLocation(userMessage) || 'San Francisco';
      await callTool('get_weather', { location });
    } else if (lowerMessage.includes('calculate') || lowerMessage.includes('multiply') || lowerMessage.includes('add')) {
      const numbers = userMessage.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        const operation = lowerMessage.includes('add') ? 'add'
          : lowerMessage.includes('subtract') ? 'subtract'
          : lowerMessage.includes('multiply') ? 'multiply'
          : 'add';
        await callTool('calculate', {
          operation,
          a: parseInt(numbers[0]),
          b: parseInt(numbers[1]),
        });
      }
    } else if (lowerMessage.includes('time')) {
      const timezone = extractTimezone(userMessage);
      await callTool('get_current_time', { timezone });
    } else if (lowerMessage.includes('search')) {
      const query = userMessage.replace(/search (for|about)?/i, '').trim();
      await callTool('web_search', { query });
    }
  };

  const callTool = async (toolName: string, params: any) => {
    const toolCallId = generateId('tool');

    // Add pending tool call
    setToolCalls(prev => [...prev, {
      id: toolCallId,
      name: toolName,
      params,
      result: '',
      status: 'pending',
    }]);

    try {
      const result = await executeTool(toolName, params);

      // Update tool call with result
      setToolCalls(prev => prev.map(tc =>
        tc.id === toolCallId
          ? { ...tc, result, status: 'success' as const }
          : tc
      ));

      // Feed tool result back to the model
      const toolResultPrompt = `You previously called the tool "${toolName}" with parameters ${JSON.stringify(params)}.

The tool returned: ${result}

Please use this information to answer the user's question in a natural, conversational way.`;

      await sendMessage(toolResultPrompt);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      setToolCalls(prev => prev.map(tc =>
        tc.id === toolCallId
          ? { ...tc, result: errorMessage, status: 'error' as const }
          : tc
      ));

      // Also inform the model about the error
      const errorPrompt = `The tool "${toolName}" failed with error: ${errorMessage}

Please let the user know that you encountered an issue and suggest an alternative if possible.`;

      await sendMessage(errorPrompt);
    }
  };

  const extractLocation = (text: string): string | null => {
    const match = text.match(/in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    return match ? match[1] : null;
  };

  const extractTimezone = (text: string): string | undefined => {
    const match = text.match(/in\s+([A-Z][a-z]+)/);
    if (!match) return undefined;

    const city = match[1];
    const timezoneMap: Record<string, string> = {
      Tokyo: 'Asia/Tokyo',
      London: 'Europe/London',
      'New York': 'America/New_York',
      Paris: 'Europe/Paris',
    };
    return timezoneMap[city];
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">MCP Protocol & Tool Calling</h1>
        <p className="text-muted-foreground">
          Demonstrate Model Context Protocol: tools, capabilities, and structured interactions
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          📖 <Link href="https://github.com/yourusername/ai-web-dev-training/blob/main/docs/01-core-concepts/mcp-protocol.md" className="text-primary hover:underline">Read the documentation</Link>
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column - Tools & Input */}
        <div className="space-y-6">
          {/* Available Tools */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                Available Tools
              </CardTitle>
              <CardDescription>
                {AVAILABLE_TOOLS.length} tools accessible to the AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {AVAILABLE_TOOLS.map((tool) => (
                <div key={tool.name} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium">{tool.name}</span>
                    <Badge variant="secondary" className="text-xs">Tool</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{tool.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* User Input */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Ask a Question</CardTitle>
              <CardDescription className="text-xs">
                Try asking about weather, calculations, time, or searching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {EXAMPLE_PROMPTS.map((prompt, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => setUserInput(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask me anything..."
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={isLoading || !userInput.trim()}
                >
                  <Zap className="w-4 h-4" />
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearMessages();
                  setToolCalls([]);
                }}
                disabled={messages.length === 0 && toolCalls.length === 0}
              >
                Clear All
              </Button>
            </CardContent>
          </Card>

          {/* MCP Concepts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">MCP Key Concepts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>
                <strong className="text-foreground">Tool Discovery:</strong> AI learns what tools are available
              </div>
              <div>
                <strong className="text-foreground">Capability Scoping:</strong> Tools have defined parameters and permissions
              </div>
              <div>
                <strong className="text-foreground">Structured Calling:</strong> JSON-based tool invocation
              </div>
              <div>
                <strong className="text-foreground">Result Integration:</strong> Tool outputs feed back to the AI
              </div>
              <div className="pt-3 border-t text-xs">
                <strong>Note:</strong> This is a simplified demonstration. Production MCP implementations use the full MCP SDK for secure, standardized tool integration.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Conversation */}
        <div className="space-y-6">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
              <CardDescription>
                AI responses with tool integration
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ChatThread
                messages={messages}
                isLoading={isLoading}
                showMetadata={true}
                className="h-full"
              />
            </CardContent>
          </Card>

          {/* Tool Execution Log */}
          {toolCalls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Wrench className="w-4 h-4" />
                  Tool Execution Log
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {toolCalls.map((tc) => (
                  <div
                    key={tc.id}
                    className="p-3 rounded-lg border border-border space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium">{tc.name}</span>
                      {tc.status === 'success' && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {tc.status === 'error' && (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      {tc.status === 'pending' && (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="text-muted-foreground">
                        Parameters: <code className="bg-muted px-1 py-0.5 rounded">
                          {JSON.stringify(tc.params)}
                        </code>
                      </div>
                      {tc.result && (
                        <div className={tc.status === 'error' ? 'text-red-500' : 'text-foreground'}>
                          Result: <code className="bg-muted px-1 py-0.5 rounded text-xs">
                            {tc.result}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
