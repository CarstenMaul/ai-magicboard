import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';
import { tool } from '@openai/agents-core';
import {
  resetScratchpad,
  createSkill,
  getScratchpadTools,
  showToast,
  downloadScratchpadAsMarkdown,
  exitFullscreenSkill,
} from './scratchpad';

interface TokenResponse {
  token: string;
  expires_at?: string;
}

const API_URL = 'http://localhost:8000';

// Configuration: Keys to toggle mute/unmute (supports multiple keys)
// Common keys: 'AudioVolumeUp', 'AudioVolumeDown', 'Space', 'KeyM', etc.
// See: https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values
const MUTE_TOGGLE_KEYS = ["'", '<AudioVolumeUp>'];

// Configuration: Background colors for mute state (for controls panel)
const MUTED_BACKGROUND_COLOR = '#ff4444'; // Red when muted
const UNMUTED_BACKGROUND_COLOR = '#44ff44'; // Green when unmuted
const DEFAULT_BACKGROUND = 'white'; // Default white background

// Global agent and session references
let agent: RealtimeAgent | null = null;
let session: RealtimeSession | null = null;

async function performWebSearch(query: string): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/api/web-search?query=${encodeURIComponent(query)}`, {
      method: 'POST',
    });

    if (!response.ok) {
      return `Web search failed: ${response.status} ${response.statusText}`;
    }

    const data = await response.json();

    // Format the result with citations
    let result = data.result;

    if (data.citations && data.citations.length > 0) {
      result += '\n\nSources:\n';
      data.citations.forEach((citation: any, index: number) => {
        result += `${index + 1}. [${citation.title}](${citation.url})\n`;
      });
    }

    showToast('Web search completed');
    return result;
  } catch (error) {
    console.error('Web search error:', error);
    return `Web search error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}


async function performGoogleSearch(query: string, numResults: number = 5): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/api/google-search?query=${encodeURIComponent(query)}&num_results=${numResults}`, {
      method: 'POST',
    });

    if (!response.ok) {
      return `Google search failed: ${response.status} ${response.statusText}`;
    }

    const data = await response.json();

    // Format results
    let result = `Google Search Results for "${data.query}" (${data.total_results} total results):\n\n`;

    data.results.forEach((item: any, index: number) => {
      result += `${index + 1}. **${item.title}**\n`;
      result += `   ${item.snippet}\n`;
      result += `   Link: ${item.link}\n\n`;
    });

    showToast('Google search completed');
    return result;
  } catch (error) {
    console.error('Google search error:', error);
    return `Google search error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function performGoogleImageSearch(query: string, numResults: number = 5): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/api/google-image-search?query=${encodeURIComponent(query)}&num_results=${numResults}`, {
      method: 'POST',
    });

    if (!response.ok) {
      return `Google image search failed: ${response.status} ${response.statusText}`;
    }

    const data = await response.json();

    // Format results with image URLs
    let result = `Google Image Search Results for "${data.query}" (${data.total_results} total results):\n\n`;

    data.results.forEach((item: any, index: number) => {
      result += `${index + 1}. **${item.title}**\n`;
      result += `   Image URL: ${item.link}\n`;
      result += `   Size: ${item.width}x${item.height}\n`;
      if (item.context_link) {
        result += `   Found on: ${item.context_link}\n`;
      }
      result += `\n`;
    });

    showToast('Google image search completed');
    return result;
  } catch (error) {
    console.error('Google image search error:', error);
    return `Google image search error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function callMCPTool(toolName: string, args: any): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/api/mcp-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool_name: toolName,
        arguments: args
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`MCP tool call failed: ${response.status} ${response.statusText}`, errorText);
      return `MCP tool call failed: ${response.status} ${response.statusText}`;
    }

    const data = await response.json();

    if (data.isError) {
      return `Error: ${data.error || data.result}`;
    }

    // Return the full data object if it contains images, otherwise just the result text
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      return data; // Return full object with images array
    }

    return data.result || JSON.stringify(data);
  } catch (error) {
    console.error('MCP tool call error:', error);
    return `MCP tool call error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function fetchMCPTools(): Promise<any[]> {
  try {
    const response = await fetch(`${API_URL}/api/mcp-tools`);

    if (!response.ok) {
      console.error(`Failed to fetch MCP tools: ${response.status}`);
      return [];
    }

    const data = await response.json();
    console.log(`Fetched ${data.tools.length} MCP tools`);
    return data.tools;
  } catch (error) {
    console.error('Error fetching MCP tools:', error);
    return [];
  }
}

async function fetchEphemeralToken(): Promise<string> {
  const response = await fetch(`${API_URL}/api/token`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch token: ${response.status}`);
  }

  const data: TokenResponse = await response.json();
  return data.token;
}

