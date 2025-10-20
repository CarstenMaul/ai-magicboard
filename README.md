# AI Magicboard

A real-time voice-enabled AI agent platform with dynamic tool integration via Model Context Protocol (MCP).

## Project Structure

```
ai-magicboard/
├── backend/                    # FastAPI Python backend
│   ├── main.py                 # Main FastAPI application and endpoints
│   ├── mcp_manager.py          # Model Context Protocol (MCP) server management
│   ├── requirements.txt        # Python dependencies
│   ├── CLAUDE.md               # Development guidance
│   └── SERVER_SIDE_CONTROLS.md # Server-side monitoring documentation
├── frontend/                   # TypeScript/Vite frontend
│   ├── src/
│   │   └── main.ts            # Main TypeScript application
│   ├── index.html             # HTML entry point with embedded styles
│   ├── package.json           # Node.js dependencies
│   ├── tsconfig.json          # TypeScript configuration
│   └── vite.config.ts         # Vite bundler configuration
├── doc/                        # Documentation
│   ├── MCP_CONFIG.md          # MCP server configuration guide
│   ├── MCP_TESTING.md         # MCP testing guide
│   └── TEST_SERVER_SIDE_CONTROLS.md
├── mcp-config.json            # MCP servers configuration
├── oai-api-key.txt            # OpenAI API key (not tracked in git)
├── google-api-key.txt         # Google API key (not tracked in git)
└── README.md                  # This file
```

## Features

- **Real-Time Voice Conversations**: WebRTC-based voice interaction with OpenAI's Realtime API
- **Scratchpad System**: Live markdown and Mermaid diagram rendering with image support
- **Search Integration**: Web search via OpenAI and Google Custom Search APIs
- **MCP Tool System**: Extensible tool integration (memory, screenshots, OPC UA, custom tools)
- **Server-Side Monitoring**: WebSocket event logging and session control
- **Secure Token Management**: Ephemeral token generation for secure frontend access

## Prerequisites

- Python 3.8 or higher
- Node.js 18 or higher
- npm or yarn
- OpenAI API key (for Realtime API access)
- Google API key (optional, for Google Custom Search)

## Setup and Run

### API Keys

1. Create `oai-api-key.txt` in the project root and add your OpenAI API key:
   ```
   sk-proj-your-openai-api-key-here
   ```

2. (Optional) Create `google-api-key.txt` for Google Custom Search:
   ```
   your-google-api-key-here
   ```

   Alternatively, set environment variables:
   ```bash
   export OPENAI_API_KEY="sk-proj-your-key"
   export GOOGLE_API_KEY="your-google-key"
   export GOOGLE_CX="your-custom-search-engine-id"
   ```

### Backend (FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the FastAPI server:
   ```bash
   python main.py
   ```

   The backend will be available at `http://localhost:8000`

   Options:
   - `--debug`: Enable debug logging (default)
   - `--no-debug`: Disable debug logging

### Frontend (TypeScript + Vite)

1. Navigate to the frontend directory (in a new terminal):
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173`

## Usage

1. Ensure both backend and frontend servers are running
2. Open your browser to `http://localhost:5173`
3. Click the **"Connect"** button to start a voice session with the AI agent
4. Speak naturally - the agent will respond with voice and update the scratchpad
5. Use the **"Mute/Unmute"** button or keyboard shortcut (§ key) to control your microphone
6. Click **"Disconnect"** to end the session
7. Download conversation notes using the **"Download Scratchpad"** button

### Available Voice Commands

Try asking the agent to:
- "Add this to the scratchpad: [your notes]"
- "Clear the scratchpad"
- "Search the web for [topic]"
- "Show me images of [subject]"
- "Remember that [information]" (if Memory MCP server is configured)
- "What do you remember about me?"

## API Endpoints

- `POST /api/token` - Generate ephemeral client token for OpenAI Realtime API
- `POST /api/monitor` - Start server-side monitoring of Realtime API session
- `POST /api/web-search` - OpenAI web search with citations
- `POST /api/google-search` - Google Custom Search
- `POST /api/google-image-search` - Google Image Search
- `GET /api/mcp-tools` - List all available MCP tools
- `POST /api/mcp-call` - Execute MCP tool calls

## MCP Server Integration

This application supports **Model Context Protocol (MCP)** servers, allowing you to add custom tools to the voice agent.

### Configuration

1. Edit `mcp-config.json` in the root directory:
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

2. Restart the backend to load MCP servers

3. MCP tools will automatically be available to the agent

### Quick Test

Try the official Memory server:
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

Then ask the agent:
- "Remember that my favorite color is blue"
- "What's my favorite color?"

See **[MCP_CONFIG.md](MCP_CONFIG.md)** for configuration details and **[MCP_TESTING.md](MCP_TESTING.md)** for testing guide.

## Technologies Used

### Frontend Stack
- **TypeScript** - Strict mode for type safety
- **Vite** - Modern module bundler and dev server
- **OpenAI Agents Realtime SDK** (`@openai/agents-realtime`) - Voice/real-time capabilities
- **Marked** - Markdown parsing and rendering
- **Mermaid** - Diagram and visualization rendering

### Backend Stack
- **Python 3.8+**
- **FastAPI** - Modern async web framework
- **Uvicorn** - ASGI server
- **httpx** - Async HTTP client
- **WebSockets** - Real-time communication
- **Model Context Protocol (MCP)** - Extensible tool integration

### External Services
- **OpenAI Realtime API** - Voice agent with gpt-realtime model
- **Google Custom Search API** - Web and image search

## Architecture

The application follows a client-server architecture with real-time communication:

```
Frontend (Browser)
    ↓ (ephemeral token request)
Backend (FastAPI:8000)
    ↓ (token generation)
OpenAI Realtime API
    ↑ (WebRTC voice session)
Frontend (Browser)
```

**Key Design Patterns:**
- **Ephemeral Token Security**: API key never exposed to frontend
- **Async/Await Throughout**: Both backend (FastAPI) and frontend (Promise-based)
- **MCP Stdio Transport**: Managed subprocess communication with JSON-RPC
- **Tool Abstraction**: Frontend tools converted to OpenAI Realtime format
- **Real-Time Rendering**: Markdown and mermaid rendered as agent writes

## Logs

Backend logs are stored in `logs/backend.log` for debugging and monitoring purposes.

## Documentation

- **[doc/MCP_CONFIG.md](doc/MCP_CONFIG.md)** - MCP server configuration guide
- **[doc/MCP_TESTING.md](doc/MCP_TESTING.md)** - MCP testing guide with examples
- **[doc/TEST_SERVER_SIDE_CONTROLS.md](doc/TEST_SERVER_SIDE_CONTROLS.md)** - Server-side monitoring guide
- **[backend/CLAUDE.md](backend/CLAUDE.md)** - Development guidance for AI assistants
- **[backend/SERVER_SIDE_CONTROLS.md](backend/SERVER_SIDE_CONTROLS.md)** - Server-side controls documentation

## Contributing

When working with this codebase, please refer to `backend/CLAUDE.md` for development guidelines and architecture details.

## License

This project is for demonstration and educational purposes.
