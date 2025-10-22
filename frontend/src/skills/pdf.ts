import { SkillHandler, Skill, ScratchpadAPI, ToolDefinition } from './types';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker - version 4.x uses .mjs extension for ES modules
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PDFContent {
  source: string; // URL or file path
  currentPage: number;
  totalPages?: number;
  sourceType: 'url' | 'file';
}

function parsePDFContent(content: string): PDFContent {
  try {
    return JSON.parse(content);
  } catch {
    // Fallback for simple URL/path strings
    return {
      source: content,
      currentPage: 1,
      sourceType: content.startsWith('http') ? 'url' : 'file',
    };
  }
}

function serializePDFContent(data: PDFContent): string {
  return JSON.stringify(data);
}

// Render PDF documents to canvas elements (called after DOM update)
export async function renderPDFDocuments(skills: Skill[]): Promise<void> {
  const pdfViewers = document.querySelectorAll('.pdf-viewer');

  for (const viewer of Array.from(pdfViewers)) {
    const skillId = viewer.id.replace('pdf-viewer-', '');
    const canvas = document.getElementById(`pdf-canvas-${skillId}`) as HTMLCanvasElement;

    if (!canvas) continue;

    // Find the skill with this ID
    const skill = skills.find(s => s.id === skillId);
    if (!skill || skill.type !== 'pdf') continue;

    try {
      const pdfData = parsePDFContent(skill.content);

      // Determine the PDF source URL
      let pdfSource = pdfData.source;
      if (pdfData.sourceType === 'file') {
        // For local files, use the backend proxy endpoint
        pdfSource = `http://localhost:8000/api/local-file?path=${encodeURIComponent(pdfData.source)}`;
      }

      const pdf = await pdfjsLib.getDocument(pdfSource).promise;

      // Update total pages if not set
      if (!pdfData.totalPages) {
        pdfData.totalPages = pdf.numPages;
        skill.content = serializePDFContent(pdfData);
      }

      // Render the current page
      const page = await pdf.getPage(pdfData.currentPage);
      const viewport = page.getViewport({ scale: 1.5 });

      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      console.log(`Rendered PDF ${skillId} page ${pdfData.currentPage} of ${pdfData.totalPages}`);
    } catch (error) {
      console.error(`Failed to render PDF ${skillId}:`, error);
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#f56565';
        context.font = '16px sans-serif';
        context.fillText('Failed to load PDF', 20, 40);
      }
    }
  }
}

// Attach event listeners to PDF navigation buttons (called after DOM update)
export function attachPDFNavigationListeners(
  skills: Skill[],
  updateUI: () => void,
  showToast: (message: string) => void
): void {
  const navButtons = document.querySelectorAll('.pdf-nav-btn');
  const pageInputs = document.querySelectorAll('.pdf-page-input');

  navButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      const skillId = (button as HTMLElement).getAttribute('data-skill-id');
      const action = (button as HTMLElement).getAttribute('data-action');

      if (!skillId || !action) return;

      const skill = skills.find(s => s.id === skillId);
      if (!skill || skill.type !== 'pdf') return;

      const pdfData = parsePDFContent(skill.content);
      let changed = false;

      switch (action) {
        case 'first':
          if (pdfData.currentPage > 1) {
            pdfData.currentPage = 1;
            changed = true;
          }
          break;
        case 'prev':
          if (pdfData.currentPage > 1) {
            pdfData.currentPage--;
            changed = true;
          }
          break;
        case 'next':
          if (!pdfData.totalPages || pdfData.currentPage < pdfData.totalPages) {
            pdfData.currentPage++;
            changed = true;
          }
          break;
        case 'last':
          if (pdfData.totalPages && pdfData.currentPage < pdfData.totalPages) {
            pdfData.currentPage = pdfData.totalPages;
            changed = true;
          }
          break;
      }

      if (changed) {
        skill.content = serializePDFContent(pdfData);
        updateUI();
        showToast(`PDF page: ${pdfData.currentPage}`);
      }
    });
  });

  pageInputs.forEach(input => {
    input.addEventListener('change', async (e) => {
      e.preventDefault();
      const skillId = (input as HTMLElement).getAttribute('data-skill-id');
      if (!skillId) return;

      const skill = skills.find(s => s.id === skillId);
      if (!skill || skill.type !== 'pdf') return;

      const pdfData = parsePDFContent(skill.content);
      const targetPage = parseInt((input as HTMLInputElement).value, 10);

      if (isNaN(targetPage) || targetPage < 1) {
        (input as HTMLInputElement).value = pdfData.currentPage.toString();
        return;
      }

      if (pdfData.totalPages && targetPage > pdfData.totalPages) {
        (input as HTMLInputElement).value = pdfData.currentPage.toString();
        showToast(`Page ${targetPage} exceeds total pages (${pdfData.totalPages})`);
        return;
      }

      pdfData.currentPage = targetPage;
      skill.content = serializePDFContent(pdfData);
      updateUI();
      showToast(`PDF page: ${pdfData.currentPage}`);
    });
  });
}