async function startServerSideMonitoring(callId: string, ephemeralKey: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/monitor?call_id=${callId}&ephemeral_key=${ephemeralKey}`, {
      method: 'POST',
    });

    if (!response.ok) {
      console.error(`Failed to start server-side monitoring: ${response.status}`);
      return;
    }

    const data = await response.json();
    console.log('Server-side monitoring started:', data);
  } catch (error) {
    console.error('Error starting server-side monitoring:', error);
  }
}

async function connectAgent(): Promise<void> {
  const messageDiv = document.getElementById('message');
  const connectButton = document.getElementById('connectButton') as HTMLButtonElement;
  const disconnectButton = document.getElementById('disconnectButton') as HTMLButtonElement;

  if (!messageDiv || !connectButton || !disconnectButton) {
    console.error('Required DOM elements not found');
    return;
  }

  try {
    connectButton.disabled = true;
    messageDiv.textContent = 'Fetching token...';
    messageDiv.className = 'message';

    // Fetch ephemeral token from backend
    const ephemeralKey = await fetchEphemeralToken();

    messageDiv.textContent = 'Fetching MCP tools...';

    // Fetch MCP tools from backend
    const mcpTools = await fetchMCPTools();

    messageDiv.textContent = 'Creating agent...';

    // Convert MCP tools to RealtimeAgent tool format
    const mcpToolDefinitions = mcpTools.map((mcpTool: any) => {
      console.log(`Registering MCP tool: ${mcpTool.name} from server: ${mcpTool.mcp_server}`);
      return tool({
        name: mcpTool.name,
        description: mcpTool.description || 'MCP tool',
        parameters: {
          type: 'object',
          properties: mcpTool.inputSchema?.properties || {},
          required: mcpTool.inputSchema?.required || [],
          additionalProperties: true,
        } as const,
        strict: false,
        execute: async (input: any) => {
          console.log(`Executing MCP tool: ${mcpTool.name} with args:`, input);
          const result = await callMCPTool(mcpTool.name, input);
          console.log(`MCP tool ${mcpTool.name} result:`, result);

          // If the result contains images, add them to scratchpad and send to model
          if (typeof result === 'object' && result !== null && 'images' in result && Array.isArray((result as any).images)) {
            const resultWithImages = result as any;
            const textResult = resultWithImages.result || 'Tool executed successfully';

            // Automatically add each image to the scratchpad
            for (let i = 0; i < resultWithImages.images.length; i++) {
              const img = resultWithImages.images[i];
              const altText = `${mcpTool.name} result ${i + 1}`;
              const mime = img.mimeType || 'image/png';
              const dataUri = `data:${mime};base64,${img.data}`;
              createSkill('image', dataUri, altText);
              console.log(`Auto-added image ${i + 1} to scratchpad from ${mcpTool.name}`);
            }

            return `${textResult}. ${resultWithImages.images.length} image(s) added to scratchpad.`;
          }

          return result;
        },
      });
    });

    if (mcpToolDefinitions.length > 0) {
      console.log(`Registered ${mcpToolDefinitions.length} MCP tools`);
    } else {
      console.log('No MCP tools available');
    }

    // Get dynamically assembled scratchpad tools and instructions
    const { tools: scratchpadTools, instructions: scratchpadInstructions } = getScratchpadTools();

    // Wrap scratchpad tools with the tool() function from @openai/agents-core
    // AND add image handling to send images directly to the AI
    const wrappedScratchpadTools = scratchpadTools.map((t: any) => tool({
      ...t,
      execute: async (input: any) => {
        const result = await t.execute(input);

        // Check if result is an image object (returned by pdf_page_to_image and similar tools)
        if (typeof result === 'object' && result !== null && result.type === 'image') {
          // Convert to data URI format for session.addImage()
          const dataUri = `data:${result.mediaType};base64,${result.data}`;

          // Send image to AI for visual analysis
          if (session) {
            session.addImage(dataUri);
            console.log(`✓ Sent image to AI from tool: ${t.name} (size: ${result.data.length} chars)`);
          } else {
            console.warn(`⚠ Session not available to send image from tool: ${t.name}`);
          }

          // Return text description instead of image object
          // This tells the AI that the image has been sent and is ready for analysis
          return `Image has been sent to you for visual analysis. You can now see and describe what's in the image.`;
        }

        // For non-image results, return as-is
        return result;
      }
    }));

    // Create the agent with scratchpad tools and MCP tools
    agent = new RealtimeAgent({
      name: 'Assistant',
      instructions: `You are a helpful assistant. ONLY speak in german language. Never switch to any other language.

IMPORTANT: After answering a question or replying to a request, do NOT ask if there is anything else i like to discuss, or similar statements.

You have access to several powerful tools:

${scratchpadInstructions}

**Search Tools:**
- web_search: Search using OpenAI's web search for current information with citations
- google_search: Search Google for web results (title, snippet, link)
- google_image_search: Search Google Images for image URLs

Use search tools when:
- The user asks for current/recent information (news, events, prices, etc.)
- You need to verify facts or find up-to-date information
- The question requires information you don't have in your training data
- The user explicitly asks you to search
- The user wants to see images related to a topic (use google_image_search)

The scratchpad is visible to the user in real-time on their screen with rendered markdown and interactive diagrams.

You also have access to MCP (Model Context Protocol) tools from configured servers. These tools are dynamically loaded and provide additional capabilities.`,
      tools: [
        ...mcpToolDefinitions,
        ...wrappedScratchpadTools,
        tool({
          name: 'web_search',
          description: 'Search the internet for current information, news, facts, or data. Returns search results with citations from web sources.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query to look up on the internet',
              },
            },
            required: ['query'],
            additionalProperties: true,
          } as const,
          strict: false,
          execute: async (input: any) => {
            return await performWebSearch(input.query);
          },
        }),
        tool({
          name: 'google_search',
          description: 'Search Google for web results. Returns titles, snippets, and links to web pages.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query for Google',
              },
              num_results: {
                type: 'number',
                description: 'Number of results to return (1-10, default: 5)',
              },
            },
            required: ['query'],
            additionalProperties: true,
          } as const,
          strict: false,
          execute: async (input: any) => {
            return await performGoogleSearch(input.query, input.num_results || 5);
          },
        }),
        tool({
          name: 'google_image_search',
          description: 'Search Google Images for image URLs. Returns image links with dimensions that can be displayed using create_skill with type="image".',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The image search query for Google',
              },
              num_results: {
                type: 'number',
                description: 'Number of image results to return (1-10, default: 5)',
              },
            },
            required: ['query'],
            additionalProperties: true,
          } as const,
          strict: false,
          execute: async (input: any) => {
            return await performGoogleImageSearch(input.query, input.num_results || 5);
          },
        }),
      ],
    });

    // Create the session with low-latency optimizations
    session = new RealtimeSession(agent, {
      model: 'gpt-realtime',
      transport: 'webrtc', // Explicitly use WebRTC for lowest latency
      config: {
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 }, // PCM format for minimal processing
            turnDetection: {
              type: 'semantic_vad',
              eagerness: 'high', // High eagerness for faster response times
              interruptResponse: true, // Allow natural conversation flow with interruptions
            },
          },
          output: {
            format: { type: 'audio/pcm', rate: 24000 }, // PCM format for output
          },
        },
      },
    });

    messageDiv.textContent = 'Connecting to OpenAI...';

    // Connect to the session
    await session.connect({
      apiKey: ephemeralKey,
    });

    // Extract call_id from the transport layer
    // The WebRTC transport layer exposes the callId property
    const transport = session.transport as any;

    // The callId might not be immediately available, so we'll retry a few times
    let callId = transport?.callId;
    let retries = 0;
    while (!callId && retries < 10) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
      callId = transport?.callId;
      retries++;
    }

    if (callId) {
      console.log('Call ID extracted:', callId);
      messageDiv.textContent = 'Starting server-side monitoring...';

      // Start server-side monitoring with the ephemeral key
      await startServerSideMonitoring(callId, ephemeralKey);
    } else {
      console.warn('Could not extract call_id from transport after retries. Server-side monitoring not started.');
      console.log('Transport object:', transport);
    }

    messageDiv.textContent = 'Connected! You can now talk to the agent.';
    messageDiv.className = 'message';
    connectButton.disabled = true;
    disconnectButton.disabled = false;

    // Enable mute button after successful connection
    const muteButton = document.getElementById('muteButton') as HTMLButtonElement;
    if (muteButton) {
      muteButton.disabled = false;
      muteButton.textContent = 'Mute Microphone';
    }

    // Set initial controls panel background to unmuted color (microphone starts unmuted)
    const controlsPanel = document.querySelector('.controls-panel') as HTMLElement;
    if (controlsPanel) {
      controlsPanel.style.background = UNMUTED_BACKGROUND_COLOR;
    }

    console.log('Agent connected successfully!');
  } catch (error) {
    messageDiv.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    messageDiv.className = 'message error';
    console.error('Failed to connect agent:', error);
    connectButton.disabled = false;
    disconnectButton.disabled = true;
  }
}

