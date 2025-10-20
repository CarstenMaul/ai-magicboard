// Skill types
export type SkillType = 'markdown' | 'mermaid' | 'image-url' | 'image-base64';

// Skill interface
export interface Skill {
  id: string;
  type: SkillType;
  content: string;
  altText?: string;
  displaySize?: number;
}

// Tool definition interface
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
  execute: (input: any) => Promise<any>;
}

// Scratchpad API that skills can use
export interface ScratchpadAPI {
  getSkillById: (skillId: string) => Skill | undefined;
  updateUI: () => void;
  showToast: (message: string) => void;
}

// Base skill handler interface
export interface SkillHandler {
  type: SkillType;
  render: (skill: Skill) => Promise<string>;
  generateDescription: (skill: Skill) => string;
  canResize?: boolean;
  getBase64?: (skill: Skill) => Promise<{ skillId: string; type: string; mimeType: string; base64Data: string; altText?: string; [key: string]: any }>;
  getTools?: (api: ScratchpadAPI) => ToolDefinition[];
  getInstructions?: () => string;
}
