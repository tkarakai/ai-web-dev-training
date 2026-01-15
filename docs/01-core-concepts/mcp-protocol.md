# MCP Protocol Overview

> Model Context Protocol—the standard interface for connecting AI models to tools and data sources.

## TL;DR

- MCP is an **open standard** for tool and context interfaces, adopted by OpenAI, Anthropic, Google, and others
- Core primitives: **servers** (providers), **tools** (actions), **resources** (data), **prompts** (templates)
- Think of it as **USB for AI**: standardized connections between models and external capabilities
- Security matters: **treat MCP servers as privileged code**—scope permissions carefully
- MCP replaced fragmented tool integrations with a **portable, interoperable standard**

## Core Concepts

### What MCP Is

Model Context Protocol (MCP) standardizes how AI models interact with external tools and data sources. Before MCP, every tool integration was custom—different APIs, different auth patterns, different data formats.

MCP provides:
- **Standard interface**: One protocol for all tool types
- **Portability**: Servers work across different AI clients
- **Discovery**: Models can discover what tools are available
- **Security model**: Scoped capabilities with explicit permissions

```
┌─────────────┐     MCP Protocol     ┌─────────────┐
│   AI Model  │ ←─────────────────→  │ MCP Server  │
│  (Client)   │                      │   (Tools)   │
└─────────────┘                      └─────────────┘
      │                                     │
      │         Standard messages           │
      │    - Tool calls & responses         │
      │    - Resource access                │
      │    - Prompt templates               │
      └─────────────────────────────────────┘
```

### Adoption

MCP was introduced by Anthropic in November 2024. Within a year:
- **OpenAI** adopted MCP across ChatGPT and API (March 2025)
- **Google DeepMind** integrated MCP support
- Major IDEs added MCP support (VS Code, JetBrains, Cursor)
- **December 2025**: Anthropic donated MCP to the Linux Foundation's Agentic AI Foundation (AAIF), co-founded with Block and OpenAI

This makes MCP the de facto standard for AI tool integration.

### Core Primitives

MCP has four core building blocks:

```
MCP Architecture
────────────────

┌──────────────────────────────────────────────────────────────────┐
│                          MCP SERVER                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌───────────┐   ┌───────────┐   ┌────────────┐   ┌──────────┐  │
│   │   TOOLS   │   │ RESOURCES │   │  PROMPTS   │   │ SAMPLING │  │
│   │           │   │           │   │            │   │          │  │
│   │ • Actions │   │ • Data    │   │ • Templates│   │ • LLM    │  │
│   │ • Side    │   │ • Files   │   │ • Workflows│   │   calls  │  │
│   │   effects │   │ • APIs    │   │ • Reusable │   │          │  │
│   └───────────┘   └───────────┘   └────────────┘   └──────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
         ▲
         │  JSON-RPC over stdio or HTTP/SSE
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                      AI CLIENT (Model)                           │
└──────────────────────────────────────────────────────────────────┘
```

> **MCP Server**: A process that exposes tools, resources, and prompts via the MCP protocol. Can be local (subprocess) or remote (HTTP service).

**1. Servers**: Processes that provide capabilities

```typescript
// MCP server definition
const server = {
  name: 'github',
  version: '1.0.0',
  description: 'GitHub repository operations',
  capabilities: {
    tools: true,
    resources: true,
    prompts: true,
  },
};
```

> **MCP Tool**: An action the model can invoke, with a defined input schema. Tools can have side effects (create files, call APIs, modify databases).

**2. Tools**: Actions the model can invoke

```typescript
// Tool definition
const tools = [
  {
    name: 'create_issue',
    description: 'Create a new GitHub issue',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/repo format' },
        title: { type: 'string' },
        body: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
      },
      required: ['repo', 'title'],
    },
  },
  {
    name: 'search_code',
    description: 'Search code in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string' },
        query: { type: 'string' },
      },
      required: ['repo', 'query'],
    },
  },
];
```

> **MCP Resource**: A URI-addressable piece of data (files, API responses, database records). Read-only—resources don't have side effects.

**3. Resources**: Data the model can access

```typescript
// Resource definition
const resources = [
  {
    uri: 'github://repos/{owner}/{repo}/readme',
    name: 'Repository README',
    description: 'The README file for a repository',
    mimeType: 'text/markdown',
  },
  {
    uri: 'github://repos/{owner}/{repo}/issues',
    name: 'Repository Issues',
    description: 'List of open issues',
    mimeType: 'application/json',
  },
];
```