function updateMuteButtonUI(): void {
  const muteButton = document.getElementById('muteButton') as HTMLButtonElement;
  const controlsPanel = document.querySelector('.controls-panel') as HTMLElement;

  if (!session || !muteButton || !controlsPanel) {
    return;
  }

  const currentMuteState = session.muted;
  if (currentMuteState !== null) {
    muteButton.textContent = currentMuteState ? 'Unmute Microphone' : 'Mute Microphone';

    // Update controls panel background color based on mute state
    controlsPanel.style.background = currentMuteState ? MUTED_BACKGROUND_COLOR : UNMUTED_BACKGROUND_COLOR;
  }
}

function toggleMute(): void {
  if (!session) {
    console.error('Session not active');
    return;
  }

  try {
    const currentMuteState = session.muted;

    // Toggle mute state
    if (currentMuteState === null) {
      console.warn('Muting not supported by the current transport layer');
      return;
    }

    const newMuteState = !currentMuteState;
    session.mute(newMuteState);

    // Update button text based on mute state
    updateMuteButtonUI();

    console.log(`Microphone ${newMuteState ? 'muted' : 'unmuted'}`);
  } catch (error) {
    console.error('Failed to toggle mute:', error);
  }
}

async function disconnectAgent(): Promise<void> {
  const messageDiv = document.getElementById('message');
  const connectButton = document.getElementById('connectButton') as HTMLButtonElement;
  const disconnectButton = document.getElementById('disconnectButton') as HTMLButtonElement;

  if (!messageDiv || !connectButton || !disconnectButton) {
    console.error('Required DOM elements not found');
    return;
  }

  try {
    if (session) {
      session.close();
      session = null;
      agent = null;
    }

    // Clear scratchpad on disconnect
    resetScratchpad();

    messageDiv.textContent = 'Disconnected. Click connect to start again.';
    messageDiv.className = 'message';
    connectButton.disabled = false;
    disconnectButton.disabled = true;

    // Disable mute button when disconnected
    const muteButton = document.getElementById('muteButton') as HTMLButtonElement;
    if (muteButton) {
      muteButton.disabled = true;
      muteButton.textContent = 'Mute Microphone';
    }

    // Reset controls panel background to default
    const controlsPanel = document.querySelector('.controls-panel') as HTMLElement;
    if (controlsPanel) {
      controlsPanel.style.background = DEFAULT_BACKGROUND;
    }

    console.log('Agent disconnected');
  } catch (error) {
    messageDiv.textContent = `Error disconnecting: ${error instanceof Error ? error.message : 'Unknown error'}`;
    messageDiv.className = 'message error';
    console.error('Failed to disconnect agent:', error);
  }
}

