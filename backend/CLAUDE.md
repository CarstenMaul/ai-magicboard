# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a simple web application demonstrating a TypeScript frontend communicating with a FastAPI backend. The project is split into two directories:

- **backend/**: FastAPI application serving REST endpoints
- **frontend/**: TypeScript + Vite single-page application

The root also contains an `@openai/agents-realtime` package dependency, suggesting this may be extended for OpenAI Realtime API integration.

## Architecture

### Backend (FastAPI)
- Main application in `main.py`
- MCP server manager in `mcp_manager.py`
- Uses FastAPI with CORS middleware configured for development
- Runs on port 8000 by default
- CORS allows origins: `http://localhost:3000` and `http://localhost:5173`
- Current endpoints:
  - `POST /api/token` - Generates ephemeral client token for OpenAI Realtime API
  - `POST /api/monitor` - Start server-side monitoring of Realtime API session
  - `POST /api/web-search` - OpenAI web search with citations
  - `POST /api/google-search` - Google web search
  - `POST /api/google-image-search` - Google image search
  - `GET /api/mcp-tools` - Get all available tools from configured MCP servers
  - `POST /api/mcp-call` - Execute a tool call on an MCP server

### Frontend (TypeScript + Vite)
- Entry point: `index.html` with inline styles
- TypeScript application logic in `src/main.ts`
- Runs on port 5173 via Vite dev server
- Uses strict TypeScript compilation settings
- Integrates `@openai/agents-realtime` package for voice agent functionality
- UI provides buttons to connect/disconnect the agent
- Fetches ephemeral tokens from backend `/api/token` endpoint
- Creates a `RealtimeAgent` and `RealtimeSession` to connect to OpenAI's Realtime API

## OpenAI API Key Configuration

The backend requires an OpenAI API key to generate ephemeral tokens. Configure it using one of these methods:

1. Create `oai-api-key.txt` in the root directory (already configured in this repo)
2. Set the `OPENAI_API_KEY` environment variable

The `/api/token` endpoint calls OpenAI's `/v1/realtime/client_secrets` API to generate short-lived tokens that the frontend can use to connect to the Realtime API securely without exposing the API key.

## Common Commands

### Backend Development

From the `backend/` directory:

```bash
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
python main.py

# The backend will be available at http://localhost:8000
```

### Frontend Development

From the `frontend/` directory:

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Type Checking

The frontend uses TypeScript with strict mode enabled. To check types:

```bash
cd frontend
npx tsc --noEmit
```

## Development Workflow

1. Start the backend server first (from `backend/` directory): `python main.py`
2. In a separate terminal, start the frontend dev server (from `frontend/` directory): `npm run dev`
3. Access the application at `http://localhost:5173`

## Agent Implementation

The frontend implements an OpenAI Realtime voice agent optimized for minimal latency:

- **Agent Configuration** (frontend/src/main.ts:48-51): Creates a `RealtimeAgent` with name and instructions
- **Session Management** (frontend/src/main.ts:54-72): Establishes a `RealtimeSession` with low-latency optimizations:
  - **Transport**: WebRTC (explicitly configured for lowest latency in browsers)
  - **Audio Format**: PCM 24kHz (minimal processing overhead)
  - **Turn Detection**: Semantic VAD with `high` eagerness for faster response times
  - **Interrupt Response**: Enabled for natural, low-latency conversation flow
- **Token Flow**: Frontend calls backend `/api/token` → Backend calls OpenAI → Returns ephemeral token → Frontend uses token to connect
- **Session Lifecycle**:
  - Connect: Fetches token, creates agent/session, connects to OpenAI (background turns green)
  - Disconnect: Calls `session.close()` to cleanup the connection (background resets to default gradient)
  - Mute/Unmute: Uses `session.mute()` to control microphone without closing the session
    - Can be toggled via button click or keyboard shortcut
    - Keyboard shortcut is configurable via `MUTE_TOGGLE_KEY` variable (default: Volume Up key)
    - Background color changes: Red when muted, Green when unmuted (configurable)
    - Colors configurable via `MUTED_BACKGROUND_COLOR` and `UNMUTED_BACKGROUND_COLOR` variables
    - UI automatically updates to reflect mute state
  - Note: Session handling for audio/events is not yet implemented

## MCP Server Integration

This application supports **Model Context Protocol (MCP)** servers, allowing dynamic tool registration for the voice agent.

### Configuration
- MCP servers are configured in `mcp-config.json` at the project root
- Format compatible with Claude Desktop MCP configuration
- Example:
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

### Architecture
- **Backend** (`mcp_manager.py`):
  - `MCPServer` class: Manages individual MCP server process via stdio transport
  - `MCPManager` class: Coordinates multiple MCP servers
  - Spawns MCP server processes on startup
  - Communicates via JSON-RPC over stdio
  - Implements MCP protocol: `initialize`, `tools/list`, `tools/call`
  - Tools are prefixed with server name: `servername__toolname`

- **Frontend** (`main.ts`):
  - Fetches MCP tools from backend on agent connection
  - Converts MCP tool schemas to OpenAI Realtime format
  - Registers tools with `RealtimeAgent`
  - Routes tool calls to backend `/api/mcp-call` endpoint

### Tool Flow
1. Backend starts → Reads `mcp-config.json` → Spawns MCP servers → Fetches tools
2. Frontend connects → Fetches tools from `/api/mcp-tools`
3. Frontend registers tools with agent
4. Agent calls tool → Frontend sends to `/api/mcp-call` → Backend routes to MCP server
5. MCP server executes → Returns result → Agent speaks response

### Files
- `mcp-config.json` - MCP server configuration
- `backend/mcp_manager.py` - MCP server manager implementation
- `MCP_CONFIG.md` - Configuration documentation
- `MCP_TESTING.md` - Testing guide with examples

## Key Files

- `backend/main.py` - FastAPI application entry point and all endpoints
- `backend/mcp_manager.py` - MCP server manager for stdio-based tool servers
- `backend/requirements.txt` - Python dependencies
- `frontend/src/main.ts` - Frontend application logic, agent setup, and API integration
- `frontend/index.html` - HTML entry point with embedded styles
- `frontend/tsconfig.json` - TypeScript compiler configuration (strict mode enabled)
- `frontend/vite.config.ts` - Vite bundler configuration
- `frontend/package.json` - Node dependencies including `@openai/agents-realtime`
- `mcp-config.json` - MCP server configuration (Claude Desktop compatible format)