> **MCP Prompt**: A reusable prompt template with arguments. Useful for standardizing complex operations across tools.

**4. Prompts**: Reusable prompt templates

```typescript
// Prompt template
const prompts = [
  {
    name: 'code_review',
    description: 'Review a pull request for issues',
    arguments: [
      { name: 'pr_number', description: 'Pull request number', required: true },
      { name: 'focus', description: 'Review focus area', required: false },
    ],
  },
];
```

### Transport Patterns

MCP supports multiple transport mechanisms:

**Local (stdio)**: Server runs as a subprocess
```typescript
// Client configuration for local server
const localServer = {
  command: 'node',
  args: ['./mcp-servers/github/index.js'],
  env: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  },
};
```

**Remote (HTTP + SSE)**: Server runs as a service
```typescript
// Client configuration for remote server
const remoteServer = {
  url: 'https://mcp.example.com/github',
  headers: {
    Authorization: `Bearer ${token}`,
  },
};
```

**Local servers** are simpler to set up and have fewer security concerns. **Remote servers** enable shared infrastructure and managed services.

### Using MCP in Practice

**For AI-assisted development** (your IDE/CLI tools):

Most AI coding tools now support MCP servers. Configure them to extend capabilities:

```json
// Example: Claude Desktop configuration
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/directory"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "your-token"
      }
    }
  }
}
```

**Common MCP servers for development:**