// Keyboard event handler for mute toggle and fullscreen exit
function handleKeyDown(event: KeyboardEvent): void {
  // Handle ESC key to exit fullscreen
  if (event.key === 'Escape' || event.code === 'Escape') {
    const scratchpadDiv = document.getElementById('scratchpad');
    if (scratchpadDiv && scratchpadDiv.classList.contains('fullscreen-mode')) {
      event.preventDefault();
      exitFullscreenSkill();
      return;
    }
  }

  // Debug: Display last key pressed
  const debugInfo = document.getElementById('debugInfo');
  if (debugInfo) {
    // Check both code and key for matching (media keys use event.key, regular keys use event.code)
    const matches = MUTE_TOGGLE_KEYS.includes(event.code) || MUTE_TOGGLE_KEYS.includes(event.key);
    const sessionActive = session !== null;
    debugInfo.textContent = `Debug: code="${event.code}" key="${event.key}" | matches=${matches} sessionActive=${sessionActive}`;
  }

  // Check if the pressed key matches any of the configured mute toggle keys
  // For media keys (like AudioVolumeUp), event.code is empty, so check event.key instead
  if (MUTE_TOGGLE_KEYS.includes(event.code) || MUTE_TOGGLE_KEYS.includes(event.key)) {
    console.log(`Mute toggle key pressed! event.code="${event.code}" event.key="${event.key}" MUTE_TOGGLE_KEYS=${JSON.stringify(MUTE_TOGGLE_KEYS)}`);

    // Prevent default behavior (e.g., system volume control)
    event.preventDefault();

    // Only toggle if session is active
    if (session) {
      console.log('Session is active, toggling mute...');
      toggleMute();
    } else {
      console.log('Session not active, cannot toggle mute');
    }
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  const connectButton = document.getElementById('connectButton');
  const disconnectButton = document.getElementById('disconnectButton');
  const muteButton = document.getElementById('muteButton');
  const downloadButton = document.getElementById('downloadButton');

  if (connectButton) {
    connectButton.addEventListener('click', connectAgent);
  }

  if (disconnectButton) {
    disconnectButton.addEventListener('click', disconnectAgent);
  }

  if (muteButton) {
    muteButton.addEventListener('click', toggleMute);
  }

  if (downloadButton) {
    downloadButton.addEventListener('click', downloadScratchpadAsMarkdown);
  }

  // Add keyboard listener for mute toggle
  document.addEventListener('keydown', handleKeyDown);

  // Display configured keys info
  const keyInfo = document.getElementById('keyInfo');
  if (keyInfo) {
    // Convert key codes to readable format
    const readableKeys = MUTE_TOGGLE_KEYS.map(key =>
      key.replace('Audio', '')
         .replace('Key', '')
         .replace(/([A-Z])/g, ' $1')
         .trim()
    );

    if (readableKeys.length === 1) {
      keyInfo.textContent = `Press "${readableKeys[0]}" to mute/unmute`;
    } else if (readableKeys.length === 2) {
      keyInfo.textContent = `Press "${readableKeys[0]}" or "${readableKeys[1]}" to mute/unmute`;
    } else {
      const lastKey = readableKeys.pop();
      keyInfo.textContent = `Press "${readableKeys.join('", "')}", or "${lastKey}" to mute/unmute`;
    }
  }

  console.log(`Mute toggle keys configured: ${JSON.stringify(MUTE_TOGGLE_KEYS)}`);

  // Initialize draggable controls panel
  initializeDraggableControls();
});

