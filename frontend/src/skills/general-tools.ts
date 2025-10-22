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
    scrollToSkill: (skillId: string) => string;
    enterFullscreenSkill: (identifier: string | number) => string;
    exitFullscreenSkill: () => string;
  },
  api?: ScratchpadAPI
): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    {
      name: 'create_skill',
      description: 'Creates a new skill in a new row. Skill types: "markdown" for text/markdown content, "mermaid" for Mermaid diagrams, "image" for images from URL or base64 data URI, "table" for interactive data tables, "chart" for Chart.js visualizations.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['markdown', 'mermaid', 'image', 'table', 'chart'],
            description: 'The type of skill: "markdown", "mermaid", "image", "table", or "chart"',
          },
          content: {
            type: 'string',
            description: 'For markdown/mermaid: the text content. For image: a URL or data URI. For table: JSON string from create_table tool. For chart: JSON string from create_chart tool',
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
      name: 'scroll_to_row',
      description: 'Scrolls the viewport to bring a specific skill/row into view and highlights it temporarily. Useful for directing the user\'s attention to a particular skill.',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The skill ID to scroll to (e.g., "skill-1")',
          },
        },
        required: ['skill_id'],
        additionalProperties: true,
      },
      execute: async (input: any) => {
        return scratchpadFunctions.scrollToSkill(input.skill_id);
      },
    },
    {
      name: 'show_fullscreen',
      description: 'Displays a specific skill/row in fullscreen mode, hiding all other content. Great for presentations or focusing on a single skill. User can press ESC to exit. You can specify either a skill ID (e.g., "skill-1") or a row number (e.g., 1, 2, 3).',
      parameters: {
        type: 'object',
        properties: {
          identifier: {
            oneOf: [
              { type: 'string' },
              { type: 'number' }
            ],
            description: 'The skill ID (e.g., "skill-1") or row number (e.g., 1, 2, 3) to display in fullscreen',
          },
        },
        required: ['identifier'],
        additionalProperties: true,
      },
      execute: async (input: any) => {
        return scratchpadFunctions.enterFullscreenSkill(input.identifier);
      },
    },
    {
      name: 'exit_fullscreen',
      description: 'Exits fullscreen mode and returns to normal scratchpad view showing all skills.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: true,
      },
      execute: async () => {
        return scratchpadFunctions.exitFullscreenSkill();
      },
    },
  ];

  // Add data object tools if API is available
  if (api) {
    const dataObjectTools: ToolDefinition[] = [
      {
        name: 'list_data_objects',
        description: 'Lists all registered data objects in the global registry. Shows the names of all data objects that skills can subscribe to.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: true,
        },
        execute: async () => {
          const names = api!.getAllDataObjectNames();
          if (names.length === 0) {
            return 'No data objects registered.';
          }
          return `Registered data objects (${names.length}):\n${names.map(name => `- ${name}`).join('\n')}`;
        },
      },
      {
        name: 'inspect_data_object',
        description: 'Inspects a specific data object to see its details including type, data content, and list of subscribed skill IDs.',
        parameters: {
          type: 'object',
          properties: {
            data_object_name: {
              type: 'string',
              description: 'Name of the data object to inspect',
            },
          },
          required: ['data_object_name'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const info = api!.getDataObjectInfo(input.data_object_name);
          if (!info) {
            return `Data object "${input.data_object_name}" not found.`;
          }

          const result = {
            name: info.name,
            type: info.type,
            subscribers: info.subscribers,
            subscriberCount: info.subscribers.length,
            data: info.data,
          };

          return JSON.stringify(result, null, 2);
        },
      },
    ];

    // Add save_image_to_file tool
    tools.push({
      name: 'save_image_to_file',
      description: 'Saves an image from a skill as a JPEG file to a specified directory. Works with image skills, chart skills, PDF skills, and any skill that can generate images.',
      parameters: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            description: 'The skill ID containing the image to save (e.g., "skill-1")',
          },
          directory: {
            type: 'string',
            description: 'Directory path where the image should be saved (e.g., "/Users/username/Pictures" or "~/Desktop"). Supports ~ for home directory.',
          },
          filename: {
            type: 'string',
            description: 'Optional: Filename for the saved image (e.g., "my_chart.jpg"). If not provided, a timestamped filename will be generated. Extension .jpg will be added if not present.',
          },
          index: {
            type: 'number',
            description: 'Optional: Index for multi-item skills (default: 1). For image galleries: specifies which image (1, 2, 3...). For PDF skills: specifies which page. For chart skills: ignored (always saves the chart).',
            default: 1,
          },
        },
        required: ['skill_id', 'directory'],
        additionalProperties: true,
      },
      execute: async (input: any) => {
        const skill = api!.getSkillById(input.skill_id);
        if (!skill) {
          return `Skill ${input.skill_id} not found`;
        }

        try {
          // Import skill handlers dynamically
          const { getSkillHandler } = await import('./index');
          const handler = getSkillHandler(skill.type);

          if (!handler.getImage) {
            return `Skill ${input.skill_id} (type: ${skill.type}) does not support image generation`;
          }

          // Get image data from the skill
          const imageIndex = input.index || 1;
          const imageResult = await handler.getImage(skill, imageIndex);

          // Handle different return formats
          let base64Data: string;
          if (typeof imageResult === 'string') {
            // If it's a string, it's an error message
            return imageResult;
          } else if (imageResult.type === 'image') {
            // It's an image object {type, data, mediaType}
            base64Data = imageResult.data;
          } else {
            return `Unexpected image format from skill ${input.skill_id}`;
          }

          // Call backend API to save the image
          const response = await fetch('http://localhost:8000/api/save-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image_data: base64Data,
              directory: input.directory,
              filename: input.filename || null,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            return `Failed to save image: ${error.detail || response.statusText}`;
          }

          const result = await response.json();
          return `Image saved successfully to: ${result.path}`;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return `Failed to save image: ${errorMessage}`;
        }
      },
    });

    return [...tools, ...dataObjectTools];
  }

  return tools;
}

