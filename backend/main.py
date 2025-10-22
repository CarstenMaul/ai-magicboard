from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import httpx
import os
from pathlib import Path
import asyncio
import websockets
import json
from typing import Optional, Dict, Any
import logging
import argparse
import ssl
from mcp_manager import MCPManager

# Parse command line arguments
parser = argparse.ArgumentParser(description='OpenAI Realtime API Backend')
parser.add_argument('--debug', action='store_true', help='Enable debug logging')
parser.add_argument('--no-debug', action='store_false', dest='debug', help='Disable debug logging')
parser.set_defaults(debug=True)  # Default to debug enabled
args, unknown = parser.parse_known_args()

# Configuration: Master debug flag
DEBUG = args.debug

# Configure logging based on DEBUG flag
log_level = logging.DEBUG if DEBUG else logging.WARNING
log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

# Create logs directory if it doesn't exist
logs_dir = Path(__file__).parent.parent / "logs"
logs_dir.mkdir(exist_ok=True)

# Configure logging to both console and file
logging.basicConfig(
    level=log_level,
    format=log_format,
    handlers=[
        logging.StreamHandler(),  # Console output
        logging.FileHandler(
            logs_dir / "backend.log",
            mode='a',
            encoding='utf-8'
        )
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configuration: Enable debug logging for Realtime API events (uses DEBUG flag if not explicitly set)
DEBUG_REALTIME_EVENTS = os.getenv("DEBUG_REALTIME_EVENTS", str(DEBUG).lower()).lower() == "true"

# Load OpenAI API key
API_KEY_FILE = Path(__file__).parent.parent / "oai-api-key.txt"
OPENAI_API_KEY = None

if API_KEY_FILE.exists():
    OPENAI_API_KEY = API_KEY_FILE.read_text().strip()
else:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Load Google API key
GOOGLE_API_KEY_FILE = Path(__file__).parent.parent / "google-api-key.txt"
GOOGLE_API_KEY = None

if GOOGLE_API_KEY_FILE.exists():
    GOOGLE_API_KEY = GOOGLE_API_KEY_FILE.read_text().strip()
else:
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Google Custom Search Engine ID (CX)
# You can get this from https://programmablesearchengine.google.com/
GOOGLE_CX = os.getenv("GOOGLE_CX", "e2196f596bd834e0e")

# SSL context for bypassing certificate verification (for SSL inspection proxies)
ssl_context = ssl.SSLContext()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# Store active WebSocket connections for cleanup
active_connections: dict[str, asyncio.Task] = {}

# MCP Manager configuration
MCP_CONFIG_FILE = Path(__file__).parent.parent / "mcp-config.json"
mcp_manager: Optional[MCPManager] = None

# Configure CORS to allow frontend to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175"
    ],  # Common dev server ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize MCP servers on startup."""
    global mcp_manager
    mcp_manager = MCPManager(MCP_CONFIG_FILE)
    await mcp_manager.start_all()


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup MCP servers on shutdown."""
    global mcp_manager
    if mcp_manager:
        await mcp_manager.stop_all()

async def listen_to_realtime_events(call_id: str, ephemeral_key: str):
    """
    Establish a server-side WebSocket connection to monitor and control a Realtime API session.
    This is the "sideband" connection that allows server-side control while the client maintains
    its own WebRTC connection.

    Note: We use the same ephemeral key that the client used to establish the WebRTC connection.
    """
    if not ephemeral_key:
        logger.error("Cannot establish server-side connection: Ephemeral key not provided")
        return

    ws_url = f"wss://api.openai.com/v1/realtime?call_id={call_id}"

    try:
        logger.info(f"Establishing server-side WebSocket connection for call_id: {call_id}")

        async with websockets.connect(
            ws_url,
            extra_headers={
                "Authorization": f"Bearer {ephemeral_key}",
            },
            ssl=ssl_context
        ) as websocket:
            logger.info(f"Server-side WebSocket connected for call_id: {call_id}")

            # Optionally send a session.update to configure the session from server-side
            # Example: Update instructions dynamically
            # await websocket.send(json.dumps({
            #     "type": "session.update",
            #     "session": {
            #         "type": "realtime",
            #         "instructions": "Be extra helpful today!"
            #     }
            # }))

            # Listen for events from the Realtime API
            async for message in websocket:
                try:
                    event = json.loads(message)
                    event_type = event.get("type", "unknown")

                    if DEBUG_REALTIME_EVENTS:
                        # Log all events when debug is enabled
                        logger.info(f"[REALTIME EVENT] call_id={call_id} type={event_type}")
                        logger.debug(f"[REALTIME EVENT DETAILS] {json.dumps(event, indent=2)}")

                    # Handle specific event types here
                    # Example: Respond to function calls, update session config, etc.
                    if event_type == "conversation.item.created":
                        if DEBUG_REALTIME_EVENTS:
                            logger.info(f"Conversation item created: {event.get('item', {}).get('id')}")

                    elif event_type == "response.function_call.arguments.done":
                        if DEBUG_REALTIME_EVENTS:
                            logger.info(f"Function call received: {event.get('name')}")
                        # Here you would handle tool/function calls

                    elif event_type == "error":
                        logger.error(f"Realtime API error: {event.get('error')}")

                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse event: {e}")
                except Exception as e:
                    logger.error(f"Error processing event: {e}")

    except websockets.exceptions.WebSocketException as e:
        logger.error(f"WebSocket error for call_id {call_id}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in server-side connection for call_id {call_id}: {e}")
    finally:
        logger.info(f"Server-side WebSocket connection closed for call_id: {call_id}")
        # Clean up the task reference
        if call_id in active_connections:
            del active_connections[call_id]


@app.post("/api/monitor")
async def start_monitoring(
    call_id: str,
    ephemeral_key: str,
    background_tasks: BackgroundTasks
):
    """
    Start server-side monitoring of a Realtime API session.
    The client should call this endpoint with:
    - call_id: extracted from the Location header after establishing the WebRTC connection
    - ephemeral_key: the same ephemeral token used to establish the client connection
    """
    if not ephemeral_key:
        raise HTTPException(
            status_code=400,
            detail="Ephemeral key is required"
        )

    if call_id in active_connections:
        logger.warning(f"Monitoring already active for call_id: {call_id}")
        return {"status": "already_monitoring", "call_id": call_id}

    # Start the monitoring task in the background
    task = asyncio.create_task(listen_to_realtime_events(call_id, ephemeral_key))
    active_connections[call_id] = task

    logger.info(f"Started server-side monitoring for call_id: {call_id}")

    return {
        "status": "monitoring_started",
        "call_id": call_id,
        "debug_enabled": DEBUG_REALTIME_EVENTS
    }


@app.post("/api/web-search")
async def web_search(query: str):
    """
    Perform a web search using OpenAI's Responses API with web_search tool.
    This endpoint is called by the Realtime agent's web_search function tool.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="OpenAI API key not configured"
        )

    try:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o",
                    "tools": [
                        {"type": "web_search"}
                    ],
                    "input": query
                },
                timeout=30.0
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"OpenAI API error: {response.text}"
                )

            data = response.json()

            # Extract the text response and citations
            output_text = ""
            citations = []

            for item in data.get("output", []):
                if item.get("type") == "message":
                    content = item.get("content", [])
                    for content_item in content:
                        if content_item.get("type") == "output_text":
                            output_text = content_item.get("text", "")
                            annotations = content_item.get("annotations", [])
                            for annotation in annotations:
                                if annotation.get("type") == "url_citation":
                                    citations.append({
                                        "url": annotation.get("url"),
                                        "title": annotation.get("title"),
                                        "snippet": output_text[annotation.get("start_index", 0):annotation.get("end_index", 0)]
                                    })

            return {
                "result": output_text,
                "citations": citations
            }

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to OpenAI API: {str(e)}"
        )


