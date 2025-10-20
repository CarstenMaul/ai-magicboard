import { ToolDefinition, ScratchpadAPI } from './types';

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
  },
  api: ScratchpadAPI,
  getSkillHandler: (type: any) => any
): ToolDefinition[] {
  return [
    {
      name: 'create_skill',
      description: 'Creates a new skill in a new row. Skill types: "markdown" for text/markdown content, "mermaid" for Mermaid diagrams, "image-url" for images from URL, "image-base64" for base64-encoded images.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['markdown', 'mermaid', 'image-url', 'image-base64'],
            description: 'The type of skill: "markdown", "mermaid", "image-url", or "image-base64"',
          },
          content: {
            type: 'string',
            description: 'For markdown/mermaid: the text content. For image-url: the URL. For image-base64: the data URI (data:image/png;base64,...)',
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
    {
      name: 'get_image_base64',
      description: 'Gets an image skill (image-url or image-base64) as base64-encoded data so you can "look at" and analyze it. For image-url skills, fetches and optimizes to JPEG (70% quality, max 800x800px). For image-base64 skills, returns existing data.',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The skill ID of the image to view (e.g., "skill-1")',
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
        if (skill.type !== 'image-url' && skill.type !== 'image-base64') {
          return `Skill ${input.skill_id} is not an image skill (type: ${skill.type})`;
        }
        try {
          const handler = getSkillHandler(skill.type);
          if (!handler.getBase64) {
            return `Skill ${input.skill_id} does not support base64 conversion`;
          }
          const result = await handler.getBase64(skill);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          return `Error getting base64: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
    },
    {
      name: 'set_image_size',
      description: 'Sets the display size of an image skill (image-url or image-base64) as a percentage. Does not re-encode the image, only changes how it is displayed. 100 = original size, 50 = half size, 200 = double size.',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The skill ID of the image to resize (e.g., "skill-1")',
          },
          size_percentage: {
            type: 'number',
            description: 'The display size as a percentage (10-500). Examples: 50 = half size, 100 = original, 200 = double',
          },
        },
        required: ['skill_id', 'size_percentage'],
        additionalProperties: true,
      },
      execute: async (input: any) => {
        const skill = api.getSkillById(input.skill_id);
        if (!skill) {
          return `Skill ${input.skill_id} not found`;
        }
        const handler = getSkillHandler(skill.type);
        if (!handler.canResize) {
          return `Skill ${input.skill_id} does not support resizing (type: ${skill.type})`;
        }
        if (input.size_percentage < 10 || input.size_percentage > 500) {
          return `Invalid size percentage: ${input.size_percentage}. Must be between 10 and 500.`;
        }
        skill.displaySize = input.size_percentage;
        api.updateUI();
        api.showToast(`Image size set to ${input.size_percentage}%`);
        return `Skill ${input.skill_id} display size set to ${input.size_percentage}%`;
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