export function getGeneralInstructions(): string {
  return `**Scratchpad Skill Tools:**
The scratchpad uses a row-based layout where each skill is displayed in its own row with a unique skill ID.

- create_skill: Creates a new skill in a new row (supports: markdown, mermaid, image, table, chart)
- read_skill: Reads a specific skill by skill ID
- read_all_skills: Lists all skills with their IDs, row numbers, types, and descriptions
- update_skill: Updates an existing skill's content by skill ID
- delete_skill: Deletes a skill by skill ID
- move_row_up: Moves a skill up one position (swaps with the row above)
- move_row_down: Moves a skill down one position (swaps with the row below)
- scroll_to_row: Scrolls to a specific skill/row and highlights it (useful for navigation)
- show_fullscreen: Displays a skill in fullscreen mode using either skill ID or row number (great for presentations or focusing)
- exit_fullscreen: Exits fullscreen mode and returns to normal view
- clear_scratchpad: Clears all skills from the scratchpad
- save_image_to_file: Saves an image from any skill (image, chart, PDF) as a JPEG file to a directory
  * Specify skill_id, directory, and optional filename
  * For image galleries: use index to specify which image (1, 2, 3...)
  * For PDF skills: use index to specify which page
  * For charts: index is ignored (always saves the chart)
  * Example: save_image_to_file(skill_id="skill-1", directory="~/Desktop", filename="my_chart.jpg")

**Data Object Registry Tools:**
- list_data_objects: Lists all registered data objects in the global registry
- inspect_data_object: Inspects a specific data object to see its type, data, and subscribers

**Note:** For show_fullscreen, you can use either:
  - Skill ID: show_fullscreen(identifier="skill-1")
  - Row number: show_fullscreen(identifier=1)

**Skill Types:**`;
}
