'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Input } from '@examples/shared/components/ui/input';
import { Textarea } from '@examples/shared/components/ui/textarea';
import { ChatInput } from '@examples/shared/components/chat/chat-input';
import { Message } from '@examples/shared/components/chat/message';
import { useLlama } from '@examples/shared/lib/hooks';
import { generateId } from '@examples/shared/lib/utils';
import {
  MessageSquare,
  Plus,
  Trash2,
  Download,
  Upload,
  Edit2,
  Check,
  X,
  History,
  Settings,
  Info,
} from 'lucide-react';
import { useConversations, type Conversation } from '../lib/use-conversations';
import type { AIMessage } from '@examples/shared/types';

export default function MessageDesignPage() {
  const {
    conversations,
    currentConversation,
    createConversation,
    selectConversation,
    deleteConversation,
    addMessage,
    updateTitle,
    clearAll,
    exportConversations,
    importConversations,
  } = useConversations();

  const { isLoading, sendMessage: sendLlamaMessage } = useLlama();
  const [showMetadata, setShowMetadata] = React.useState(true);
  const [showRawData, setShowRawData] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [systemPrompt, setSystemPrompt] = React.useState('You are a helpful AI assistant.');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages]);

  const handleSend = async (content: string) => {
    if (!currentConversation) {
      createConversation(systemPrompt);
    }

    // Add user message
    const userMessage: AIMessage = {
      id: generateId('msg'),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    addMessage(userMessage);

    // Get AI response
    try {
      // Build messages array for context
      const contextMessages: AIMessage[] = [
        {
          id: generateId('sys'),
          role: 'system',
          content: currentConversation?.systemPrompt || systemPrompt,
          timestamp: new Date(),
        },
        ...(currentConversation?.messages || []),
        userMessage,
      ];

      // Use the llama client directly for this example
      const response = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-oss-20b',
          messages: contextMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || 'No response';

      const assistantMessage: AIMessage = {
        id: generateId('msg'),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        metadata: {
          model: 'gpt-oss-20b',
          latencyMs: Date.now() - userMessage.timestamp.getTime(),
          tokenCount: data.usage ? {
            input: data.usage.prompt_tokens,
            output: data.usage.completion_tokens,
            total: data.usage.total_tokens,
          } : undefined,
          rawRequest: {
            url: 'http://127.0.0.1:8033/v1/chat/completions',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
              model: 'gpt-oss-20b',
              messages: contextMessages.map(m => ({ role: m.role, content: m.content })),
              temperature: 0.7,
            },
          },
          rawResponse: {
            status: response.status,
            body: data,
          },
        },
      };
      addMessage(assistantMessage);
    } catch (error) {
      const errorMessage: AIMessage = {
        id: generateId('msg'),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please make sure llama-server is running.',
        timestamp: new Date(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      addMessage(errorMessage);
    }
  };

  const handleNewConversation = () => {
    createConversation(systemPrompt);
  };

  const handleExport = () => {
    const json = exportConversations();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversations-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const json = e.target?.result as string;
      importConversations(json);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const startEditing = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveEdit = () => {
    if (editingId && editTitle.trim()) {
      updateTitle(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Message Design</h1>
        <p className="text-muted-foreground">
          Conversation persistence, memory management, and multi-conversation handling
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          📖 <Link href="https://github.com/yourusername/ai-web-dev-training/blob/main/docs/04-shipping-ai-features/message-design.md" className="text-primary hover:underline">Read the documentation</Link>
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link href="/">
          <Button variant="default">Conversations</Button>
        </Link>
        <Link href="/memory">
          <Button variant="outline">Memory Patterns</Button>
        </Link>
        <Link href="/context">
          <Button variant="outline">Context Window</Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Conversations List */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Conversations</CardTitle>
                <Button size="sm" onClick={handleNewConversation}>
                  <Plus className="w-4 h-4 mr-1" />
                  New
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No conversations yet</p>
                  <p className="text-xs mt-1">Click "New" to start</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      currentConversation?.id === conv.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => selectConversation(conv.id)}
                  >
                    {editingId === conv.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <Button size="sm" variant="ghost" onClick={saveEdit}>
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <span className="text-sm font-medium truncate flex-1">
                            {conv.title}
                          </span>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(conv);
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {conv.messages.length} msgs
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(conv.updatedAt)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Import/Export */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Data Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleExport}
                disabled={conversations.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export All
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
              {conversations.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive"
                  onClick={() => {
                    if (confirm('Delete all conversations?')) {
                      clearAll();
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Display Options */}
          <Card>
            <CardHeader className="pb-3">
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
                <span className="text-sm">Show metadata</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRawData}
                  onChange={(e) => setShowRawData(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show raw HTTP</span>
              </label>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Chat */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="h-[700px] flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    {currentConversation?.title || 'Select a Conversation'}
                  </CardTitle>
                  <CardDescription>
                    {currentConversation
                      ? `${currentConversation.messages.length} message${currentConversation.messages.length !== 1 ? 's' : ''}`
                      : 'Create or select a conversation to start'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                {!currentConversation ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div className="space-y-2">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                        <MessageSquare className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">No Conversation Selected</h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Create a new conversation or select an existing one from the sidebar.
                      </p>
                      <Button onClick={handleNewConversation} className="mt-4">
                        <Plus className="w-4 h-4 mr-2" />
                        Start New Conversation
                      </Button>
                    </div>
                  </div>
                ) : currentConversation.messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div className="space-y-2">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                        <MessageSquare className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">Start Chatting</h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Send a message to begin this conversation.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {currentConversation.messages.map((message) => (
                      <Message
                        key={message.id}
                        message={message}
                        showMetadata={showMetadata}
                        showRawData={showRawData}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
              <ChatInput
                onSend={handleSend}
                disabled={isLoading}
                placeholder="Type a message..."
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Info & Settings */}
        <div className="space-y-4">
          {/* System Prompt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Settings className="w-4 h-4" />
                System Prompt
              </CardTitle>
              <CardDescription className="text-xs">
                Used for new conversations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful AI assistant..."
                className="min-h-[100px] text-sm"
              />
            </CardContent>
          </Card>

          {/* Key Concepts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-primary" />
                Message Design Patterns
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <strong className="text-primary">Persistence</strong>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Conversations saved to localStorage (production would use a database)
                </p>
              </div>
              <div>
                <strong className="text-primary">Context Management</strong>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Full conversation history sent as context for continuity
                </p>
              </div>
              <div>
                <strong className="text-primary">Multi-Conversation</strong>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Switch between conversations without losing progress
                </p>
              </div>
              <div>
                <strong className="text-primary">Import/Export</strong>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Backup and restore conversation data as JSON
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          {currentConversation && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <History className="w-4 h-4" />
                  Conversation Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Messages:</span>
                  <span className="font-medium">{currentConversation.messages.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">
                    {currentConversation.createdAt.toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated:</span>
                  <span className="font-medium">
                    {formatDate(currentConversation.updatedAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User msgs:</span>
                  <span className="font-medium">
                    {currentConversation.messages.filter(m => m.role === 'user').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI msgs:</span>
                  <span className="font-medium">
                    {currentConversation.messages.filter(m => m.role === 'assistant').length}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Best Practices */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>• Auto-save after each message</p>
              <p>• Generate titles from first message</p>
              <p>• Handle context window limits</p>
              <p>• Support conversation branching</p>
              <p>• Enable search across conversations</p>
              <p>• Implement conversation summarization</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
