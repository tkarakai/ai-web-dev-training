# Quick Start Guide

## What We've Built

A complete, production-ready infrastructure for AI web development practice examples:

### ✅ Shared Package (`@examples/shared`)
- **AI Client**: Llama.cpp integration with cloud fallback
- **UI Components**: shadcn/ui (Button, Card, Input, Textarea, Badge)
- **Chat Components**: Message, ChatInput, ChatThread
- **Utilities**: Token estimation, error handling, cost calculation
- **Types**: Comprehensive TypeScript definitions

### ✅ First Example (`01-llm-mechanics`)
- Interactive token visualizer
- Real-time cost calculator
- Educational tool (no AI API required)

## Running the Example

### Step 1: Navigate to the example
```bash
cd /Users/tamas/dev/projects/ai-web-dev-training/examples/01-core-concepts/01-llm-mechanics
```

### Step 2: Start the development server
```bash
bun run dev
```

### Step 3: Open in browser
The terminal will show you the URL (usually `http://localhost:3000` or `http://localhost:3002`).

Open that URL in your browser to see the interactive LLM Mechanics tool!

## What You'll See

The example includes:

1. **Token Visualizer**
   - Enter any text to see token count estimates
   - Sample texts for quick testing (Short, Function, Paragraph)
   - Character and word counts

2. **Cost Calculator**
   - Select from 8+ models (GPT-4o, Claude, Gemini, local models)
   - Real-time cost estimates
   - Input vs output cost breakdown
   - Pricing: Jan 2026 rates

3. **Key Concepts**
   - Educational content about tokens, context windows, costs
   - No AI API calls needed - pure frontend tool

## Troubleshooting

### Port already in use
If you see "Port 3000 is in use", the server will automatically use the next available port (3001, 3002, etc.). Check the terminal output for the actual URL.

### Lock file error
If you see "Unable to acquire lock", another dev server is running:
```bash
# Kill any running Next.js servers
pkill -f "next dev"

# Then try again
bun run dev
```

### Module not found errors
If you see module errors:
```bash
# Re-install dependencies from the examples root
cd /Users/tamas/dev/projects/ai-web-dev-training/examples
bun install

# Then try the example again
cd 01-core-concepts/01-llm-mechanics
bun run dev
```

## What's Next?

After exploring the first example, you can:

1. **Read the plan** at `/Users/tamas/.claude/plans/peaceful-greeting-cloud.md`
2. **Create more examples** following the same structure
3. **Start building** the next example: `02-prompting` (which will use llama-server)

## File Structure

```
examples/
├── shared/                           # Shared utilities and components
│   ├── lib/ai/llama-client.ts       # AI client with cloud fallback
│   ├── components/                   # UI components
│   └── types/index.ts               # TypeScript types
└── 01-core-concepts/
    └── 01-llm-mechanics/            # First example
        ├── app/page.tsx             # Main page
        └── README.md                # Detailed docs
```

## Tech Stack

- **Next.js 16.1** - App Router
- **React 19** - Latest React
- **TypeScript 5.7** - Type safety
- **Tailwind CSS 3.4** - Styling
- **Bun** - Fast runtime
- **shadcn/ui** - UI components

## Success!

You now have a working example! Try these:

1. Paste different text samples
2. Switch between models to see cost differences
3. Notice how output tokens cost 2-5x more
4. See that local models (gpt-oss-20b) are free!

Enjoy exploring! 🚀
