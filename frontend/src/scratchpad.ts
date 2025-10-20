import { marked } from 'marked';
import mermaid from 'mermaid';

// Scratchpad state
let scratchpadContent: string = '';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

export async function updateScratchpadUI(): Promise<void> {
  const scratchpadDiv = document.getElementById('scratchpad');
  if (!scratchpadDiv) return;

  if (scratchpadContent.trim() === '') {
    scratchpadDiv.innerHTML = '';
  } else {
    // Parse markdown
    let html = marked(scratchpadContent) as string;

    // Convert mermaid code blocks to proper format for mermaid.js
    // Replace <code class="language-mermaid">...</code> with <pre class="mermaid">...</pre>
    html = html.replace(
      /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
      '<pre class="mermaid">$1</pre>'
    );

    scratchpadDiv.innerHTML = html;

    // Render mermaid diagrams and wait for completion
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
        img.addEventListener('error', () => resolve()); // Resolve even on error to not block scrolling
      });
    });

    await Promise.all(imageLoadPromises);
  }

  // Scroll to bottom after all content is fully rendered
  const mainContainer = document.querySelector('.main-container') as HTMLElement;
  if (mainContainer) {
    mainContainer.scrollTop = mainContainer.scrollHeight;
  }
}

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

export function clearScratchpad(): string {
  scratchpadContent = '';
  updateScratchpadUI();
  showToast('Scratchpad cleared');
  return 'Scratchpad has been cleared successfully.';
}

export function addToScratchpad(text: string): string {
  if (scratchpadContent.trim() !== '') {
    scratchpadContent += '\n\n';
  }
  scratchpadContent += text;
  updateScratchpadUI();
  showToast('Added to scratchpad');
  return 'Text has been added to the scratchpad successfully.';
}

export function addImageToScratchpad(imageUrl: string, altText?: string): string {
  if (scratchpadContent.trim() !== '') {
    scratchpadContent += '\n\n';
  }

  // Add image in markdown format
  const alt = altText || 'Image';
  scratchpadContent += `![${alt}](${imageUrl})`;

  updateScratchpadUI();
  showToast('Image added to scratchpad');
  return `Image has been added to the scratchpad: ${imageUrl}`;
}

export function addBase64ImageToScratchpad(base64Data: string, mimeType?: string, altText?: string): string {
  if (scratchpadContent.trim() !== '') {
    scratchpadContent += '\n\n';
  }

  // Determine MIME type if not provided
  const mime = mimeType || 'image/png';

  // Add image as data URI in markdown format
  const alt = altText || 'Screenshot';
  const dataUri = `data:${mime};base64,${base64Data}`;
  scratchpadContent += `![${alt}](${dataUri})`;

  updateScratchpadUI();
  showToast('Base64 image added to scratchpad');
  return `Base64 image has been added to the scratchpad (${base64Data.length} chars)`;
}

export function readScratchpad(): string {
  if (scratchpadContent.trim() === '') {
    return 'The scratchpad is currently empty.';
  }
  return scratchpadContent;
}

export function resetScratchpad(): void {
  scratchpadContent = '';
  updateScratchpadUI();
}
