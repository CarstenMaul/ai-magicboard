import mermaid from 'mermaid';
import { Grid } from 'gridjs';
import { Skill, SkillType, getSkillHandler, getAllTools, getAllInstructions } from './skills';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

// Re-export for backward compatibility
export type { Skill, SkillType };

// Row interface
export interface Row {
  rowNumber: number;
  skill: Skill;
}

// Scratchpad state
let rows: Row[] = [];
let nextSkillId = 1;
let nextRowNumber = 1;
let fullscreenSkillId: string | null = null;

// Generate a short description from skill content
function generateShortDescription(skill: Skill): string {
  const handler = getSkillHandler(skill.type);
  return handler.generateDescription(skill);
}

async function renderSkill(skill: Skill): Promise<string> {
  const handler = getSkillHandler(skill.type);
  return await handler.render(skill);
}

export async function updateScratchpadUI(): Promise<void> {
  const scratchpadDiv = document.getElementById('scratchpad');
  if (!scratchpadDiv) return;

  // Handle fullscreen mode
  if (fullscreenSkillId) {
    const fullscreenRow = rows.find(r => r.skill.id === fullscreenSkillId);
    if (fullscreenRow) {
      const skillHtml = await renderSkill(fullscreenRow.skill);
      const shortDescription = generateShortDescription(fullscreenRow.skill);

      scratchpadDiv.innerHTML = `
        <div class="fullscreen-overlay" id="fullscreenOverlay">
          <div class="fullscreen-header">
            <div class="fullscreen-info">
              <span class="fullscreen-row-number">Row ${fullscreenRow.rowNumber}</span>
              <span class="fullscreen-skill-id">${fullscreenRow.skill.id} [${fullscreenRow.skill.type}]</span>
              <span class="fullscreen-description">${shortDescription}</span>
            </div>
            <button class="fullscreen-exit-btn" onclick="window.exitFullscreenSkill()" title="Exit fullscreen (ESC)">✕ Exit Fullscreen</button>
          </div>
          <div class="fullscreen-content">
            ${skillHtml}
          </div>
        </div>
      `;

      // Add fullscreen class to scratchpad for styling
      scratchpadDiv.classList.add('fullscreen-mode');
    } else {
      // Fullscreen skill not found, exit fullscreen
      fullscreenSkillId = null;
    }
  }

  // Normal mode (not fullscreen)
  if (!fullscreenSkillId) {
    scratchpadDiv.classList.remove('fullscreen-mode');

    if (rows.length === 0) {
      scratchpadDiv.innerHTML = '';
    } else {
      let html = '';

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const isFirst = i === 0;
        const isLast = i === rows.length - 1;
        const shortDescription = generateShortDescription(row.skill);

        const skillHtml = await renderSkill(row.skill);
        html += `
          <div class="scratchpad-row" data-row="${row.rowNumber}" data-skill-id="${row.skill.id}">
            <div class="row-header">
              <span class="row-number">Row ${row.rowNumber}</span>
              <span class="skill-id">${row.skill.id} [${row.skill.type}]</span>
              <span class="skill-description">${shortDescription}</span>
              <div class="row-controls">
                <button class="row-btn row-up" data-skill-id="${row.skill.id}" ${isFirst ? 'disabled' : ''} title="Move row up">▲</button>
                <button class="row-btn row-down" data-skill-id="${row.skill.id}" ${isLast ? 'disabled' : ''} title="Move row down">▼</button>
              </div>
            </div>
            ${skillHtml}
          </div>
          <div class="row-separator"></div>
        `;
      }

      scratchpadDiv.innerHTML = html;
    }
  }

  // Only render mermaid/tables if not in fullscreen or if fullscreen skill needs them
  if (scratchpadDiv.innerHTML !== '') {

    // Render mermaid diagrams
    const mermaidElements = scratchpadDiv.querySelectorAll('.mermaid');
    if (mermaidElements.length > 0) {
      console.log(`Found ${mermaidElements.length} mermaid diagram(s) to render`);

      // Log each mermaid element's content before rendering
      mermaidElements.forEach((element, index) => {
        console.log(`Mermaid diagram ${index + 1} content:`, element.textContent);
      });

      try {
        console.log('Calling mermaid.run()...');
        await mermaid.run({
          nodes: Array.from(mermaidElements) as HTMLElement[],
          suppressErrors: true,
        });
        console.log('Mermaid rendering completed successfully');
      } catch (error) {
        console.error('Failed to render mermaid diagrams:', error);
        if (error instanceof Error) {
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
        }
      }
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

    // Initialize Grid.js tables
    const tableWrappers = scratchpadDiv.querySelectorAll('.gridjs-wrapper');
    const hasTable = tableWrappers.length > 0;

    tableWrappers.forEach((wrapper) => {
      const tableData = wrapper.getAttribute('data-table');
      if (tableData) {
        try {
          const data = JSON.parse(tableData.replace(/&quot;/g, '"'));
          new Grid({
            columns: data.columns,
            data: data.data,
            search: true,
            sort: true,
            pagination: {
              limit: 10,
            },
          }).render(wrapper as HTMLElement);
        } catch (error) {
          console.error('Failed to render Grid.js table:', error);
        }
      }
    });

    // Add event listeners for row movement buttons
    attachRowControlListeners();

    // If we have tables, wait for Grid.js to finish DOM manipulation
    if (hasTable) {
      // Grid.js needs time to render search, pagination, and all table elements
      // Wait 1.5 seconds to ensure everything is fully rendered
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 1500);
      });
    }
  }

  // Scroll to bottom after all content is fully rendered (including Grid.js tables)
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
      const skillId = (button as HTMLElement).getAttribute('data-skill-id');
      if (skillId) {
        moveRowUp(skillId);
      }
    });
  });

  downButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const skillId = (button as HTMLElement).getAttribute('data-skill-id');
      if (skillId) {
        moveRowDown(skillId);
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

// Generate unique skill ID
function generateSkillId(): string {
  return `skill-${nextSkillId++}`;
}

// Create a new skill and add it to a new row
export function createSkill(type: SkillType, content: string, altText?: string): string {
  const skill: Skill = {
    id: generateSkillId(),
    type,
    content,
    altText,
  };

  const row: Row = {
    rowNumber: nextRowNumber++,
    skill,
  };

  rows.push(row);
  updateScratchpadUI();
  showToast(`${type} skill created`);

  return `Skill created: ${skill.id} in row ${row.rowNumber}`;
}

// Read a specific skill by ID
export function readSkill(skillId: string): string {
  const row = rows.find(r => r.skill.id === skillId);

  if (!row) {
    return `Skill ${skillId} not found`;
  }

  const { skill } = row;
  return JSON.stringify({
    skillId: skill.id,
    rowNumber: row.rowNumber,
    type: skill.type,
    content: skill.content,
    altText: skill.altText,
  }, null, 2);
}

// Read all skills
export function readAllSkills(): string {
  if (rows.length === 0) {
    return 'The scratchpad is empty. No skills.';
  }

  const summary = rows.map(row => {
    const shortDescription = generateShortDescription(row.skill);
    return {
      row: row.rowNumber,
      skillId: row.skill.id,
      type: row.skill.type,
      description: shortDescription,
      contentLength: row.skill.content.length,
    };
  });

  return JSON.stringify(summary, null, 2);
}

// Update an existing skill
export function updateSkill(skillId: string, content: string, altText?: string): string {
  const row = rows.find(r => r.skill.id === skillId);

  if (!row) {
    return `Skill ${skillId} not found`;
  }

  row.skill.content = content;
  if (altText !== undefined) {
    row.skill.altText = altText;
  }

  updateScratchpadUI();
  showToast(`Skill ${skillId} updated`);

  return `Skill ${skillId} updated successfully`;
}

// Delete a skill by ID
export function deleteSkill(skillId: string): string {
  const index = rows.findIndex(r => r.skill.id === skillId);

  if (index === -1) {
    return `Skill ${skillId} not found`;
  }

  const rowNumber = rows[index].rowNumber;
  rows.splice(index, 1);

  updateScratchpadUI();
  showToast(`Skill ${skillId} deleted`);

  return `Skill ${skillId} (was in row ${rowNumber}) deleted successfully`;
}

// Clear all skills
export function clearScratchpad(): string {
  rows = [];
  nextSkillId = 1;
  nextRowNumber = 1;
  updateScratchpadUI();
  showToast('Scratchpad cleared');
  return 'Scratchpad has been cleared successfully.';
}

// Reset scratchpad without toast (for internal use)
export function resetScratchpad(): void {
  rows = [];
  nextSkillId = 1;
  nextRowNumber = 1;
  updateScratchpadUI();
}

// Get image as base64 (for AI to "look" at images)
export async function getImageBase64(skillId: string): Promise<string> {
  const row = rows.find(r => r.skill.id === skillId);

  if (!row) {
    return `Skill ${skillId} not found`;
  }

  const { skill } = row;
  const handler = getSkillHandler(skill.type);

  if (!handler.getBase64) {
    return `Skill ${skillId} does not support base64 conversion (type: ${skill.type})`;
  }

  try {
    const result = await handler.getBase64(skill);
    return JSON.stringify(result, null, 2);
  } catch (error) {
    return `Error getting base64 for skill ${skillId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Set image display size
export function setImageSize(skillId: string, sizePercentage: number): string {
  const row = rows.find(r => r.skill.id === skillId);

  if (!row) {
    return `Skill ${skillId} not found`;
  }

  const { skill } = row;
  const handler = getSkillHandler(skill.type);

  if (!handler.canResize) {
    return `Skill ${skillId} does not support resizing (type: ${skill.type})`;
  }

  // Validate size percentage (min 10%, max 500%)
  if (sizePercentage < 10 || sizePercentage > 500) {
    return `Invalid size percentage: ${sizePercentage}. Must be between 10 and 500.`;
  }

  skill.displaySize = sizePercentage;
  updateScratchpadUI();
  showToast(`Image size set to ${sizePercentage}%`);

  return `Skill ${skillId} display size set to ${sizePercentage}%`;
}

// Move a row up (swap with previous row)
export function moveRowUp(skillId: string): string {
  const index = rows.findIndex(r => r.skill.id === skillId);

  if (index === -1) {
    return `Skill ${skillId} not found`;
  }

  if (index === 0) {
    return `Skill ${skillId} is already at the top`;
  }

  // Swap with previous row
  [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];

  // Update row numbers
  rows[index - 1].rowNumber = index;
  rows[index].rowNumber = index + 1;

  updateScratchpadUI();
  showToast(`Moved ${skillId} up`);

  return `Skill ${skillId} moved up`;
}

// Move a row down (swap with next row)
export function moveRowDown(skillId: string): string {
  const index = rows.findIndex(r => r.skill.id === skillId);

  if (index === -1) {
    return `Skill ${skillId} not found`;
  }

  if (index === rows.length - 1) {
    return `Skill ${skillId} is already at the bottom`;
  }

  // Swap with next row
  [rows[index], rows[index + 1]] = [rows[index + 1], rows[index]];

  // Update row numbers
  rows[index].rowNumber = index + 1;
  rows[index + 1].rowNumber = index + 2;

  updateScratchpadUI();
  showToast(`Moved ${skillId} down`);

  return `Skill ${skillId} moved down`;
}

// Scroll to a specific skill/row
export function scrollToSkill(skillId: string): string {
  const row = rows.find(r => r.skill.id === skillId);

  if (!row) {
    return `Skill ${skillId} not found`;
  }

  // Find the DOM element for this row
  const rowElement = document.querySelector(`[data-skill-id="${skillId}"]`) as HTMLElement;

  if (!rowElement) {
    return `Row element for skill ${skillId} not found in DOM`;
  }

  // Scroll the row into view with smooth animation
  rowElement.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  // Add a temporary highlight effect
  rowElement.classList.add('row-highlight');
  setTimeout(() => {
    rowElement.classList.remove('row-highlight');
  }, 2000);

  showToast(`Scrolled to ${skillId}`);
  return `Scrolled to skill ${skillId} in row ${row.rowNumber}`;
}

// Enter fullscreen mode for a specific skill
export function enterFullscreenSkill(skillId: string): string {
  const row = rows.find(r => r.skill.id === skillId);

  if (!row) {
    return `Skill ${skillId} not found`;
  }

  fullscreenSkillId = skillId;
  updateScratchpadUI();
  showToast(`${skillId} in fullscreen (press ESC to exit)`);

  return `Skill ${skillId} is now displayed in fullscreen mode`;
}

// Exit fullscreen mode
export function exitFullscreenSkill(): string {
  if (!fullscreenSkillId) {
    return 'Not currently in fullscreen mode';
  }

  const previousSkillId = fullscreenSkillId;
  fullscreenSkillId = null;
  updateScratchpadUI();
  showToast('Exited fullscreen mode');

  return `Exited fullscreen mode for ${previousSkillId}`;
}

// Expose exitFullscreenSkill globally for button onclick
(window as any).exitFullscreenSkill = exitFullscreenSkill;

// Download scratchpad as markdown
export function downloadScratchpadAsMarkdown(): void {
  if (rows.length === 0) {
    showToast('Scratchpad is empty - nothing to download');
    return;
  }

  // Build markdown content
  let markdown = '# AI Magicboard Scratchpad\n\n';
  markdown += `*Downloaded on ${new Date().toLocaleString()}*\n\n`;
  markdown += '---\n\n';

  // Iterate through all rows and get markdown content
  rows.forEach((row, index) => {
    const handler = getSkillHandler(row.skill.type);
    const skillMarkdown = handler.getContentAsMarkdown(row.skill);

    // Add row header
    markdown += `## Row ${row.rowNumber}: ${row.skill.id} [${row.skill.type}]\n\n`;

    // Add the skill content as markdown
    markdown += skillMarkdown + '\n\n';

    // Add separator between rows (except for last row)
    if (index < rows.length - 1) {
      markdown += '---\n\n';
    }
  });

  // Create a blob and download link
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  link.href = url;
  link.download = `magicboard-${timestamp}.md`;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('Markdown file downloaded');
}

// Export tools and instructions for main.ts
export function getScratchpadTools() {
  // Create API for skills
  const api = {
    getSkillById: (skillId: string) => {
      const row = rows.find(r => r.skill.id === skillId);
      return row?.skill;
    },
    updateUI: () => updateScratchpadUI(),
    showToast: (message: string) => showToast(message),
  };

  // Scratchpad functions for general tools
  const scratchpadFunctions = {
    createSkill,
    readSkill,
    readAllSkills,
    updateSkill,
    deleteSkill,
    moveRowUp,
    moveRowDown,
    clearScratchpad,
    scrollToSkill,
    enterFullscreenSkill,
    exitFullscreenSkill,
  };

  const tools = getAllTools(api, scratchpadFunctions);
  const instructions = getAllInstructions();

  return { tools, instructions };
}
