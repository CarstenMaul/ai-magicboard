# Testing Server-Side Controls

## Quick Test Guide

### 1. Install Backend Dependencies (if not already done)
```bash
cd backend
pip install -r requirements.txt
```

### 2. Start the Backend with Debug Logging Enabled
```bash
cd backend

# Windows
set DEBUG_REALTIME_EVENTS=true
python main.py

# Linux/Mac
export DEBUG_REALTIME_EVENTS=true
python main.py
```

### 3. Start the Frontend (in a new terminal)
```bash
cd frontend
npm run dev
```

### 4. Test the Connection
1. Open browser to `http://localhost:5173`
2. Open browser developer console (F12)
3. Click "Connect Agent"
4. Watch the backend terminal for logs

### Expected Backend Console Output

When debug logging is enabled, you should see:

```
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)

# When you click "Connect Agent":
INFO:httpx:HTTP Request: POST https://api.openai.com/v1/realtime/client_secrets "HTTP/1.1 200 OK"
INFO:127.0.0.1:xxxxx - "POST /api/token HTTP/1.1" 200 OK

# Server-side monitoring starts:
INFO:__main__:Started server-side monitoring for call_id: rtc_xxxxxxxxxxxxxxxx
INFO:__main__:Establishing server-side WebSocket connection for call_id: rtc_xxxxxxxxxxxxxxxx
INFO:127.0.0.1:xxxxx - "POST /api/monitor?call_id=rtc_xxxxxxxxxxxxxxxx HTTP/1.1" 200 OK
INFO:__main__:Server-side WebSocket connected for call_id: rtc_xxxxxxxxxxxxxxxx

# Realtime API events start flowing:
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=session.created
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=session.updated
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=conversation.created
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=input_audio_buffer.speech_started
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=input_audio_buffer.speech_stopped
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=input_audio_buffer.committed
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=conversation.item.created
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=response.created
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=response.output_item.added
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=response.content_part.added
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=response.audio_transcript.delta
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=response.audio.delta
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=response.audio_transcript.done
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=response.content_part.done
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=response.output_item.done
INFO:__main__:[REALTIME EVENT] call_id=rtc_xxxxxxxxxxxxxxxx type=response.done
```

### Expected Frontend Console Output

In the browser console, you should see:

```
Call ID extracted: rtc_xxxxxxxxxxxxxxxx
Server-side monitoring started: {status: 'monitoring_started', call_id: 'rtc_xxxxxxxxxxxxxxxx', debug_enabled: true}
Agent connected successfully!
```

## Troubleshooting

### No Call ID Extracted
**Symptom:** Frontend console shows: "Could not extract call_id from transport after retries"

**Solutions:**
1. Check that you're using WebRTC transport (not WebSocket)
2. Verify the session connected successfully
3. Check browser console for connection errors
4. The library might have changed - check the transport object structure in console

### No Backend Logs
**Symptom:** Backend only shows HTTP requests, no Realtime events

**Solutions:**
1. Verify `DEBUG_REALTIME_EVENTS=true` is set
2. Check that `/api/monitor` endpoint was called (check for the POST request in logs)
3. Verify OpenAI API key is valid
4. Check for WebSocket connection errors in backend logs

### WebSocket Connection Fails
**Symptom:** Backend shows: "WebSocket error for call_id rtc_xxxxx"

**Solutions:**
1. Verify OpenAI API key has access to Realtime API
2. Check network connectivity
3. Verify the call_id is valid and the session is still active
4. Check OpenAI API status page

## Disabling Debug Logging

To disable verbose logging in production:

```bash
# Windows
set DEBUG_REALTIME_EVENTS=false

# Linux/Mac
export DEBUG_REALTIME_EVENTS=false

# Or simply unset/remove the environment variable
```

## Next Steps

Once server-side monitoring is working, you can:

1. **Add Tool/Function Handling**: Modify `listen_to_realtime_events()` to respond to function calls
2. **Dynamic Instructions**: Send `session.update` events to change agent behavior mid-conversation
3. **Analytics**: Log events to database for analysis
4. **Custom Business Logic**: Implement server-side logic based on conversation events
