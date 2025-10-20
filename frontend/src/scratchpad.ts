import { marked } from 'marked';
import mermaid from 'mermaid';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

// Container types
export type ContainerType = 'markdown' | 'mermaid' | 'image-url' | 'image-base64';

// Container interface
export interface Container {
  id: string;
  type: ContainerType;
  content: string; // For markdown/mermaid: the text content. For image-url: URL. For image-base64: data URI
  altText?: string; // For images
  displaySize?: number; // Display size as percentage (100 = original size, 50 = half size, 200 = double size)
}

// Row interface
export interface Row {
  rowNumber: number;
  container: Container;
}

// Scratchpad state
let rows: Row[] = [];
let nextContainerId = 1;
let nextRowNumber = 1;

// Generate a short description from content
function generateShortDescription(container: Container): string {
  const { type, content, altText } = container;

  if (type === 'image-url') {
    return altText || content.substring(0, 40) + (content.length > 40 ? '...' : '');
  }

  if (type === 'image-base64') {
    return altText || 'Base64 Image';
  }

  // For markdown and mermaid, truncate the content
  const maxLength = 60;
  // Remove markdown formatting and newlines for a clean preview
  const cleanContent = content
    .replace(/[#*`_~\[\]()]/g, '') // Remove markdown symbols
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .trim();

  if (cleanContent.length <= maxLength) {
    return cleanContent;
  }

  return cleanContent.substring(0, maxLength) + '...';
}

async function renderContainer(container: Container): Promise<string> {
  const { type, content, altText, displaySize } = container;

  if (type === 'markdown') {
    const html = marked(content) as string;
    return `
      <div class="container-content markdown-container">
        ${html}
      </div>
    `;
  } else if (type === 'mermaid') {
    return `
      <div class="container-content mermaid-container">
        <pre class="mermaid">${content}</pre>
      </div>
    `;
  } else if (type === 'image-url') {
    const alt = altText || 'Image';
    const sizeStyle = displaySize ? `style="width: ${displaySize}%;"` : '';
    return `
      <div class="container-content image-url-container">
        <img src="${content}" alt="${alt}" ${sizeStyle} />
      </div>
    `;
  } else if (type === 'image-base64') {
    const alt = altText || 'Base64 Image';
    const sizeStyle = displaySize ? `style="width: ${displaySize}%;"` : '';
    return `
      <div class="container-content image-base64-container">
        <img src="${content}" alt="${alt}" ${sizeStyle} />
      </div>
    `;
  }

  return '';
}

export async function updateScratchpadUI(): Promise<void> {
  const scratchpadDiv = document.getElementById('scratchpad');
  if (!scratchpadDiv) return;

  if (rows.length === 0) {
    scratchpadDiv.innerHTML = '';
  } else {
    let html = '';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const isFirst = i === 0;
      const isLast = i === rows.length - 1;
      const shortDescription = generateShortDescription(row.container);

      const containerHtml = await renderContainer(row.container);
      html += `
        <div class="scratchpad-row" data-row="${row.rowNumber}" data-container-id="${row.container.id}">
          <div class="row-header">
            <span class="row-number">Row ${row.rowNumber}</span>
            <span class="container-id">${row.container.id} [${row.container.type}]</span>
            <span class="container-description">${shortDescription}</span>
            <div class="row-controls">
              <button class="row-btn row-up" data-container-id="${row.container.id}" ${isFirst ? 'disabled' : ''} title="Move row up">▲</button>
              <button class="row-btn row-down" data-container-id="${row.container.id}" ${isLast ? 'disabled' : ''} title="Move row down">▼</button>
            </div>
          </div>
          ${containerHtml}
        </div>
        <div class="row-separator"></div>
      `;
    }

    scratchpadDiv.innerHTML = html;

    // Render mermaid diagrams
    try {
      await mermaid.run({
        querySelector: '.scratchpad-content .mermaid',
      });
    } catch (error) {
      console.error('Failed to render mermaid diagrams:', error);
    }

    // Wait for all images to load
    const images = scratchpadDiv.querySelectorAll('img');
    const imageLoadPromises = Array.from(images).map(img => {
      if (img.complete) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve());
        img.addEventListener('error', () => resolve());
      });
    });

    await Promise.all(imageLoadPromises);

    // Add event listeners for row movement buttons
    attachRowControlListeners();
  }

  // Scroll to bottom after all content is fully rendered
  const mainContainer = document.querySelector('.main-container') as HTMLElement;
  if (mainContainer) {
    mainContainer.scrollTop = mainContainer.scrollHeight;
  }
}