@app.post("/api/google-search")
async def google_search(query: str, num_results: int = 5):
    """
    Perform a Google search using Google Custom Search API.
    Returns search results with titles, snippets, and links.
    """
    if DEBUG:
        logger.debug(f"[GOOGLE SEARCH] Received request - query: '{query}', num_results: {num_results}")

    if not GOOGLE_API_KEY:
        logger.error("[GOOGLE SEARCH] Google API key not configured")
        raise HTTPException(
            status_code=500,
            detail="Google API key not configured"
        )

    try:
        params = {
            "key": GOOGLE_API_KEY,
            "cx": GOOGLE_CX,
            "q": query,
            "num": min(num_results, 10)
        }

        if DEBUG:
            # Log params without exposing the full API key
            safe_params = params.copy()
            safe_params["key"] = f"{GOOGLE_API_KEY[:10]}..." if GOOGLE_API_KEY else "None"
            logger.debug(f"[GOOGLE SEARCH] Request params: {safe_params}")

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                "https://www.googleapis.com/customsearch/v1",
                params=params,
                timeout=10.0
            )

            if DEBUG:
                logger.debug(f"[GOOGLE SEARCH] Response status: {response.status_code}")

            if response.status_code != 200:
                logger.error(f"[GOOGLE SEARCH] API error: {response.status_code} - {response.text[:200]}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Google API error: {response.text}"
                )

            data = response.json()

            # Extract search results
            results = []
            for item in data.get("items", []):
                results.append({
                    "title": item.get("title"),
                    "link": item.get("link"),
                    "snippet": item.get("snippet"),
                    "display_link": item.get("displayLink")
                })

            total_results = data.get("searchInformation", {}).get("totalResults", "0")

            if DEBUG:
                logger.debug(f"[GOOGLE SEARCH] Found {len(results)} results (total available: {total_results})")
                for idx, result in enumerate(results[:3], 1):  # Log first 3 results
                    logger.debug(f"[GOOGLE SEARCH]   {idx}. {result['title'][:50]}... - {result['link']}")

            return {
                "query": query,
                "total_results": total_results,
                "results": results
            }

    except httpx.RequestError as e:
        logger.error(f"[GOOGLE SEARCH] Connection error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to Google API: {str(e)}"
        )


