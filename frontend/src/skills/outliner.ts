import { Skill, SkillHandler, ScratchpadAPI, ToolDefinition } from './types';

// Outline item structure
export interface OutlineItem {
  id: string;
  text: string;
  collapsed?: boolean;
  children?: OutlineItem[];
}

// Parse outline content
function parseOutline(content: string): OutlineItem[] {
  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Generate HTML for outline items recursively
function renderOutlineItems(items: OutlineItem[], level: number = 0): string {
  if (!items || items.length === 0) return '';

  return items.map(item => {
    const hasChildren = item.children && item.children.length > 0;
    const isCollapsed = item.collapsed && hasChildren;
    const toggleIcon = hasChildren
      ? `<span class="outline-toggle" data-id="${item.id}">${isCollapsed ? '▶' : '▼'}</span>`
      : '<span class="outline-bullet">•</span>';

    const childrenHtml = hasChildren
      ? `<div class="outline-children" style="display: ${isCollapsed ? 'none' : 'block'};">${renderOutlineItems(item.children!, level + 1)}</div>`
      : '';

    return `
      <div class="outline-item" data-level="${level}" data-id="${item.id}">
        <div class="outline-header">
          ${toggleIcon}
          <span class="outline-text">${item.text}</span>
        </div>
        ${childrenHtml}
      </div>
    `;
  }).join('');
}

// Find an item by ID in the tree
function findItem(items: OutlineItem[], id: string): OutlineItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItem(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Remove an item from the tree
function removeItem(items: OutlineItem[], id: string): boolean {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) {
      items.splice(i, 1);
      return true;
    }
    if (items[i].children && removeItem(items[i].children!, id)) {
      return true;
    }
  }
  return false;
}

// Generate a unique ID
function generateId(): string {
  return 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Attach event listeners to outline toggle buttons (called after rendering)
export function attachOutlineToggleListeners(): void {
  const toggleButtons = document.querySelectorAll('.outline-toggle');

  toggleButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const itemId = (button as HTMLElement).getAttribute('data-id');
      if (!itemId) return;

      // Find the outline item
      const itemElement = document.querySelector(`.outline-item[data-id="${itemId}"]`);
      if (!itemElement) return;

      // Toggle children visibility
      const childrenContainer = itemElement.querySelector('.outline-children');
      if (!childrenContainer) return;

      const isCurrentlyHidden = (childrenContainer as HTMLElement).style.display === 'none';
      (childrenContainer as HTMLElement).style.display = isCurrentlyHidden ? 'block' : 'none';

      // Toggle arrow icon
      button.textContent = isCurrentlyHidden ? '▼' : '▶';
    });
  });
}

