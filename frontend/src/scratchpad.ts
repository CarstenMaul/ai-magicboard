import mermaid from 'mermaid';
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
  };

  const tools = getAllTools(api, scratchpadFunctions);
  const instructions = getAllInstructions();

  return { tools, instructions };
}