| Server | Purpose | Source |
|--------|---------|--------|
| filesystem | Read/write local files | [@modelcontextprotocol/server-filesystem](https://github.com/modelcontextprotocol/servers) |
| github | GitHub operations | [@modelcontextprotocol/server-github](https://github.com/modelcontextprotocol/servers) |
| postgres | Database queries | [@modelcontextprotocol/server-postgres](https://github.com/modelcontextprotocol/servers) |
| playwright | Browser automation | Community servers |
| Context7 | Up-to-date library docs | [context7](https://github.com/upstash/context7) |

**For shipping AI features** (production applications):

MCP provides a standard interface for your AI features to interact with your backend:

```typescript
// Define an MCP server for your application
import { Server } from '@modelcontextprotocol/sdk/server';

const server = new Server({
  name: 'my-app',
  version: '1.0.0',
});

// Register tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'get_user_orders',
      description: 'Fetch orders for the current user',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'shipped', 'delivered'] },
          limit: { type: 'number', default: 10 },
        },
      },
    },
  ],
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_user_orders') {
    const orders = await db.orders.findMany({
      where: { userId: currentUser.id, status: args.status },
      take: args.limit,
    });
    return { content: [{ type: 'text', text: JSON.stringify(orders) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});
```

### Security Considerations

**MCP servers are privileged code.** They can:
- Access filesystems
- Make network requests
- Execute commands
- Access databases

**Security principles:**

1. **Least privilege**: Only grant necessary permissions

```typescript
// Bad: Full filesystem access
const server = { command: 'filesystem-server', args: ['/'] };

// Good: Scoped to project directory
const server = { command: 'filesystem-server', args: ['./src'] };
```

2. **Auth on remote servers**: Never expose remote MCP servers without authentication

```typescript
// Remote server with auth
const authenticatedHandler = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!validateToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
```

3. **Audit tool usage**: Log what tools are called and with what arguments

```typescript
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  // Audit log
  await auditLog.write({
    timestamp: new Date(),
    tool: name,
    arguments: args,
    user: currentUser.id,
  });

  // Execute tool...
});
```

4. **Validate inputs**: Don't trust tool arguments

```typescript
// Validate before executing
if (name === 'read_file') {
  const normalizedPath = path.normalize(args.path);

  // Prevent path traversal
  if (!normalizedPath.startsWith(allowedDirectory)) {
    throw new Error('Access denied: path outside allowed directory');
  }

  // Check file size before reading
  const stats = await fs.stat(normalizedPath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }
}
```

### Schema Stability

For production use, treat tool schemas like API contracts:

- **Version your schemas**: Breaking changes should bump versions
- **Document changes**: Maintain a changelog for tool schemas
- **Test compatibility**: Ensure clients handle schema evolution

```typescript
// Versioned tool schema
const tools = [
  {
    name: 'create_order',
    version: '2.0.0',  // Explicit version
    inputSchema: {
      // ... schema
    },
    changelog: [
      '2.0.0: Added required shippingAddress field',
      '1.1.0: Added optional priority field',
      '1.0.0: Initial release',
    ],
  },
];
```

## Known Limitations and Criticisms

While MCP has gained significant adoption, several important limitations and criticisms have emerged in 2025:

### Context Window Bloat

One of the most significant practical issues with MCP is the excessive token consumption from tool definitions.

**The problem**: When you connect an AI agent to multiple MCP servers, every single tool definition loads into the context window upfront. This creates severe scaling limitations:

- The GitHub MCP server alone consumes **55,000 tokens** across its 93 tool definitions
- Developer Scott Spence measured his MCP setup: **66,000 tokens consumed at conversation start** — one third of Claude Sonnet's 200k context window gone before asking a single question
- Anthropic reports seeing setups where tool definitions consumed **134K tokens** — roughly half of Claude's entire context window

**Real-world impact**:
- Cursor enforces a hard limit of 40 tools because more causes problems
- Claude's output quality visibly degrades after 50+ tools
- Token usage drops from 150,000 to 2,000 when using Anthropic's code execution approach

**Emerging solutions** (as of late 2025):
- **Code execution approach**: Anthropic's solution presents MCPs as code APIs that the agent can selectively load
- **Hierarchical routing**: Tools like code-mode, ToolHive, and Lazy Router expose meta-tools instead of hundreds of individual tools (90-98% token reduction)
- **Dynamic discovery**: mcp-cli and similar tools implement on-demand tool loading
- **Official proposals**: SEP-1576 proposes optimizations to reduce schema redundancy

### Security Vulnerabilities

**Tool poisoning** (discovered April 2025 by Invariant Labs):
- Malicious instructions can be embedded in tool descriptions themselves
- These instructions are visible to the LLM but not displayed to users
- MCP tools can mutate their own definitions after installation (you approve a safe-looking tool on Day 1, and by Day 7 it's quietly rerouted your API keys)

**Authentication gaps**:
- MCP's focus on simplicity means authentication was not well-defined initially
- Knostic's July 2025 scan of nearly 2,000 internet-exposed MCP servers found **all verified servers lacking authentication**
- The first MCP authorization spec treats an MCP server as both a resource and an authorization server, creating additional security concerns

**Real incidents**:
- July 2025: Replit's AI agent deleted a production database containing over 1,200 records, despite explicit "code and action freeze" instructions

### Design and Usability Issues

**Not human-friendly**: While the protocol has a very LLM-friendly interface, it's not always human-friendly. Users may not intend a specific action, but the LLM might decide it's appropriate anyway.

**Parameter generation**: Current MCP assumes all tool calling parameters are exposed to the LLM and all their values are generated by the LLM. This limits fine-grained control.

**Identity management ambiguity**: Determining clear identity — whether requests originate from the end user, the AI agent, or a shared system account — remains unclear. This poses risks for auditing, accountability, and access control in enterprise deployments.

### Mitigation Strategies

Despite these issues, MCP remains valuable when used carefully:

**For context bloat**:
- Limit the number of MCP servers connected simultaneously
- Use hierarchical routing or code execution approaches when available
- Monitor context usage and tool counts actively

**For security**:
- Never expose MCP servers without authentication (see [Security Considerations](#security-considerations))
- Audit tool definitions regularly for changes
- Implement comprehensive logging of all tool invocations
- Apply least privilege principles strictly

**For usability**:
- Provide clear feedback to users about what actions are being taken
- Implement confirmation flows for destructive operations
- Maintain detailed audit logs for accountability

## Common Pitfalls

- **Over-privileged servers.** Start with minimal permissions, add as needed.
- **No input validation.** MCP arguments come from model output—validate everything.
- **Exposing remote servers without auth.** Attackers can invoke your tools directly.
- **Ignoring rate limits.** Agentic loops can call tools rapidly—implement throttling.

## Related

- [API Integration Patterns](../04-shipping-ai-features/api-integration.md) — Using MCP in production
- [Security](../04-shipping-ai-features/security.md) — Prompt injection and tool abuse
- [Tooling Ecosystem](../03-ai-assisted-development/tooling-ecosystem.md) — MCP for development