@app.post("/api/google-image-search")
async def google_image_search(query: str, num_results: int = 5):
    """
    Perform a Google image search using Google Custom Search API.
    Returns image URLs with thumbnails and context.
    """
    if DEBUG:
        logger.debug(f"[GOOGLE IMAGE SEARCH] Received request - query: '{query}', num_results: {num_results}")

    if not GOOGLE_API_KEY:
        logger.error("[GOOGLE IMAGE SEARCH] Google API key not configured")
        raise HTTPException(
            status_code=500,
            detail="Google API key not configured"
        )

    try:
        params = {
            "key": GOOGLE_API_KEY,
            "cx": GOOGLE_CX,
            "q": query,
            "searchType": "image",
            "num": min(num_results, 10)
        }

        if DEBUG:
            # Log params without exposing the full API key
            safe_params = params.copy()
            safe_params["key"] = f"{GOOGLE_API_KEY[:10]}..." if GOOGLE_API_KEY else "None"
            logger.debug(f"[GOOGLE IMAGE SEARCH] Request params: {safe_params}")

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                "https://www.googleapis.com/customsearch/v1",
                params=params,
                timeout=10.0
            )

            if DEBUG:
                logger.debug(f"[GOOGLE IMAGE SEARCH] Response status: {response.status_code}")

            if response.status_code != 200:
                logger.error(f"[GOOGLE IMAGE SEARCH] API error: {response.status_code} - {response.text[:200]}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Google API error: {response.text}"
                )

            data = response.json()

            # Extract image results
            results = []
            for item in data.get("items", []):
                image_info = item.get("image", {})
                results.append({
                    "title": item.get("title"),
                    "link": item.get("link"),  # Full size image URL
                    "thumbnail": image_info.get("thumbnailLink"),
                    "context_link": image_info.get("contextLink"),  # Page where image was found
                    "width": image_info.get("width"),
                    "height": image_info.get("height")
                })

            total_results = data.get("searchInformation", {}).get("totalResults", "0")

            if DEBUG:
                logger.debug(f"[GOOGLE IMAGE SEARCH] Found {len(results)} images (total available: {total_results})")
                for idx, result in enumerate(results[:3], 1):  # Log first 3 results
                    logger.debug(f"[GOOGLE IMAGE SEARCH]   {idx}. {result['title'][:50]}... ({result['width']}x{result['height']}) - {result['link'][:80]}...")

            return {
                "query": query,
                "total_results": total_results,
                "results": results
            }

    except httpx.RequestError as e:
        logger.error(f"[GOOGLE IMAGE SEARCH] Connection error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to Google API: {str(e)}"
        )


