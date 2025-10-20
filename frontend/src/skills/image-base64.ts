import { Skill, SkillHandler } from './types';

export const imageBase64Skill: SkillHandler = {
  type: 'image-base64',
  canResize: true,

  render: async (skill: Skill): Promise<string> => {
    const alt = skill.altText || 'Base64 Image';
    const sizeStyle = skill.displaySize ? `style="width: ${skill.displaySize}%;"` : '';
    return `
      <div class="skill-content image-base64-skill">
        <img src="${skill.content}" alt="${alt}" ${sizeStyle} />
      </div>
    `;
  },

  generateDescription: (skill: Skill): string => {
    return skill.altText || 'Base64 Image';
  },

  getBase64: async (skill: Skill) => {
    // Extract base64 data from data URI
    const match = skill.content.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid base64 data URI format');
    }

    return {
      skillId: skill.id,
      type: 'image-base64',
      mimeType: match[1],
      base64Data: match[2],
      altText: skill.altText,
    };
  },

  getInstructions: (): string => {
    return `- 'image-base64': Base64-encoded images (data URI is stored)`;
  },
};
