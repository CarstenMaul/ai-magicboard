import { ToolDefinition } from './types';

// General scratchpad tools that aren't skill-specific
export function getGeneralTools(
  scratchpadFunctions: {
    createSkill: (type: any, content: string, altText?: string) => string;
    readSkill: (skillId: string) => string;
    readAllSkills: () => string;
    updateSkill: (skillId: string, content: string, altText?: string) => string;
    deleteSkill: (skillId: string) => string;
    moveRowUp: (skillId: string) => string;
    moveRowDown: (skillId: string) => string;
    clearScratchpad: () => string;
  }
): ToolDefinition[] {
  return [
    {
      name: 'create_skill',
      description: 'Creates a new skill in a new row. Skill types: "markdown" for text/markdown content, "mermaid" for Mermaid diagrams, "image" for images from URL or base64 data URI, "table" for interactive data tables.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['markdown', 'mermaid', 'image', 'table'],
            description: 'The type of skill: "markdown", "mermaid", "image", or "table"',
          },
          content: {
            type: 'string',
            description: 'For markdown/mermaid: the text content. For image: a URL or data URI. For table: JSON string from create_table tool',
          },
          alt_text: {
            type: 'string',
            description: 'Optional alt text for images',
          },
        },
        required: ['type', 'content'],
        additionalProperties: true,
      },
      execute: async (input: any) => {
        return scratchpadFunctions.createSkill(input.type, input.content, input.alt_text);
      },
    },
    {
      name: 'read_skill',
      description: 'Reads a specific skill by its skill ID. Returns the skill details including row number, type, and content.',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The skill ID (e.g., "skill-1")',
          },
        },
        required: ['skill_id'],
        additionalProperties: true,
      },
      execute: async (input: any) => {
        return scratchpadFunctions.readSkill(input.skill_id);
      },
    },
    {
      name: 'read_all_skills',
      description: 'Lists all skills in the scratchpad with their row numbers, skill IDs, types, and content previews.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: true,
      },
      execute: async () => {
        return scratchpadFunctions.readAllSkills();
      },
    },
    {
      name: 'update_skill',
      description: 'Updates an existing skill\'s content by its skill ID.',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The skill ID to update (e.g., "skill-1")',
          },
          content: {
            type: 'string',
            description: 'The new content for the skill',
          },
          alt_text: {
            type: 'string',
            description: 'Optional new alt text for image skills',
          },
        },
        required: ['skill_id', 'content'],
        additionalProperties: true,
      },
      execute: async (input: any) => {
        return scratchpadFunctions.updateSkill(input.skill_id, input.content, input.alt_text);
      },
    },
    {
      name: 'delete_skill',
      description: 'Deletes a skill by its skill ID.',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The skill ID to delete (e.g., "skill-1")',
          },
        },
        required: ['skill_id'],
        additionalProperties: true,
      },
      execute: async (input: any) => {
        return scratchpadFunctions.deleteSkill(input.skill_id);
      },
    },
    {
      name: 'move_row_up',
      description: 'Moves a skill up one position (swaps with the row above it).',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The skill ID to move up (e.g., "skill-1")',
          },
        },
        required: ['skill_id'],
        additionalProperties: true,
      },
      execute: async (input: any) => {
        return scratchpadFunctions.moveRowUp(input.skill_id);
      },
    },
    {
      name: 'move_row_down',
      description: 'Moves a skill down one position (swaps with the row below it).',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The skill ID to move down (e.g., "skill-1")',
          },
        },
        required: ['skill_id'],
        additionalProperties: true,
      },
      execute: async (input: any) => {
        return scratchpadFunctions.moveRowDown(input.skill_id);
      },
    },
    {
      name: 'clear_scratchpad',
      description: 'Clears all content from the scratchpad',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: true,
      },
      execute: async () => {
        return scratchpadFunctions.clearScratchpad();
      },
    },
  ];
}

export function getGeneralInstructions(): string {
  return `**Scratchpad Skill Tools:**
The scratchpad uses a row-based layout where each skill is displayed in its own row with a unique skill ID.

- create_skill: Creates a new skill in a new row
- read_skill: Reads a specific skill by skill ID
- read_all_skills: Lists all skills with their IDs, row numbers, types, and descriptions
- update_skill: Updates an existing skill's content by skill ID
- delete_skill: Deletes a skill by skill ID
- move_row_up: Moves a skill up one position (swaps with the row above)
- move_row_down: Moves a skill down one position (swaps with the row below)
- clear_scratchpad: Clears all skills from the scratchpad

**Skill Types:**`;
}
