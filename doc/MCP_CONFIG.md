# MCP Server Configuration

This file explains how to configure Model Context Protocol (MCP) servers to provide tools to the OpenAI Realtime API agent.

## Configuration File

The MCP server configuration is stored in `mcp-config.json` at the root of the project. The format is compatible with Claude Desktop's MCP server configuration.

### Format

```json
{
  "mcpServers": {
    "server-name": {
      "command": "executable",
      "args": ["arg1", "arg2"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

### Fields

- **`mcpServers`**: Object containing all configured MCP servers
  - **Key**: Server name (used for identification)
  - **Value**: Server configuration object
    - **`command`**: The executable to run (e.g., `"node"`, `"python"`, `"npx"`)
    - **`args`**: Array of command-line arguments
    - **`env`** *(optional)*: Object containing environment variables
    - **`timeout`** *(optional)*: Timeout in seconds for tool calls (default: 120)

## Example Configurations

### Node.js MCP Server

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": ["/path/to/mcp-server-filesystem/build/index.js"],
      "env": {
        "ALLOWED_PATHS": "/Users/username/Documents"
      }
    }
  }
}
```

### Python MCP Server

```json
{
  "mcpServers": {
    "weather": {
      "command": "python",
      "args": ["/path/to/weather-mcp-server/main.py"],
      "env": {
        "WEATHER_API_KEY": "your-api-key"
      }
    }
  }
}
```

### NPX Package

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

### Server with Custom Timeout

For servers with slow operations (like screenshots), increase the timeout:

```json
{
  "mcpServers": {
    "screenshot": {
      "command": "C:\\path\\to\\screenshot-server.bat",
      "timeout": 300
    }
  }
}
```

### Multiple Servers

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": ["/path/to/filesystem-server.js"]
    },
    "database": {
      "command": "python",
      "args": ["/path/to/db-server.py"],
      "env": {
        "DB_CONNECTION_STRING": "postgresql://..."
      }
    },
    "web-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key"
      }
    },
    "screenshot": {
      "command": "npx",
      "args": ["-y", "mcp-server-screenshot"],
      "timeout": 180
    }
  }
}
```

## How It Works

1. The backend reads `mcp-config.json` on startup
2. For each configured server, it spawns the process using stdio transport
3. It fetches the list of available tools from each MCP server
4. The frontend requests the combined tool list from the backend
5. Tools are registered with the OpenAI Realtime Agent
6. When the agent calls a tool, the request is routed to the appropriate MCP server

## Tool Execution Flow

```
User speaks → Agent decides to use tool → Frontend receives tool call →
Frontend sends to backend → Backend routes to MCP server →
MCP server executes → Backend returns result → Frontend passes to agent →
Agent speaks response
```

## Finding MCP Servers

You can find MCP servers at:

- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
- [Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers)
- Build your own using the [MCP SDK](https://modelcontextprotocol.io/introduction)

## Troubleshooting

### Server Not Starting

- Check that the `command` executable is in your PATH
- Verify file paths are absolute, not relative
- Check environment variables are set correctly
- Look at backend logs in `logs/backend.log`

### Tools Not Appearing

- Ensure the MCP server implements the `tools/list` capability
- Check backend logs for connection errors
- Verify the server is responding to MCP protocol messages

### Tool Execution Fails

- Check the tool arguments match the schema
- Look for error messages in backend logs
- Verify the MCP server has necessary permissions
- Ensure environment variables (API keys, etc.) are correctly set
