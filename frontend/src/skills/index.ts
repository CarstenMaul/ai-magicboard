import { SkillHandler, SkillType, ScratchpadAPI, ToolDefinition } from './types';
import { markdownSkill } from './markdown';
import { mermaidSkill } from './mermaid';
import { imageSkill } from './image';
import { tableSkill } from './table';
import { outlinerSkill } from './outliner';
import { getGeneralTools, getGeneralInstructions } from './general-tools';

export * from './types';

// Registry of all available skills
export const skillRegistry: Map<SkillType, SkillHandler> = new Map([
  ['markdown', markdownSkill],
  ['mermaid', mermaidSkill],
  ['image', imageSkill],
  ['table', tableSkill],
  ['outliner', outlinerSkill],
]);

// Get skill handler by type
export function getSkillHandler(type: SkillType): SkillHandler {
  const handler = skillRegistry.get(type);
  if (!handler) {
    throw new Error(`Unknown skill type: ${type}`);
  }
  return handler;
}

// Collect all tools from all skills
export function getAllTools(api: ScratchpadAPI, scratchpadFunctions: any): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  // Add general scratchpad tools
  tools.push(...getGeneralTools(scratchpadFunctions));

  // Collect tools from each skill
  for (const [_, handler] of skillRegistry) {
    if (handler.getTools) {
      tools.push(...handler.getTools(api));
    }
  }

  return tools;
}

// Collect all instructions from all skills
export function getAllInstructions(): string {
  let instructions = getGeneralInstructions();

  // Collect instructions from each skill
  for (const [_, handler] of skillRegistry) {
    if (handler.getInstructions) {
      instructions += '\n' + handler.getInstructions();
    }
  }

  instructions += `\n
Each row displays:
- Row number (e.g., "Row 1")
- Skill ID with type (e.g., "skill-1 [image-url]")
- Short content description
- Up/Down buttons to reorder rows

Use the scratchpad to:
- Take notes about important information from the conversation
- Create todo lists or structured outlines
- Keep track of context across multiple topics
- Organize your thoughts when solving complex problems
- Create visual diagrams using Mermaid (use type='mermaid' for diagrams)
- Display images from URLs to show visual content to the user
- Update or delete specific skills using their skill IDs

Mermaid diagram example (use create_skill with type='mermaid'):
\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\``;

  return instructions;
}
