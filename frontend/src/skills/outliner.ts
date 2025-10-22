import { Skill, SkillHandler, ScratchpadAPI, ToolDefinition } from './types';

// Outline item structure
export interface OutlineItem {
  id: string;
  text: string;
  collapsed?: boolean;
  children?: OutlineItem[];
  _animation?: 'enter' | 'exit'; // Animation state marker for add/delete
  _collapseAnimation?: 'collapsing' | 'expanding'; // Animation state marker for collapse/expand
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

    // Determine children display and animation
    let childrenDisplay = 'block';
    let childrenAnimationClass = '';

    if (hasChildren) {
      if (item._collapseAnimation === 'collapsing') {
        childrenDisplay = 'block'; // Show so it can animate to hidden
        childrenAnimationClass = 'outline-children-collapsing';
      } else if (item._collapseAnimation === 'expanding') {
        childrenDisplay = 'block'; // Show during expand animation
        childrenAnimationClass = 'outline-children-expanding';
      } else {
        childrenDisplay = isCollapsed ? 'none' : 'block';
      }
    }

    const childrenHtml = hasChildren
      ? `<div class="outline-children ${childrenAnimationClass}" style="display: ${childrenDisplay};">${renderOutlineItems(item.children!, level + 1)}</div>`
      : '';

    // Add animation class if item is animating
    const animationClass = item._animation === 'enter' ? 'outline-item-entering'
                         : item._animation === 'exit' ? 'outline-item-exiting'
                         : '';

    return `
      <div class="outline-item ${animationClass}" data-level="${level}" data-id="${item.id}">
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

// Animation cleanup helper - removes animation markers after animation completes
function cleanupAnimation(skillId: string, itemId: string, api: ScratchpadAPI, shouldRemove: boolean = false): void {
  setTimeout(() => {
    const skill = api.getSkillById(skillId);
    if (!skill || skill.type !== 'outliner') return;

    const items = parseOutline(skill.content);
    const item = findItem(items, itemId);

    if (shouldRemove) {
      // Actually remove the item after exit animation
      removeItem(items, itemId);
      skill.content = JSON.stringify(items);
      api.notifyContentUpdated(skillId);
    } else if (item && item._animation) {
      // Just remove the animation marker after enter animation
      delete item._animation;
      skill.content = JSON.stringify(items);
      api.notifyContentUpdated(skillId);
    }
  }, 400); // Match animation duration
}

// Collapse/expand animation cleanup helper
function cleanupCollapseAnimation(skillId: string, itemId: string, api: ScratchpadAPI): void {
  setTimeout(() => {
    const skill = api.getSkillById(skillId);
    if (!skill || skill.type !== 'outliner') return;

    const items = parseOutline(skill.content);
    const item = findItem(items, itemId);

    if (item && item._collapseAnimation) {
      // Remove the animation marker after collapse/expand animation
      delete item._collapseAnimation;
      skill.content = JSON.stringify(items);
      api.notifyContentUpdated(skillId);
    }
  }, 300); // Match collapse/expand animation duration
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
            _animation: 'enter', // Mark for enter animation
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
          api.notifyContentUpdated(input.skill_id);

          // Clean up animation marker after animation completes
          cleanupAnimation(input.skill_id, newItem.id, api, false);

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
          api.notifyContentUpdated(input.skill_id);
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
          const item = findItem(items, input.item_id);
          if (!item) {
            return `Item ${input.item_id} not found`;
          }

          // Mark item for exit animation
          item._animation = 'exit';
          skill.content = JSON.stringify(items);
          api.notifyContentUpdated(input.skill_id);

          // Actually remove the item after animation completes
          cleanupAnimation(input.skill_id, input.item_id, api, true);

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
          api.notifyContentUpdated(input.skill_id);
          const state = item.collapsed ? 'collapsed' : 'expanded';
          api.showToast(`Item ${state}`);
          return `Item ${input.item_id} ${state}`;
        },
      },
      {
        name: 'collapse_outline_item',
        description: 'Collapses an outline item with children, hiding its children with animation.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the outliner',
            },
            item_id: {
              type: 'string',
              description: 'The ID of the item to collapse',
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

          if (item.collapsed) {
            return `Item ${input.item_id} is already collapsed`;
          }

          // Mark for collapsing animation
          item._collapseAnimation = 'collapsing';
          skill.content = JSON.stringify(items);
          api.notifyContentUpdated(input.skill_id);

          // After animation, set collapsed state and clean up marker
          setTimeout(() => {
            const skillAfter = api.getSkillById(input.skill_id);
            if (!skillAfter || skillAfter.type !== 'outliner') return;

            const itemsAfter = parseOutline(skillAfter.content);
            const itemAfter = findItem(itemsAfter, input.item_id);
            if (itemAfter) {
              itemAfter.collapsed = true;
              delete itemAfter._collapseAnimation;
              skillAfter.content = JSON.stringify(itemsAfter);
              api.notifyContentUpdated(input.skill_id);
            }
          }, 300);

          api.showToast(`Item collapsed`);
          return `Item ${input.item_id} collapsed`;
        },
      },
      {
        name: 'expand_outline_item',
        description: 'Expands a collapsed outline item, showing its children with animation.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the outliner',
            },
            item_id: {
              type: 'string',
              description: 'The ID of the item to expand',
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
            return `Item ${input.item_id} has no children to expand`;
          }

          if (!item.collapsed) {
            return `Item ${input.item_id} is already expanded`;
          }

          // Set expanded state and mark for expanding animation
          item.collapsed = false;
          item._collapseAnimation = 'expanding';
          skill.content = JSON.stringify(items);
          api.notifyContentUpdated(input.skill_id);

          // After animation, clean up marker
          cleanupCollapseAnimation(input.skill_id, input.item_id, api);

          api.showToast(`Item expanded`);
          return `Item ${input.item_id} expanded`;
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

  getImage: async (skill: Skill, _imageIndex: number = 1): Promise<string> => {
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
  * Items with children can be collapsed/expanded with smooth animations
  * Use read_outline to see all item IDs before updating/deleting

  Tools:
  * add_outline_item: Add new item (with optional parent_id) - slides in from left
  * update_outline_item: Change item text
  * delete_outline_item: Remove item and all children - slides out to right
  * collapse_outline_item: Collapse item to hide children - slides up with animation
  * expand_outline_item: Expand item to show children - slides down with animation
  * toggle_outline_item: Toggle collapsed/expanded state (no animation control)
  * read_outline: View entire structure with IDs

  Animations:
  * Adding items: Slide in from left (400ms)
  * Deleting items: Slide out to right (400ms)
  * Collapsing: Children slide up and fade out (300ms)
  * Expanding: Children slide down and fade in (300ms)`;
  },
};
