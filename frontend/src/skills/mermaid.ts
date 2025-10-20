import { Skill, SkillHandler } from './types';

export const mermaidSkill: SkillHandler = {
  type: 'mermaid',

  render: async (skill: Skill): Promise<string> => {
    return `
      <div class="skill-content mermaid-skill">
        <pre class="mermaid">${skill.content}</pre>
      </div>
    `;
  },

  generateDescription: (skill: Skill): string => {
    const maxLength = 60;
    const cleanContent = skill.content
      .replace(/[#*`_~\[\]()]/g, '') // Remove symbols
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .trim();

    if (cleanContent.length <= maxLength) {
      return cleanContent;
    }

    return cleanContent.substring(0, maxLength) + '...';
  },

  getInstructions: (): string => {
    return `- 'mermaid': Mermaid diagrams (flowcharts, sequence diagrams, class diagrams, etc.)`;
  },
};
