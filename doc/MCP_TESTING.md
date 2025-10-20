# MCP Integration Testing Guide

This guide will help you test the MCP server integration with a simple example.

## Quick Test with Memory Server

The easiest way to test MCP integration is with the official Memory server from ModelContextProtocol.

### Step 1: Configure the Memory Server

Update `mcp-config.json`:

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

### Step 2: Start the Backend

```bash
cd backend
python main.py
```

You should see:
```
Started 1 MCP servers
Fetched X tools from MCP server 'memory'
```

### Step 3: Start the Frontend

In a new terminal:

```bash
cd frontend
npm run dev
```

### Step 4: Test the Integration

1. Open http://localhost:5173 in your browser
2. Open browser console (F12)
3. Click "Connect Agent"
4. You should see:
   ```
   Fetched X MCP tools
   Registering MCP tool: memory__create_entities from server: memory
   Registering MCP tool: memory__read_graph from server: memory
   ...
   ```

5. Talk to the agent and ask it to remember something:
   - "Please remember that my favorite color is blue"
   - The agent should use the `memory__create_entities` tool

6. Ask it to recall:
   - "What's my favorite color?"
   - The agent should use the `memory__read_graph` tool

### Step 5: Verify in Backend Logs

Check `logs/backend.log` for MCP activity:
```
INFO - MCP server 'memory' started successfully
INFO - Fetched 3 tools from MCP server 'memory'
```

## Testing with Custom MCP Servers

### Example: Filesystem Server

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/directory"]
    }
  }
}
```

Then ask the agent:
- "List the files in the directory"
- "Read the contents of README.md"

### Example: Multiple Servers

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "time": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-time"]
    }
  }
}
```

Now the agent has access to both memory AND time tools!

## Debugging

### Backend Not Starting MCP Servers

Check:
1. Is `mcp-config.json` in the root directory?
2. Is the JSON format valid?
3. Are the commands available in PATH?
4. Check `logs/backend.log` for errors

### Tools Not Appearing

1. Check browser console for fetch errors
2. Verify backend endpoint: http://localhost:8000/api/mcp-tools
3. Should return: `{"tools": [...]}`

### Tool Execution Fails

1. Check browser console for the tool name and arguments
2. Check backend logs for MCP communication errors
3. Verify the MCP server supports the tool schema

### Common Issues

**Issue**: `npx` command not found or "[WinError 2] The system cannot find the file specified" (Windows)
- **Solution**: Install Node.js and ensure `npx` is in PATH
- **Windows Note**: The backend now automatically handles `.cmd` files through `cmd /c`
- **Verify**: Run `npx --version` in your terminal to confirm it's installed

**Issue**: Permission denied
- **Solution**: Ensure the command has execute permissions

**Issue**: Server starts but no tools
- **Solution**: The MCP server might need time to initialize, or it doesn't implement `tools/list`

**Issue**: TLS warnings in logs
- **Note**: Some MCP servers may output warnings to stderr (e.g., NODE_TLS_REJECT_UNAUTHORIZED)
- **Solution**: These are informational warnings logged by the backend and won't affect functionality

## Available MCP Servers to Try

From [@modelcontextprotocol](https://github.com/modelcontextprotocol/servers):

1. **@modelcontextprotocol/server-memory** - Knowledge graph memory
2. **@modelcontextprotocol/server-filesystem** - File operations
3. **@modelcontextprotocol/server-time** - Time queries
4. **@modelcontextprotocol/server-brave-search** - Web search (needs API key)
5. **@modelcontextprotocol/server-postgres** - Database access
6. **@modelcontextprotocol/server-github** - GitHub operations

## Creating Your Own MCP Server

See the [MCP SDK Documentation](https://modelcontextprotocol.io/) to build custom servers.

Example server structure:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'my-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'my_tool',
    description: 'Does something',
    inputSchema: {
      type: 'object',
      properties: {
        param: { type: 'string' }
      }
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => ({
  content: [{ type: 'text', text: 'Result' }]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

Then configure it:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/my-server.js"]
    }
  }
}
```