@app.post("/api/token")
async def get_ephemeral_token():
    """
    Generate an ephemeral client token for OpenAI Realtime API.
    This token allows the frontend to securely connect to OpenAI's Realtime API
    without exposing the API key.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="OpenAI API key not configured. Please set OPENAI_API_KEY environment variable or create oai-api-key.txt"
        )

    try:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                "https://api.openai.com/v1/realtime/client_secrets",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "session": {
                        "type": "realtime",
                        "model": "gpt-realtime"
                    }
                },
                timeout=10.0
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"OpenAI API error: {response.text}"
                )

            data = response.json()
            return {"token": data.get("value"), "expires_at": data.get("expires_at")}

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to OpenAI API: {str(e)}"
        )


@app.get("/api/mcp-tools")
async def get_mcp_tools():
    """
    Get all available tools from configured MCP servers.
    Returns a list of tools with their schemas for the frontend to register.
    """
    if not mcp_manager:
        return {"tools": []}

    try:
        tools = mcp_manager.get_all_tools()
        return {"tools": tools}
    except Exception as e:
        logger.error(f"Failed to get MCP tools: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get MCP tools: {str(e)}"
        )


class MCPToolCallRequest(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]


class SaveImageRequest(BaseModel):
    image_data: str  # Base64 encoded image data
    directory: str   # Directory path to save the image
    filename: Optional[str] = None  # Optional filename, auto-generated if not provided


@app.post("/api/mcp-call")
async def call_mcp_tool(request: MCPToolCallRequest):
    """
    Execute a tool call on the appropriate MCP server.
    The tool_name should be in the format: servername__toolname
    """
    if not mcp_manager:
        raise HTTPException(
            status_code=500,
            detail="MCP manager not initialized"
        )

    try:
        logger.debug(f"MCP tool call: {request.tool_name} with args: {request.arguments}")
        result = await mcp_manager.call_tool(request.tool_name, request.arguments)
        logger.debug(f"MCP tool result: {result}")
        return result
    except Exception as e:
        logger.error(f"Failed to call MCP tool '{request.tool_name}': {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to call MCP tool: {str(e)}"
        )


@app.post("/api/save-image")
async def save_image(request: SaveImageRequest):
    """
    Save a base64-encoded image as a JPEG file to the specified directory.
    """
    import base64
    from datetime import datetime
    from PIL import Image
    import io

    try:
        # Decode base64 image data
        image_bytes = base64.b64decode(request.image_data)

        # Open image with PIL
        image = Image.open(io.BytesIO(image_bytes))

        # Convert to RGB if necessary (JPEG doesn't support transparency)
        if image.mode in ('RGBA', 'LA', 'P'):
            # Create white background
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')

        # Resolve directory path
        directory = Path(request.directory).expanduser().resolve()

        # Create directory if it doesn't exist
        directory.mkdir(parents=True, exist_ok=True)

        # Generate filename if not provided
        if request.filename:
            filename = request.filename
            # Ensure .jpg or .jpeg extension
            if not filename.lower().endswith(('.jpg', '.jpeg')):
                filename += '.jpg'
        else:
            # Auto-generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            filename = f"image_{timestamp}.jpg"

        # Full file path
        file_path = directory / filename

        # Save as JPEG with high quality
        image.save(file_path, 'JPEG', quality=95, optimize=True)

        logger.info(f"Saved image to: {file_path}")

        return {
            "success": True,
            "path": str(file_path),
            "filename": filename,
            "directory": str(directory)
        }

    except Exception as e:
        logger.error(f"Failed to save image: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save image: {str(e)}"
        )


@app.get("/api/local-file")
async def get_local_file(path: str):
    """
    Serve a local file for the frontend to access.
    This is needed for PDF viewer and other skills that need to access local filesystem files.

    Security: Only files that the MCP filesystem server has access to should be requested.
    The path validation is done by checking file existence and readable status.
    Path traversal attempts (e.g., '../../../etc/passwd') are rejected.
    """
    try:
        file_path = Path(path).resolve()

        # Security: Reject paths with parent directory references before resolution
        # This prevents path traversal attacks like '../../../etc/passwd'
        if '..' in Path(path).parts:
            logger.warning(f"[LOCAL FILE] Path traversal attempt detected: {path}")
            raise HTTPException(
                status_code=400,
                detail="Path traversal is not allowed"
            )

        # Validate that the file exists and is actually a file (not a directory)
        if not file_path.exists():
            logger.warning(f"[LOCAL FILE] File not found: {path}")
            raise HTTPException(
                status_code=404,
                detail=f"File not found: {path}"
            )

        if not file_path.is_file():
            logger.warning(f"[LOCAL FILE] Path is not a file: {path}")
            raise HTTPException(
                status_code=400,
                detail=f"Path is not a file: {path}"
            )

        # Check if file is readable
        if not os.access(file_path, os.R_OK):
            logger.warning(f"[LOCAL FILE] File not readable: {path}")
            raise HTTPException(
                status_code=403,
                detail=f"File not readable: {path}"
            )

        # Determine media type based on file extension
        media_type = "application/octet-stream"
        extension = file_path.suffix.lower()

        if extension == ".pdf":
            media_type = "application/pdf"
        elif extension in [".jpg", ".jpeg"]:
            media_type = "image/jpeg"
        elif extension == ".png":
            media_type = "image/png"
        elif extension == ".gif":
            media_type = "image/gif"
        elif extension == ".txt":
            media_type = "text/plain"
        elif extension == ".json":
            media_type = "application/json"
        elif extension == ".xml":
            media_type = "application/xml"

        logger.info(f"[LOCAL FILE] Serving file: {path} (type: {media_type})")

        # Return the file with appropriate headers
        # Set Content-Disposition to 'inline' so browsers display PDFs/images instead of downloading
        return FileResponse(
            path=str(file_path),
            media_type=media_type,
            filename=file_path.name,
            headers={
                "Content-Disposition": f'inline; filename="{file_path.name}"'
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[LOCAL FILE] Error serving file '{path}': {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to serve file: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    # Log startup configuration
    logger.info("=" * 60)
    logger.info("Starting OpenAI Realtime API Backend")
    logger.info(f"DEBUG: {DEBUG}")
    logger.info(f"DEBUG_REALTIME_EVENTS: {DEBUG_REALTIME_EVENTS}")
    logger.info(f"Log Level: {'DEBUG' if DEBUG else 'WARNING'}")
    logger.info(f"Log File: {logs_dir / 'backend.log'}")
    logger.info("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=8000)
