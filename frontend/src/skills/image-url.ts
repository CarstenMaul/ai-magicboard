import { Skill, SkillHandler } from './types';

// Optimize and convert image to JPEG for AI viewing
async function optimizeImageForAI(imageUrl: string): Promise<{ mimeType: string; base64Data: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Enable CORS for cross-origin images

    img.onload = () => {
      // Create a canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Calculate new dimensions (max 800x800, maintain aspect ratio)
      const maxSize = 800;
      let width = img.width;
      let height = img.height;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else {
          width = (width / height) * maxSize;
          height = maxSize;
        }
      }

      // Set canvas size
      canvas.width = width;
      canvas.height = height;

      // Draw image on canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG with quality reduction (0.7 = 70% quality)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

      if (match) {
        resolve({
          mimeType: match[1],
          base64Data: match[2],
        });
      } else {
        reject(new Error('Failed to convert canvas to base64'));
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
}

export const imageUrlSkill: SkillHandler = {
  type: 'image-url',
  canResize: true,

  render: async (skill: Skill): Promise<string> => {
    const alt = skill.altText || 'Image';
    const sizeStyle = skill.displaySize ? `style="width: ${skill.displaySize}%;"` : '';
    return `
      <div class="skill-content image-url-skill">
        <img src="${skill.content}" alt="${alt}" ${sizeStyle} />
      </div>
    `;
  },

  generateDescription: (skill: Skill): string => {
    return skill.altText || skill.content.substring(0, 40) + (skill.content.length > 40 ? '...' : '');
  },

  getBase64: async (skill: Skill) => {
    // Optimize and convert image to JPEG
    const { mimeType, base64Data } = await optimizeImageForAI(skill.content);

    return {
      skillId: skill.id,
      type: 'image-url',
      url: skill.content,
      mimeType: mimeType,
      base64Data: base64Data,
      altText: skill.altText,
      optimized: true,
      format: 'JPEG (70% quality, max 800x800)',
    };
  },

  getInstructions: (): string => {
    return `- 'image-url': Images from URLs (URL is stored, optimized to JPEG 70% quality / max 800x800px when viewed by AI)`;
  },
};