export const outlinerSkill: SkillHandler = {
  type: 'outliner',

  render: async (skill: Skill): Promise<string> => {
    const items = parseOutline(skill.content);

    return `
      <div class="skill-content outliner-skill" data-skill-id="${skill.id}">
        <div class="outline-container">
          ${items.length > 0 ? renderOutlineItems(items) : '<div class="outline-empty">Empty outline</div>'}
        </div>
      </div>
    `;
  },

  generateDescription: (skill: Skill): string => {
    const items = parseOutline(skill.content);
    const countItems = (items: OutlineItem[]): number => {
      return items.reduce((count, item) => {
        return count + 1 + (item.children ? countItems(item.children) : 0);
      }, 0);
    };
    const total = countItems(items);
    return `Outline with ${total} item${total !== 1 ? 's' : ''}`;
  },

  getContentAsMarkdown: (skill: Skill): string => {
    const items = parseOutline(skill.content);

    const renderMarkdown = (items: OutlineItem[], level: number = 0): string => {
      return items.map(item => {
        const indent = '  '.repeat(level);
        const children = item.children ? '\n' + renderMarkdown(item.children, level + 1) : '';
        return `${indent}- ${item.text}${children}`;
      }).join('\n');
    };

    return renderMarkdown(items);
  },

  getTools: (api: ScratchpadAPI): ToolDefinition[] => {
    return [
      {
        name: 'add_outline_item',
        description: 'Adds a new item to an outliner skill. Can add at root level or as a child of an existing item.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the outliner (e.g., "skill-1")',
            },
            text: {
              type: 'string',
              description: 'The text content of the outline item',
            },
            parent_id: {
              type: 'string',
              description: 'Optional parent item ID. If provided, adds as a child. If omitted, adds to root level.',
            },
          },
          required: ['skill_id', 'text'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'outliner') {
            return `Skill ${input.skill_id} is not an outliner skill (type: ${skill.type})`;
          }

          const items = parseOutline(skill.content);
          const newItem: OutlineItem = {
            id: generateId(),
            text: input.text,
            children: [],
          };

          if (input.parent_id) {
            // Add as child
            const parent = findItem(items, input.parent_id);
            if (!parent) {
              return `Parent item ${input.parent_id} not found`;
            }
            if (!parent.children) {
              parent.children = [];
            }
            parent.children.push(newItem);
          } else {
            // Add to root
            items.push(newItem);
          }

          skill.content = JSON.stringify(items);
          api.updateUI();
          api.showToast(`Item added: ${input.text}`);
          return `Item "${input.text}" added with ID ${newItem.id}`;
        },
      },
      {
        name: 'update_outline_item',
        description: 'Updates the text of an existing outline item.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the outliner',
            },
            item_id: {
              type: 'string',
              description: 'The ID of the item to update',
            },
            text: {
              type: 'string',
              description: 'The new text content',
            },
          },
          required: ['skill_id', 'item_id', 'text'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'outliner') {
            return `Skill ${input.skill_id} is not an outliner skill`;
          }

          const items = parseOutline(skill.content);
          const item = findItem(items, input.item_id);
          if (!item) {
            return `Item ${input.item_id} not found`;
          }

          item.text = input.text;
          skill.content = JSON.stringify(items);
          api.updateUI();
          api.showToast('Item updated');
          return `Item ${input.item_id} updated`;
        },
      },
      {
        name: 'delete_outline_item',
        description: 'Deletes an outline item and all its children.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the outliner',
            },
            item_id: {
              type: 'string',
              description: 'The ID of the item to delete',
            },
          },
          required: ['skill_id', 'item_id'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'outliner') {
            return `Skill ${input.skill_id} is not an outliner skill`;
          }

          const items = parseOutline(skill.content);
          if (!removeItem(items, input.item_id)) {
            return `Item ${input.item_id} not found`;
          }

          skill.content = JSON.stringify(items);
          api.updateUI();
          api.showToast('Item deleted');
          return `Item ${input.item_id} deleted`;
        },
      },
      {
        name: 'toggle_outline_item',
        description: 'Toggles the collapsed/expanded state of an outline item that has children.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the outliner',
            },
            item_id: {
              type: 'string',
              description: 'The ID of the item to toggle',
            },
          },
          required: ['skill_id', 'item_id'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'outliner') {
            return `Skill ${input.skill_id} is not an outliner skill`;
          }

          const items = parseOutline(skill.content);
          const item = findItem(items, input.item_id);
          if (!item) {
            return `Item ${input.item_id} not found`;
          }

          if (!item.children || item.children.length === 0) {
            return `Item ${input.item_id} has no children to collapse`;
          }

          item.collapsed = !item.collapsed;
          skill.content = JSON.stringify(items);
          api.updateUI();
          const state = item.collapsed ? 'collapsed' : 'expanded';
          api.showToast(`Item ${state}`);
          return `Item ${input.item_id} ${state}`;
        },
      },
      {
        name: 'read_outline',
        description: 'Reads the entire outline structure with all item IDs and text.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the outliner',
            },
          },
          required: ['skill_id'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'outliner') {
            return `Skill ${input.skill_id} is not an outliner skill`;
          }

          const items = parseOutline(skill.content);

          const formatItem = (item: OutlineItem, level: number = 0): string => {
            const indent = '  '.repeat(level);
            let result = `${indent}- [${item.id}] ${item.text}`;
            if (item.children && item.children.length > 0) {
              result += ` (${item.children.length} children)`;
              if (item.collapsed) {
                result += ' [collapsed]';
              }
              result += '\n' + item.children.map(child => formatItem(child, level + 1)).join('\n');
            }
            return result;
          };

          return items.map(item => formatItem(item)).join('\n');
        },
      },
    ];
  },

  getImage: async (skill: Skill, imageIndex: number = 1): Promise<string> => {
    const items = parseOutline(skill.content);
    const countItems = (items: OutlineItem[]): number => {
      return items.reduce((count, item) => {
        return count + 1 + (item.children ? countItems(item.children) : 0);
      }, 0);
    };
    const total = countItems(items);
    return `Outliner skills do not provide images for visual analysis. This is a hierarchical outline structure with ${total} item${total !== 1 ? 's' : ''}. Use read_outline to read the outline content instead.`;
  },

  getInstructions: (): string => {
    return `- 'outliner': Hierarchical, collapsible outlines for organizing information
  * Create with create_skill(type='outliner', content='[]')
  * Items have unique IDs, text content, and can have children
  * Add items at root level or as children of existing items
  * Items with children can be collapsed/expanded
  * Use read_outline to see all item IDs before updating/deleting

  Tools:
  * add_outline_item: Add new item (with optional parent_id)
  * update_outline_item: Change item text
  * delete_outline_item: Remove item and all children
  * toggle_outline_item: Collapse/expand items with children
  * read_outline: View entire structure with IDs`;
  },
};
