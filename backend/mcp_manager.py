"""
MCP Server Manager

Manages Model Context Protocol (MCP) servers that provide tools via stdio transport.
Compatible with Claude Desktop MCP server configuration format.
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
import uuid
import shutil
import sys

logger = logging.getLogger(__name__)


class MCPServer:
    """Represents a single MCP server connection using stdio transport."""

    def __init__(self, name: str, command: str, args: List[str], env: Optional[Dict[str, str]] = None, timeout: float = 120.0):
        self.name = name
        self.command = command
        self.args = args
        self.env = env or {}
        self.timeout = timeout  # Timeout for tool calls in seconds
        self.process: Optional[asyncio.subprocess.Process] = None
        self.message_id_counter = 0
        self.pending_requests: Dict[str, asyncio.Future] = {}
        self.tools: List[Dict[str, Any]] = []
        self.reader_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start the MCP server process."""
        try:
            # Prepare environment variables
            import os
            env = os.environ.copy()
            env.update(self.env)

            # Resolve command path (handles .cmd/.bat files on Windows)
            command_path = shutil.which(self.command)
            if not command_path:
                logger.error(f"Command '{self.command}' not found in PATH. Please ensure it's installed and available.")
                raise FileNotFoundError(f"Command not found: {self.command}")

            logger.debug(f"Resolved command '{self.command}' to '{command_path}'")

            # On Windows, we need to use shell=True for .cmd/.bat files, or run them via cmd
            # Increase stream limit to 10MB to handle large responses (like base64 images from screenshot servers)
            stream_limit = 10 * 1024 * 1024  # 10MB

            if sys.platform == 'win32' and command_path.lower().endswith(('.cmd', '.bat')):
                # Run the command through cmd.exe on Windows
                full_command = [command_path] + self.args
                self.process = await asyncio.create_subprocess_exec(
                    'cmd',
                    '/c',
                    *full_command,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=env,
                    limit=stream_limit
                )
            else:
                # Unix or direct executable
                self.process = await asyncio.create_subprocess_exec(
                    command_path,
                    *self.args,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=env,
                    limit=stream_limit
                )

            # Start reading responses
            self.reader_task = asyncio.create_task(self._read_responses())

            # Start reading stderr for logging
            asyncio.create_task(self._read_stderr())

            # Initialize the connection
            await self._initialize()

            logger.info(f"MCP server '{self.name}' started successfully (command: {self.command}, timeout: {self.timeout}s)")

        except FileNotFoundError as e:
            logger.error(f"Failed to start MCP server '{self.name}': {e}")
            logger.error(f"Make sure '{self.command}' is installed and in your PATH")
            raise
        except Exception as e:
            logger.error(f"Failed to start MCP server '{self.name}': {e}", exc_info=True)
            raise

    async def _initialize(self) -> None:
        """Initialize the MCP connection and fetch tools."""
        # Send initialize request
        init_response = await self._send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "roots": {"listChanged": True},
                "sampling": {}
            },
            "clientInfo": {
                "name": "openai-realtime-mcp-client",
                "version": "1.0.0"
            }
        })

        if "error" in init_response:
            raise Exception(f"Initialize failed: {init_response['error']}")

        # Send initialized notification
        await self._send_notification("notifications/initialized")

        # Fetch available tools
        await self._fetch_tools()

    async def _fetch_tools(self) -> None:
        """Fetch the list of available tools from the MCP server."""
        response = await self._send_request("tools/list", {})

        if "error" in response:
            logger.error(f"Failed to fetch tools from '{self.name}': {response['error']}")
            return

        self.tools = response.get("result", {}).get("tools", [])
        logger.info(f"Fetched {len(self.tools)} tools from MCP server '{self.name}'")

    async def _send_request(self, method: str, params: Any) -> Dict[str, Any]:
        """Send a JSON-RPC request and wait for response."""
        if not self.process or not self.process.stdin:
            raise Exception(f"MCP server '{self.name}' is not running")

        # Generate unique request ID
        request_id = str(uuid.uuid4())
        self.message_id_counter += 1

        # Create request
        request = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params
        }

        # Create future for the response
        future = asyncio.Future()
        self.pending_requests[request_id] = future

        # Send request
        request_json = json.dumps(request) + "\n"
        self.process.stdin.write(request_json.encode())
        await self.process.stdin.drain()

        # Wait for response (with timeout)
        try:
            response = await asyncio.wait_for(future, timeout=self.timeout)
            return response
        except asyncio.TimeoutError:
            del self.pending_requests[request_id]
            logger.warning(f"MCP server '{self.name}' method '{method}' timed out after {self.timeout}s")
            return {"error": {"code": -1, "message": f"Request timeout after {self.timeout}s"}}

    async def _send_notification(self, method: str, params: Any = None) -> None:
        """Send a JSON-RPC notification (no response expected)."""
        if not self.process or not self.process.stdin:
            raise Exception(f"MCP server '{self.name}' is not running")

        notification = {
            "jsonrpc": "2.0",
            "method": method,
        }
        if params is not None:
            notification["params"] = params

        notification_json = json.dumps(notification) + "\n"
        self.process.stdin.write(notification_json.encode())
        await self.process.stdin.drain()

    async def _read_responses(self) -> None:
        """Read responses from the MCP server's stdout."""
        if not self.process or not self.process.stdout:
            return

        try:
            while True:
                line = await self.process.stdout.readline()
                if not line:
                    break

                try:
                    message = json.loads(line.decode().strip())

                    # Handle response to a request
                    if "id" in message and message["id"] in self.pending_requests:
                        future = self.pending_requests.pop(message["id"])
                        future.set_result(message)

                    # Handle notifications
                    elif "method" in message:
                        logger.debug(f"Received notification from '{self.name}': {message['method']}")

                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse message from '{self.name}': {e}")

        except Exception as e:
            logger.error(f"Error reading from MCP server '{self.name}': {e}")

    async def _read_stderr(self) -> None:
        """Read and log stderr from the MCP server."""
        if not self.process or not self.process.stderr:
            return

        try:
            while True:
                line = await self.process.stderr.readline()
                if not line:
                    break

                stderr_text = line.decode().strip()
                if stderr_text:
                    logger.warning(f"[{self.name} stderr] {stderr_text}")

        except Exception as e:
            logger.error(f"Error reading stderr from MCP server '{self.name}': {e}")

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool on the MCP server."""
        response = await self._send_request("tools/call", {
            "name": tool_name,
            "arguments": arguments
        })

        if "error" in response:
            return {
                "error": response["error"]["message"],
                "isError": True
            }

        result = response.get("result", {})
        content = result.get("content", [])

        # Extract text and images from content
        text_parts = []
        images = []

        for item in content:
            if item.get("type") == "text":
                text_parts.append(item.get("text", ""))
            elif item.get("type") == "image":
                images.append({
                    "data": item.get("data", ""),
                    "mimeType": item.get("mimeType", "image/png")
                })

        response_data = {
            "isError": result.get("isError", False)
        }

        # Combine text results
        if text_parts:
            response_data["result"] = "\n".join(text_parts)
        else:
            response_data["result"] = json.dumps(result)

        # Add image data if present
        if images:
            response_data["images"] = images

        return response_data

    async def stop(self) -> None:
        """Stop the MCP server process."""
        if self.reader_task:
            self.reader_task.cancel()

        if self.process:
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self.process.kill()
                await self.process.wait()

            logger.info(f"MCP server '{self.name}' stopped")

    def get_tools(self) -> List[Dict[str, Any]]:
        """Get the list of tools with server name prefix."""
        # Add server name prefix to tool names to avoid conflicts
        prefixed_tools = []
        for tool in self.tools:
            prefixed_tool = tool.copy()
            prefixed_tool["name"] = f"{self.name}__{tool['name']}"
            prefixed_tool["mcp_server"] = self.name
            prefixed_tool["original_name"] = tool["name"]
            prefixed_tools.append(prefixed_tool)
        return prefixed_tools


class MCPManager:
    """Manages multiple MCP servers."""

    def __init__(self, config_path: Path):
        self.config_path = config_path
        self.servers: Dict[str, MCPServer] = {}

    async def start_all(self) -> None:
        """Start all configured MCP servers."""
        if not self.config_path.exists():
            logger.warning(f"MCP config file not found: {self.config_path}")
            return

        try:
            with open(self.config_path, 'r') as f:
                config = json.load(f)

            mcp_servers = config.get("mcpServers", {})

            for name, server_config in mcp_servers.items():
                try:
                    # Get timeout from config, default to 120 seconds
                    timeout = server_config.get("timeout", 120.0)

                    server = MCPServer(
                        name=name,
                        command=server_config["command"],
                        args=server_config.get("args", []),
                        env=server_config.get("env", {}),
                        timeout=timeout
                    )
                    await server.start()
                    self.servers[name] = server
                    logger.info(f"MCP server '{name}' configured with {timeout}s timeout")
                except Exception as e:
                    logger.error(f"Failed to start MCP server '{name}': {e}")

            logger.info(f"Started {len(self.servers)} MCP servers")

        except Exception as e:
            logger.error(f"Failed to load MCP config: {e}")

    async def stop_all(self) -> None:
        """Stop all MCP servers."""
        for server in self.servers.values():
            await server.stop()
        self.servers.clear()

    def get_all_tools(self) -> List[Dict[str, Any]]:
        """Get all tools from all MCP servers."""
        all_tools = []
        for server in self.servers.values():
            all_tools.extend(server.get_tools())
        return all_tools

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool on the appropriate MCP server."""
        # Extract server name from tool name (format: servername__toolname)
        if "__" not in tool_name:
            return {"error": f"Invalid tool name format: {tool_name}", "isError": True}

        server_name, original_tool_name = tool_name.split("__", 1)

        if server_name not in self.servers:
            return {"error": f"MCP server '{server_name}' not found", "isError": True}

        server = self.servers[server_name]
        return await server.call_tool(original_tool_name, arguments)
