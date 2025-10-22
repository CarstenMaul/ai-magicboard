// Skill types
export type SkillType = 'markdown' | 'mermaid' | 'image' | 'table' | 'outliner' | 'pdf';

// Gallery image interface
export interface GalleryImage {
  index: number;
  content: string; // URL for image-url, data URI for image-base64
  altText?: string;
  displaySize?: number; // Percentage (100 = original size)
  displayWidth?: number; // Width in pixels (keeps aspect ratio)
  displayHeight?: number; // Height in pixels (keeps aspect ratio)
  annotation?: string; // Optional annotation text shown below this specific image
}

// Skill interface
export interface Skill {
  id: string;
  type: SkillType;
  content: string;
  altText?: string;
  displaySize?: number; // Percentage (100 = original size)
  displayWidth?: number; // Width in pixels (keeps aspect ratio)
  displayHeight?: number; // Height in pixels (keeps aspect ratio)
  gallery?: GalleryImage[]; // Optional gallery mode for image skills
  annotation?: string; // Optional annotation text shown below the skill (for images, diagrams, etc.)
  dataObjectSubscriptions?: string[]; // Track which data objects this skill subscribes to
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
  getAllSkills: () => Skill[];
  updateUI: () => void;
  showToast: (message: string) => void;
  createSkill: (type: SkillType, content: string, altText?: string) => string;
  notifyContentUpdated: (skillId: string) => void;
  // Data object registry methods
  registerDataObject: (name: string, type: string, data: any) => void;
  subscribeToDataObject: (dataObjectName: string, skillId: string) => void;
  unsubscribeFromDataObject: (dataObjectName: string, skillId: string) => void;
  updateDataObject: (dataObjectName: string, newData: any, updaterSkillId?: string) => void;
  getDataObject: (dataObjectName: string) => any;
  hasDataObject: (dataObjectName: string) => boolean;
  getAllDataObjectNames: () => string[];
  getDataObjectInfo: (dataObjectName: string) => any;
}

// Base skill handler interface
export interface SkillHandler {
  type: SkillType;
  render: (skill: Skill) => Promise<string>;
  generateDescription: (skill: Skill) => string;
  getContentAsMarkdown: (skill: Skill) => string;
  canResize?: boolean;
  getImage: (skill: Skill, imageIndex?: number) => Promise<{ type: string; data: string; mediaType: string } | string>;
  getTools?: (api: ScratchpadAPI) => ToolDefinition[];
  getInstructions?: () => string;
  onDataObjectUpdated?: (skill: Skill, dataObjectName: string, newData: any) => void;
}
