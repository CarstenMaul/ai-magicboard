# Server-Side Controls Implementation

This document describes the server-side control implementation for the OpenAI Realtime API using WebSocket "sideband" connections.

## Overview

The implementation follows OpenAI's "Webhooks and server-side controls" pattern, where:
1. The client establishes a WebRTC connection to the Realtime API
2. The backend establishes a parallel WebSocket "sideband" connection to the same session
3. The backend can monitor events, update instructions, and handle tool calls server-side

## Architecture

```
┌─────────┐                    ┌──────────────┐
│ Client  │──── WebRTC ───────→│   OpenAI     │
│(Browser)│                     │  Realtime    │
└─────────┘                     │     API      │
     │                          └──────────────┘
     │ call_id                         ↑
     ↓                                 │
┌─────────┐                            │
│ Backend │──── WebSocket ─────────────┘
│ Server  │    (sideband control)
└─────────┘
```

## Implementation Details

### Backend (main.py)

#### 1. Debug Configuration
- **Environment Variable**: `DEBUG_REALTIME_EVENTS` (default: `true`)
- Controls whether Realtime API events are logged to console
- Set to `false` in production to reduce log verbosity

#### 2. Server-Side WebSocket Connection
The `listen_to_realtime_events()` function:
- Establishes WebSocket connection using: `wss://api.openai.com/v1/realtime?call_id={call_id}`
- Authenticates with the **ephemeral key** (same one used by the client)
- Listens for all Realtime API events
- Logs events when `DEBUG_REALTIME_EVENTS=true`
- Handles errors and connection lifecycle

#### 3. API Endpoint
**POST /api/monitor**
- Parameters:
  - `call_id` (query parameter) - The call ID from the WebRTC connection
  - `ephemeral_key` (query parameter) - The ephemeral token used by the client
- Starts background monitoring task for the specified call
- Returns: `{"status": "monitoring_started", "call_id": "...", "debug_enabled": true/false}`

### Frontend (main.ts)

#### 1. Call ID Extraction
After establishing WebRTC connection, the frontend attempts to extract the `call_id` from the session object:
```typescript
const callId = (session as any).callId || (session as any)._callId;
```

#### 2. Server-Side Monitoring Trigger
The `startServerSideMonitoring()` function:
- Called after successful WebRTC connection
- Sends both `call_id` and `ephemeral_key` to backend `/api/monitor` endpoint
- Backend starts listening for events in background using the same credentials

## Event Logging

When `DEBUG_REALTIME_EVENTS=true`, the following events are logged:

### Basic Event Log
```
[REALTIME EVENT] call_id=rtc_xxxxx type=session.created
[REALTIME EVENT] call_id=rtc_xxxxx type=conversation.item.created
[REALTIME EVENT] call_id=rtc_xxxxx type=response.function_call.arguments.done
```

### Detailed Event Log (DEBUG level)
Full JSON event details are logged at DEBUG level:
```
[REALTIME EVENT DETAILS] {
  "type": "conversation.item.created",
  "item": {
    "id": "item_123",
    ...
  }
}
```

## Use Cases

### 1. Event Monitoring
Monitor all events in the Realtime session for debugging, analytics, or auditing.

### 2. Dynamic Instruction Updates
Update agent instructions mid-conversation based on business logic:
```python
await websocket.send(json.dumps({
    "type": "session.update",
    "session": {
        "type": "realtime",
        "instructions": "User is a VIP customer. Be extra helpful!"
    }
}))
```

### 3. Server-Side Tool/Function Handling
Handle function calls on the server to keep business logic private:
```python
if event_type == "response.function_call.arguments.done":
    function_name = event.get("name")
    # Execute function server-side
    # Send response back to session
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG_REALTIME_EVENTS` | `true` | Enable detailed event logging |
| `OPENAI_API_KEY` | - | OpenAI API key (required) |

### Files Modified

1. **backend/main.py**
   - Added imports: `websockets`, `asyncio`, `json`, `logging`
   - Added `DEBUG_REALTIME_EVENTS` configuration
   - Added `listen_to_realtime_events()` function
   - Added `/api/monitor` endpoint
   - Added `active_connections` tracking

2. **backend/requirements.txt**
   - Added: `websockets==13.1`

3. **frontend/src/main.ts**
   - Added `startServerSideMonitoring()` function
   - Modified `connectAgent()` to extract call_id and trigger monitoring

## Testing

### Prerequisites
1. Install backend dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. Set environment variable (optional):
   ```bash
   # Windows
   set DEBUG_REALTIME_EVENTS=true

   # Linux/Mac
   export DEBUG_REALTIME_EVENTS=true
   ```

### Running
1. Start backend:
   ```bash
   cd backend
   python main.py
   ```

2. Start frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open browser to `http://localhost:5173`
4. Click "Connect Agent"
5. Check backend console for event logs

### Expected Console Output
```
INFO:__main__:Started server-side monitoring for call_id: rtc_xxxxx
INFO:__main__:Establishing server-side WebSocket connection for call_id: rtc_xxxxx
INFO:__main__:Server-side WebSocket connected for call_id: rtc_xxxxx
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxx type=session.created
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxx type=session.updated
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxx type=conversation.item.created
...
```

## Future Enhancements

1. **Tool/Function Call Handling**: Implement server-side function execution
2. **Session Analytics**: Store events in database for analysis
3. **Dynamic Context**: Update instructions based on user profile or conversation context
4. **Rate Limiting**: Implement per-user rate limits
5. **Security**: Add authentication for /api/monitor endpoint
6. **WebSocket Health Checks**: Implement reconnection logic for dropped connections

## References

- [OpenAI Realtime API - Webhooks and Server-Side Controls](https://platform.openai.com/docs/guides/realtime-server-controls)
- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455)