export const pdfSkill: SkillHandler = {
  type: 'pdf',

  async render(skill: Skill): Promise<string> {
    const data = parsePDFContent(skill.content);
    const pageInfo = data.totalPages
      ? `Page ${data.currentPage} of ${data.totalPages}`
      : `Page ${data.currentPage}`;

    return `
      <div class="skill-content pdf-skill" data-skill-id="${skill.id}">
        <div class="pdf-header">
          <div class="pdf-info">
            <span class="pdf-source-type">${data.sourceType === 'url' ? '🌐 URL' : '📁 File'}</span>
            <span class="pdf-page-info">${pageInfo}</span>
          </div>
          <div class="pdf-controls">
            <button class="pdf-nav-btn" data-skill-id="${skill.id}" data-action="first" title="First page">⏮</button>
            <button class="pdf-nav-btn" data-skill-id="${skill.id}" data-action="prev" title="Previous page">◀</button>
            <input type="number" class="pdf-page-input" data-skill-id="${skill.id}" value="${data.currentPage}" min="1" ${data.totalPages ? `max="${data.totalPages}"` : ''} title="Go to page">
            <button class="pdf-nav-btn" data-skill-id="${skill.id}" data-action="next" title="Next page">▶</button>
            <button class="pdf-nav-btn" data-skill-id="${skill.id}" data-action="last" title="Last page">⏭</button>
          </div>
        </div>
        <div class="pdf-viewer" id="pdf-viewer-${skill.id}">
          <canvas id="pdf-canvas-${skill.id}" class="pdf-canvas"></canvas>
        </div>
        <div class="pdf-source">
          <small>Source: ${data.source.length > 80 ? data.source.substring(0, 80) + '...' : data.source}</small>
        </div>
      </div>
    `;
  },

  generateDescription(skill: Skill): string {
    const data = parsePDFContent(skill.content);
    const fileName = data.source.split('/').pop() || data.source;
    return `${fileName} (${data.sourceType}) - Page ${data.currentPage}`;
  },

  getContentAsMarkdown(skill: Skill): string {
    const data = parsePDFContent(skill.content);
    const pageInfo = data.totalPages
      ? `Page ${data.currentPage} of ${data.totalPages}`
      : `Page ${data.currentPage}`;

    return `### PDF Viewer\n\n**Source:** ${data.source}\n\n**Type:** ${data.sourceType}\n\n**Current Page:** ${pageInfo}\n`;
  },

  getTools(api: ScratchpadAPI): ToolDefinition[] {
    return [
      {
        name: 'pdf_next_page',
        description: 'Navigate to the next page of a PDF document in the scratchpad',
        parameters: {
          type: 'object',
          properties: {
            skillId: {
              type: 'string',
              description: 'The skill ID of the PDF to navigate (e.g., "skill-1")',
            },
          },
          required: ['skillId'],
          additionalProperties: true,
        } as const,
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skillId);
          if (!skill || skill.type !== 'pdf') {
            return `Skill ${input.skillId} not found or is not a PDF`;
          }

          const data = parsePDFContent(skill.content);
          if (data.totalPages && data.currentPage >= data.totalPages) {
            return `Already on last page (${data.currentPage} of ${data.totalPages})`;
          }

          data.currentPage += 1;
          skill.content = serializePDFContent(data);
          api.updateUI();
          api.showToast(`PDF page: ${data.currentPage}`);

          return `Navigated to page ${data.currentPage}`;
        },
      },
      {
        name: 'pdf_previous_page',
        description: 'Navigate to the previous page of a PDF document in the scratchpad',
        parameters: {
          type: 'object',
          properties: {
            skillId: {
              type: 'string',
              description: 'The skill ID of the PDF to navigate',
            },
          },
          required: ['skillId'],
          additionalProperties: true,
        } as const,
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skillId);
          if (!skill || skill.type !== 'pdf') {
            return `Skill ${input.skillId} not found or is not a PDF`;
          }

          const data = parsePDFContent(skill.content);
          if (data.currentPage <= 1) {
            return `Already on first page`;
          }

          data.currentPage -= 1;
          skill.content = serializePDFContent(data);
          api.updateUI();
          api.showToast(`PDF page: ${data.currentPage}`);

          return `Navigated to page ${data.currentPage}`;
        },
      },
      {
        name: 'pdf_go_to_page',
        description: 'Navigate to a specific page of a PDF document in the scratchpad',
        parameters: {
          type: 'object',
          properties: {
            skillId: {
              type: 'string',
              description: 'The skill ID of the PDF to navigate',
            },
            page: {
              type: 'number',
              description: 'The page number to navigate to (1-based index)',
            },
          },
          required: ['skillId', 'page'],
          additionalProperties: true,
        } as const,
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skillId);
          if (!skill || skill.type !== 'pdf') {
            return `Skill ${input.skillId} not found or is not a PDF`;
          }

          const data = parsePDFContent(skill.content);
          const targetPage = Math.max(1, Math.floor(input.page));

          if (data.totalPages && targetPage > data.totalPages) {
            return `Page ${targetPage} exceeds total pages (${data.totalPages})`;
          }

          data.currentPage = targetPage;
          skill.content = serializePDFContent(data);
          api.updateUI();
          api.showToast(`PDF page: ${data.currentPage}`);

          return `Navigated to page ${data.currentPage}`;
        },
      },
      {
        name: 'pdf_get_info',
        description: 'Get information about a PDF document including total pages, current page, and source',
        parameters: {
          type: 'object',
          properties: {
            skillId: {
              type: 'string',
              description: 'The skill ID of the PDF to get info about',
            },
          },
          required: ['skillId'],
          additionalProperties: true,
        } as const,
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skillId);
          if (!skill || skill.type !== 'pdf') {
            return `Skill ${input.skillId} not found or is not a PDF`;
          }

          const data = parsePDFContent(skill.content);
          const fileName = data.source.split('/').pop() || data.source;

          const info = {
            skillId: input.skillId,
            fileName: fileName,
            source: data.source,
            sourceType: data.sourceType,
            currentPage: data.currentPage,
            totalPages: data.totalPages || 'Unknown (PDF needs to be rendered first)',
            hasPageInfo: !!data.totalPages,
          };

          return JSON.stringify(info, null, 2);
        },
      },
      {
        name: 'pdf_extract_text',
        description: 'Extract text content from PDF pages and return it directly for analysis. The extracted text is returned to you (the AI) so you can read, analyze, summarize, or process it.',
        parameters: {
          type: 'object',
          properties: {
            skillId: {
              type: 'string',
              description: 'The skill ID of the PDF to extract text from',
            },
            startPage: {
              type: 'number',
              description: 'The first page to extract (1-based index). Default: current page',
            },
            endPage: {
              type: 'number',
              description: 'The last page to extract (1-based index, inclusive). Default: same as startPage. Use -1 for all pages from startPage to end.',
            },
          },
          required: ['skillId'],
          additionalProperties: true,
        } as const,
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skillId);
          if (!skill || skill.type !== 'pdf') {
            return `Skill ${input.skillId} not found or is not a PDF`;
          }

          const data = parsePDFContent(skill.content);

          try {
            // Determine the PDF source URL
            let pdfSource = data.source;
            if (data.sourceType === 'file') {
              // For local files, use the backend proxy endpoint
              pdfSource = `http://localhost:8000/api/local-file?path=${encodeURIComponent(data.source)}`;
            }

            // Load the PDF
            const pdf = await pdfjsLib.getDocument(pdfSource).promise;
            const totalPages = pdf.numPages;

            // Update total pages if not set
            if (!data.totalPages) {
              data.totalPages = totalPages;
              skill.content = serializePDFContent(data);
            }

            // Determine page range
            const startPage = input.startPage || data.currentPage;
            let endPage = input.endPage !== undefined ? input.endPage : startPage;

            // Handle -1 as "all pages from startPage to end"
            if (endPage === -1) {
              endPage = totalPages;
            }

            // Validate page range
            if (startPage < 1 || startPage > totalPages) {
              return `Invalid startPage: ${startPage}. Must be between 1 and ${totalPages}`;
            }
            if (endPage < startPage || endPage > totalPages) {
              return `Invalid endPage: ${endPage}. Must be between ${startPage} and ${totalPages}`;
            }

            // Extract text from each page
            const pageTexts: string[] = [];
            for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');

              pageTexts.push(`--- Page ${pageNum} ---\n${pageText}\n`);
            }

            const extractedText = pageTexts.join('\n');

            // Show toast notification
            const pageRange = startPage === endPage
              ? `page ${startPage}`
              : `pages ${startPage}-${endPage}`;
            api.showToast(`Extracted text from ${pageRange}`);

            // Return the extracted text directly to the LLM
            const fileName = data.source.split('/').pop() || 'PDF';
            const pageCount = endPage - startPage + 1;

            const resultHeader = pageCount === 1
              ? `# ${fileName} - Page ${startPage}\n\n`
              : `# ${fileName} - Pages ${startPage}-${endPage}\n\n`;

            return resultHeader + extractedText;
          } catch (error) {
            return `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      },
      {
        name: 'pdf_page_to_image',
        description: 'Convert the current PDF page to an image for visual analysis. Returns the image to the AI model so it can see and analyze charts, diagrams, tables, or any visual content. The image is also added to the scratchpad for the user to see.',
        parameters: {
          type: 'object',
          properties: {
            skillId: {
              type: 'string',
              description: 'The skill ID of the PDF to convert',
            },
            page: {
              type: 'number',
              description: 'The page number to convert (1-based index). Default: current page',
            },
            scale: {
              type: 'number',
              description: 'Rendering scale/quality (1.0 = 72dpi, 2.0 = 144dpi, etc). Default: 1.5. Higher values = better quality but larger file size.',
            },
          },
          required: ['skillId'],
          additionalProperties: true,
        } as const,
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skillId);
          if (!skill || skill.type !== 'pdf') {
            return `Skill ${input.skillId} not found or is not a PDF`;
          }

          const data = parsePDFContent(skill.content);
          const scale = input.scale || 1.5;
          const pageNum = input.page || data.currentPage;

          try {
            // Determine the PDF source URL
            let pdfSource = data.source;
            if (data.sourceType === 'file') {
              // For local files, use the backend proxy endpoint
              pdfSource = `http://localhost:8000/api/local-file?path=${encodeURIComponent(data.source)}`;
            }

            // Load the PDF
            const pdf = await pdfjsLib.getDocument(pdfSource).promise;
            const totalPages = pdf.numPages;

            // Update total pages if not set
            if (!data.totalPages) {
              data.totalPages = totalPages;
              skill.content = serializePDFContent(data);
            }

            // Validate page number
            if (pageNum < 1 || pageNum > totalPages) {
              return `Invalid page number: ${pageNum}. Must be between 1 and ${totalPages}`;
            }

            // Convert the page to image
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale });

            // Create off-screen canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) {
              throw new Error('Failed to get canvas context');
            }

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Render page to canvas
            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;

            // Convert canvas to base64 with data URI prefix
            const base64WithPrefix = canvas.toDataURL('image/png');

            // Extract base64 data without the data URI prefix for OpenAI SDK
            const base64Data = base64WithPrefix.split(',')[1];

            // Add to scratchpad for user visibility
            const fileName = data.source.split('/').pop() || 'PDF';
            const altText = `${fileName} - Page ${pageNum}`;
            api.createSkill('image', base64WithPrefix, altText);

            // Show toast notification
            api.showToast(`Converted page ${pageNum} to image`);

            // Return image in OpenAI SDK format for AI visual analysis
            return {
              type: 'image',
              data: base64Data,
              mediaType: 'image/png'
            };
          } catch (error) {
            return `Failed to convert PDF page to image: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      },
    ];
  },

  getInstructions(): string {
    return `
**PDF Viewer Skill:**
Create PDF viewers using create_skill with type='pdf'. The content should be a JSON string with:
- source: URL or absolute file path to the PDF
- currentPage: Initial page number (default: 1)
- sourceType: 'url' or 'file'

Examples:
- URL: create_skill(type='pdf', content='{"source":"https://example.com/doc.pdf","currentPage":1,"sourceType":"url"}')
- Local file: create_skill(type='pdf', content='{"source":"/Users/user/Documents/report.pdf","currentPage":1,"sourceType":"file"}')

IMPORTANT: For local files, always use sourceType='file'. The backend will proxy the file access.
When using MCP filesystem tools to discover PDF files, use the absolute path returned by the tool.

PDF tools:
- pdf_get_info(skillId): Get PDF information (total pages, current page, filename, source)
- pdf_extract_text(skillId, startPage?, endPage?): Extract text from PDF pages
  * IMPORTANT: Returns the extracted text directly to you (the AI) for reading and analysis
  * Use this to read the actual text content from PDF pages
  * You will receive the full text and can analyze, summarize, or answer questions about it
  * startPage: First page to extract (default: current page)
  * endPage: Last page to extract (default: same as startPage, use -1 for all remaining pages)
  * Examples:
    - pdf_extract_text(skillId): Extract and read current page
    - pdf_extract_text(skillId, 1, 5): Extract and read pages 1-5
    - pdf_extract_text(skillId, 1, -1): Extract and read all pages
- pdf_page_to_image(skillId, page?, scale?): Convert a single PDF page to image for visual analysis
  * IMPORTANT: This tool returns the image directly to you (the AI) so you can SEE and ANALYZE it visually
  * Use this to analyze charts, diagrams, tables, forms, or any visual content that text extraction cannot capture
  * The image is also added to the scratchpad for the user to see
  * page: Page number to convert (default: current page)
  * scale: Rendering quality (1.0=72dpi, 1.5=108dpi, 2.0=144dpi, default: 1.5)
  * The image will be sent to you for visual analysis - you can describe what you see in the image
  * Examples:
    - pdf_page_to_image(skillId): Convert and analyze current page
    - pdf_page_to_image(skillId, 3): Convert and analyze page 3
    - pdf_page_to_image(skillId, 1, 2.0): Convert page 1 at high quality
- pdf_next_page(skillId): Go to next page
- pdf_previous_page(skillId): Go to previous page
- pdf_go_to_page(skillId, page): Jump to specific page

Note: The total page count is automatically determined when the PDF is first rendered or when text is extracted.
Use pdf_get_info to check if the page count is available.

Users can also click navigation buttons in the UI to control page viewing.`;
  },
};
