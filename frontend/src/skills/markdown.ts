import { marked } from 'marked';
import { Skill, SkillHandler } from './types';

export const markdownSkill: SkillHandler = {
  type: 'markdown',

  render: async (skill: Skill): Promise<string> => {
    const html = marked(skill.content) as string;
    return `
      <div class="skill-content markdown-skill">
        ${html}
      </div>
    `;
  },

  generateDescription: (skill: Skill): string => {
    const maxLength = 60;
    const cleanContent = skill.content
      .replace(/[#*`_~\[\]()]/g, '') // Remove markdown symbols
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .trim();

    if (cleanContent.length <= maxLength) {
      return cleanContent;
    }

    return cleanContent.substring(0, maxLength) + '...';
  },

  getInstructions: (): string => {
    return `- 'markdown': Text/markdown content`;
  },
};