// Attach event listeners to row control buttons
function attachRowControlListeners(): void {
  const upButtons = document.querySelectorAll('.row-btn.row-up');
  const downButtons = document.querySelectorAll('.row-btn.row-down');

  upButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const containerId = (button as HTMLElement).getAttribute('data-container-id');
      if (containerId) {
        moveRowUp(containerId);
      }
    });
  });

  downButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const containerId = (button as HTMLElement).getAttribute('data-container-id');
      if (containerId) {
        moveRowDown(containerId);
      }
    });
  });
}

export function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Generate unique container ID
function generateContainerId(): string {
  return `container-${nextContainerId++}`;
}

// Create a new container and add it to a new row
export function createContainer(type: ContainerType, content: string, altText?: string): string {
  const container: Container = {
    id: generateContainerId(),
    type,
    content,
    altText,
  };

  const row: Row = {
    rowNumber: nextRowNumber++,
    container,
  };

  rows.push(row);
  updateScratchpadUI();
  showToast(`${type} container created`);

  return `Container created: ${container.id} in row ${row.rowNumber}`;
}

// Read a specific container by ID
export function readContainer(containerId: string): string {
  const row = rows.find(r => r.container.id === containerId);

  if (!row) {
    return `Container ${containerId} not found`;
  }

  const { container } = row;
  return JSON.stringify({
    containerId: container.id,
    rowNumber: row.rowNumber,
    type: container.type,
    content: container.content,
    altText: container.altText,
  }, null, 2);
}

// Read all containers
export function readAllContainers(): string {
  if (rows.length === 0) {
    return 'The scratchpad is empty. No containers.';
  }

  const summary = rows.map(row => {
    const shortDescription = generateShortDescription(row.container);
    return {
      row: row.rowNumber,
      containerId: row.container.id,
      type: row.container.type,
      description: shortDescription,
      contentLength: row.container.content.length,
    };
  });

  return JSON.stringify(summary, null, 2);
}

// Update an existing container
export function updateContainer(containerId: string, content: string, altText?: string): string {
  const row = rows.find(r => r.container.id === containerId);

  if (!row) {
    return `Container ${containerId} not found`;
  }

  row.container.content = content;
  if (altText !== undefined) {
    row.container.altText = altText;
  }

  updateScratchpadUI();
  showToast(`Container ${containerId} updated`);

  return `Container ${containerId} updated successfully`;
}

// Delete a container by ID
export function deleteContainer(containerId: string): string {
  const index = rows.findIndex(r => r.container.id === containerId);

  if (index === -1) {
    return `Container ${containerId} not found`;
  }

  const rowNumber = rows[index].rowNumber;
  rows.splice(index, 1);

  updateScratchpadUI();
  showToast(`Container ${containerId} deleted`);

  return `Container ${containerId} (was in row ${rowNumber}) deleted successfully`;
}

// Clear all containers
export function clearScratchpad(): string {
  rows = [];
  nextContainerId = 1;
  nextRowNumber = 1;
  updateScratchpadUI();
  showToast('Scratchpad cleared');
  return 'Scratchpad has been cleared successfully.';
}

// Reset scratchpad without toast (for internal use)
export function resetScratchpad(): void {
  rows = [];
  nextContainerId = 1;
  nextRowNumber = 1;
  updateScratchpadUI();
}