// Draggable controls panel functionality with touch support
function initializeDraggableControls(): void {
  const controlsPanel = document.getElementById('controlsPanel');
  if (!controlsPanel) {
    console.error('Controls panel not found');
    return;
  }

  let isDragging = false;
  let currentX = 0;
  let currentY = 0;
  let initialX = 0;
  let initialY = 0;
  let xOffset = 0;
  let yOffset = 0;

  // Mouse events
  controlsPanel.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  // Touch events
  controlsPanel.addEventListener('touchstart', touchStart, { passive: false });
  document.addEventListener('touchmove', touchMove, { passive: false });
  document.addEventListener('touchend', touchEnd);

  function dragStart(e: MouseEvent): void {
    // Prevent dragging if clicking on buttons
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }

    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    isDragging = true;
  }

  function touchStart(e: TouchEvent): void {
    // Prevent dragging if touching buttons
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }

    const touch = e.touches[0];
    initialX = touch.clientX - xOffset;
    initialY = touch.clientY - yOffset;

    isDragging = true;
  }

  function drag(e: MouseEvent): void {
    if (!isDragging) return;

    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;

    xOffset = currentX;
    yOffset = currentY;

    setTranslate(currentX, currentY, controlsPanel as HTMLElement);
  }

  function touchMove(e: TouchEvent): void {
    if (!isDragging) return;

    e.preventDefault();
    const touch = e.touches[0];
    currentX = touch.clientX - initialX;
    currentY = touch.clientY - initialY;

    xOffset = currentX;
    yOffset = currentY;

    setTranslate(currentX, currentY, controlsPanel as HTMLElement);
  }

  function dragEnd(): void {
    isDragging = false;
  }

  function touchEnd(): void {
    isDragging = false;
  }

  function setTranslate(xPos: number, yPos: number, el: HTMLElement): void {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }
}