// Optimize and convert image to JPEG for AI viewing
async function optimizeImageForAI(imageUrl: string): Promise<{ mimeType: string; base64Data: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Enable CORS for cross-origin images

    img.onload = () => {
      // Create a canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Calculate new dimensions (max 800x800, maintain aspect ratio)
      const maxSize = 800;
      let width = img.width;
      let height = img.height;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else {
          width = (width / height) * maxSize;
          height = maxSize;
        }
      }

      // Set canvas size
      canvas.width = width;
      canvas.height = height;

      // Draw image on canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG with quality reduction (0.7 = 70% quality)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

      if (match) {
        resolve({
          mimeType: match[1],
          base64Data: match[2],
        });
      } else {
        reject(new Error('Failed to convert canvas to base64'));
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
}

// Get image as base64 (for AI to "look" at images)
export async function getImageBase64(containerId: string): Promise<string> {
  const row = rows.find(r => r.container.id === containerId);

  if (!row) {
    return `Container ${containerId} not found`;
  }

  const { container } = row;

  if (container.type !== 'image-url' && container.type !== 'image-base64') {
    return `Container ${containerId} is not an image container (type: ${container.type})`;
  }

  if (container.type === 'image-base64') {
    // Extract base64 data from data URI
    const match = container.content.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return JSON.stringify({
        containerId: container.id,
        type: 'image-base64',
        mimeType: match[1],
        base64Data: match[2],
        altText: container.altText,
      }, null, 2);
    } else {
      return `Failed to parse base64 data from container ${containerId}`;
    }
  }

  if (container.type === 'image-url') {
    try {
      // Optimize and convert image to JPEG
      const { mimeType, base64Data } = await optimizeImageForAI(container.content);

      return JSON.stringify({
        containerId: container.id,
        type: 'image-url',
        url: container.content,
        mimeType: mimeType,
        base64Data: base64Data,
        altText: container.altText,
        optimized: true,
        format: 'JPEG (70% quality, max 800x800)',
      }, null, 2);
    } catch (error) {
      return `Error optimizing image: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  return `Unsupported image type for container ${containerId}`;
}

// Set image display size
export function setImageSize(containerId: string, sizePercentage: number): string {
  const row = rows.find(r => r.container.id === containerId);

  if (!row) {
    return `Container ${containerId} not found`;
  }

  const { container } = row;

  if (container.type !== 'image-url' && container.type !== 'image-base64') {
    return `Container ${containerId} is not an image container (type: ${container.type})`;
  }

  // Validate size percentage (min 10%, max 500%)
  if (sizePercentage < 10 || sizePercentage > 500) {
    return `Invalid size percentage: ${sizePercentage}. Must be between 10 and 500.`;
  }

  container.displaySize = sizePercentage;
  updateScratchpadUI();
  showToast(`Image size set to ${sizePercentage}%`);

  return `Container ${containerId} display size set to ${sizePercentage}%`;
}

// Move a row up (swap with previous row)
export function moveRowUp(containerId: string): string {
  const index = rows.findIndex(r => r.container.id === containerId);

  if (index === -1) {
    return `Container ${containerId} not found`;
  }

  if (index === 0) {
    return `Container ${containerId} is already at the top`;
  }

  // Swap with previous row
  [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];

  // Update row numbers
  rows[index - 1].rowNumber = index;
  rows[index].rowNumber = index + 1;

  updateScratchpadUI();
  showToast(`Moved ${containerId} up`);

  return `Container ${containerId} moved up`;
}

// Move a row down (swap with next row)
export function moveRowDown(containerId: string): string {
  const index = rows.findIndex(r => r.container.id === containerId);

  if (index === -1) {
    return `Container ${containerId} not found`;
  }

  if (index === rows.length - 1) {
    return `Container ${containerId} is already at the bottom`;
  }

  // Swap with next row
  [rows[index], rows[index + 1]] = [rows[index + 1], rows[index]];

  // Update row numbers
  rows[index].rowNumber = index + 1;
  rows[index + 1].rowNumber = index + 2;

  updateScratchpadUI();
  showToast(`Moved ${containerId} down`);

  return `Container ${containerId} moved down`;
}
