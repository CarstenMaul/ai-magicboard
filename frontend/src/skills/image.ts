import { Skill, SkillHandler, ScratchpadAPI, ToolDefinition } from './types';

// Detect if content is a data URI (base64) or a URL
function isDataURI(content: string): boolean {
  return content.startsWith('data:');
}

// Generate style attribute for image sizing
function getImageStyle(img: { displaySize?: number; displayWidth?: number; displayHeight?: number }): string {
  if (img.displayWidth) {
    return `style="width: ${img.displayWidth}px; height: auto;"`;
  }
  if (img.displayHeight) {
    return `style="height: ${img.displayHeight}px; width: auto;"`;
  }
  if (img.displaySize) {
    return `style="width: ${img.displaySize}%;"`;
  }
  return '';
}

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

export const imageSkill: SkillHandler = {
  type: 'image',
  canResize: true,

  render: async (skill: Skill): Promise<string> => {
    // All images are galleries (even single images are a gallery with 1 item)
    const gallery = skill.gallery || [];
    const imagesHtml = gallery.map(img => {
      const alt = img.altText || `Image ${img.index}`;
      const sizeStyle = getImageStyle(img);
      const annotationHtml = img.annotation
        ? `<div class="image-annotation">${img.annotation}</div>`
        : '';
      return `
        <div class="gallery-item">
          <div class="gallery-image-wrapper">
            <img src="${img.content}" alt="${alt}" ${sizeStyle} />
            <div class="image-index">${img.index}</div>
          </div>
          ${annotationHtml}
        </div>
      `;
    }).join('');

    return `
      <div class="skill-content image-skill">
        <div class="image-gallery">
          ${imagesHtml}
        </div>
      </div>
    `;
  },

  generateDescription: (skill: Skill): string => {
    const gallery = skill.gallery || [];
    let desc = `Gallery with ${gallery.length} image${gallery.length !== 1 ? 's' : ''}`;

    // Count how many images in gallery have annotations
    const annotatedCount = gallery.filter(img => img.annotation).length;
    if (annotatedCount > 0) {
      desc += ` (${annotatedCount} annotated)`;
    }

    return desc;
  },

  getContentAsMarkdown: (skill: Skill): string => {
    const gallery = skill.gallery || [];
    return gallery.map(img => {
      const alt = img.altText || `Image ${img.index}`;
      let imgMarkdown = `![${alt}](${img.content})`;
      // Add per-image annotation if present
      if (img.annotation) {
        imgMarkdown += `\n\n*${img.annotation}*`;
      }
      return imgMarkdown;
    }).join('\n\n');
  },

  getImage: async (skill: Skill, imageIndex: number = 1) => {
    // All images are galleries - find by index
    const gallery = skill.gallery || [];
    const galleryImage = gallery.find(img => img.index === imageIndex);
    if (!galleryImage) {
      throw new Error(`Image with index ${imageIndex} not found in gallery`);
    }

    const targetImage = {
      content: galleryImage.content,
      altText: galleryImage.altText,
    };

    // Process the image based on content type
    if (isDataURI(targetImage.content)) {
      // Extract base64 data from data URI
      const match = targetImage.content.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        throw new Error('Invalid base64 data URI format');
      }

      // Return in format for AI visual analysis
      return {
        type: 'image',
        data: match[2],
        mediaType: match[1],
      };
    } else {
      // Optimize and convert image URL to JPEG (25% quality to stay under RTCDataChannel limit)
      const img = new Image();
      img.crossOrigin = 'anonymous';

      return new Promise((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // Convert to JPEG with 25% quality (same as PDF skill)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.25);
          const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

          if (match) {
            resolve({
              type: 'image',
              data: match[2],
              mediaType: match[1],
            });
          } else {
            reject(new Error('Failed to convert canvas to base64'));
          }
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        img.src = targetImage.content;
      });
    }
  },

  getTools: (api: ScratchpadAPI): ToolDefinition[] => {
    return [
      {
        name: 'look_at_image',
        description: 'Sends an image to you for visual analysis by its index number. Single images have index 1, gallery images have indices 1, 2, 3, etc. Returns the image directly so you can see and describe what\'s in it. Use this when the user says "look at image 1" or "look at image 3".',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the image skill (e.g., "skill-1")',
            },
            image_index: {
              type: 'number',
              description: 'The image index to view (1 for single images, 1, 2, 3, etc. for galleries)',
              default: 1,
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
          if (skill.type !== 'image') {
            return `Skill ${input.skill_id} is not an image skill (type: ${skill.type})`;
          }

          const imageIndex = input.image_index || 1;

          try {
            const result = await imageSkill.getImage!(skill, imageIndex);

            // If result is a string, it's an error message
            if (typeof result === 'string') {
              return result;
            }

            const sizeKB = Math.round(result.data.length / 1024);
            api.showToast(`Sending image ${imageIndex} to AI for visual analysis (${sizeKB}KB)`);
            return result;
          } catch (error) {
            return `Error loading image: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      },
      {
        name: 'set_image_size',
        description: 'Sets the display size of an image skill as a percentage. Does not re-encode the image, only changes how it is displayed. 100 = original size, 50 = half size, 200 = double size. Applies to single images or all images in a gallery.',
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
          if (skill.type !== 'image') {
            return `Skill ${input.skill_id} is not an image skill (type: ${skill.type})`;
          }
          if (input.size_percentage < 10 || input.size_percentage > 500) {
            return `Invalid size percentage: ${input.size_percentage}. Must be between 10 and 500.`;
          }

          // Apply to all images in gallery
          const gallery = skill.gallery || [];
          gallery.forEach(img => {
            img.displaySize = input.size_percentage;
            delete img.displayWidth;
            delete img.displayHeight;
          });

          api.notifyContentUpdated(input.skill_id);
          api.showToast(`All ${gallery.length} image${gallery.length !== 1 ? 's' : ''} resized to ${input.size_percentage}%`);
          return `All ${gallery.length} gallery image${gallery.length !== 1 ? 's' : ''} resized to ${input.size_percentage}%`;
        },
      },
      {
        name: 'set_image_width',
        description: 'Sets the display width of an image skill in pixels, maintaining aspect ratio. Applies to single images or all images in a gallery.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the image to resize (e.g., "skill-1")',
            },
            width_px: {
              type: 'number',
              description: 'The display width in pixels (50-2000). Example: 300',
            },
          },
          required: ['skill_id', 'width_px'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'image') {
            return `Skill ${input.skill_id} is not an image skill (type: ${skill.type})`;
          }
          if (input.width_px < 50 || input.width_px > 2000) {
            return `Invalid width: ${input.width_px}. Must be between 50 and 2000 pixels.`;
          }

          // Apply to all images in gallery
          const gallery = skill.gallery || [];
          gallery.forEach(img => {
            img.displayWidth = input.width_px;
            delete img.displaySize;
            delete img.displayHeight;
          });

          api.notifyContentUpdated(input.skill_id);
          api.showToast(`All ${gallery.length} image${gallery.length !== 1 ? 's' : ''} resized to ${input.width_px}px width`);
          return `All ${gallery.length} gallery image${gallery.length !== 1 ? 's' : ''} resized to ${input.width_px}px width (aspect ratio maintained)`;
        },
      },
      {
        name: 'set_image_height',
        description: 'Sets the display height of an image skill in pixels, maintaining aspect ratio. Applies to single images or all images in a gallery.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the image to resize (e.g., "skill-1")',
            },
            height_px: {
              type: 'number',
              description: 'The display height in pixels (50-2000). Example: 300',
            },
          },
          required: ['skill_id', 'height_px'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'image') {
            return `Skill ${input.skill_id} is not an image skill (type: ${skill.type})`;
          }
          if (input.height_px < 50 || input.height_px > 2000) {
            return `Invalid height: ${input.height_px}. Must be between 50 and 2000 pixels.`;
          }

          // Apply to all images in gallery
          const gallery = skill.gallery || [];
          gallery.forEach(img => {
            img.displayHeight = input.height_px;
            delete img.displaySize;
            delete img.displayWidth;
          });

          api.notifyContentUpdated(input.skill_id);
          api.showToast(`All ${gallery.length} image${gallery.length !== 1 ? 's' : ''} resized to ${input.height_px}px height`);
          return `All ${gallery.length} gallery image${gallery.length !== 1 ? 's' : ''} resized to ${input.height_px}px height (aspect ratio maintained)`;
        },
      },
      {
        name: 'add_image_to_gallery',
        description: 'Adds an image to an image skill\'s gallery. If the skill doesn\'t have a gallery yet, initializes one. Accepts both URLs and base64 data URIs. Optionally add an annotation.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the image skill (e.g., "skill-1")',
            },
            content: {
              type: 'string',
              description: 'Either a URL or a data URI (data:image/png;base64,...)',
            },
            alt_text: {
              type: 'string',
              description: 'Optional alt text for the image',
            },
            annotation: {
              type: 'string',
              description: 'Optional annotation text to display below the image',
            },
          },
          required: ['skill_id', 'content'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'image') {
            return `Skill ${input.skill_id} is not an image skill (type: ${skill.type})`;
          }

          // Initialize gallery if it doesn't exist
          if (!skill.gallery) {
            skill.gallery = [];
            // Preserve the original single image as the first gallery item
            if (skill.content) {
              skill.gallery.push({
                index: 1,
                content: skill.content,
                altText: skill.altText,
                displaySize: skill.displaySize,
                annotation: skill.annotation,
              });
            }
          }

          // Find next index
          const nextIndex = skill.gallery.length > 0
            ? Math.max(...skill.gallery.map(img => img.index)) + 1
            : 1;

          // Add new image
          skill.gallery.push({
            index: nextIndex,
            content: input.content,
            altText: input.alt_text,
            annotation: input.annotation,
          });

          api.notifyContentUpdated(input.skill_id);
          api.showToast(`Image ${nextIndex} added to gallery`);
          return `Image added to gallery at index ${nextIndex}. Gallery now has ${skill.gallery.length} image(s).`;
        },
      },
      {
        name: 'remove_image_from_gallery',
        description: 'Removes an image from an image skill\'s gallery by its index.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the image skill (e.g., "skill-1")',
            },
            image_index: {
              type: 'number',
              description: 'The index of the image to remove',
            },
          },
          required: ['skill_id', 'image_index'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'image') {
            return `Skill ${input.skill_id} is not an image skill (type: ${skill.type})`;
          }
          if (!skill.gallery || skill.gallery.length === 0) {
            return `Skill ${input.skill_id} has no gallery images`;
          }

          const imageIndex = skill.gallery.findIndex(img => img.index === input.image_index);
          if (imageIndex === -1) {
            return `Image with index ${input.image_index} not found in gallery`;
          }

          skill.gallery.splice(imageIndex, 1);
          api.notifyContentUpdated(input.skill_id);
          api.showToast(`Image ${input.image_index} removed from gallery`);
          return `Image ${input.image_index} removed. Gallery now has ${skill.gallery.length} image(s).`;
        },
      },
      {
        name: 'set_gallery_image_size',
        description: 'Sets the display size of a specific image in a gallery as a percentage. Does not re-encode the image, only changes how it is displayed.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the image skill (e.g., "skill-1")',
            },
            image_index: {
              type: 'number',
              description: 'The index of the image to resize',
            },
            size_percentage: {
              type: 'number',
              description: 'The display size as a percentage (10-500). Examples: 50 = half size, 100 = original, 200 = double',
            },
          },
          required: ['skill_id', 'image_index', 'size_percentage'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'image') {
            return `Skill ${input.skill_id} is not an image skill (type: ${skill.type})`;
          }
          if (!skill.gallery || skill.gallery.length === 0) {
            return `Skill ${input.skill_id} has no gallery images`;
          }

          const image = skill.gallery.find(img => img.index === input.image_index);
          if (!image) {
            return `Image with index ${input.image_index} not found in gallery`;
          }

          if (input.size_percentage < 10 || input.size_percentage > 500) {
            return `Invalid size percentage: ${input.size_percentage}. Must be between 10 and 500.`;
          }

          image.displaySize = input.size_percentage;
          api.notifyContentUpdated(input.skill_id);
          api.showToast(`Image ${input.image_index} size set to ${input.size_percentage}%`);
          return `Gallery image ${input.image_index} display size set to ${input.size_percentage}%`;
        },
      },
      {
        name: 'read_gallery_images',
        description: 'Lists all images in an image skill\'s gallery with their indices, metadata, and annotations.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the image skill (e.g., "skill-1")',
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
          if (skill.type !== 'image') {
            return `Skill ${input.skill_id} is not an image skill (type: ${skill.type})`;
          }
          if (!skill.gallery || skill.gallery.length === 0) {
            return `Skill ${input.skill_id} has no gallery images`;
          }

          const images = skill.gallery.map(img => ({
            index: img.index,
            altText: img.altText,
            annotation: img.annotation || null,
            displaySize: img.displaySize || 100,
            contentPreview: img.content.substring(0, 50) + '...',
          }));

          return JSON.stringify({
            skillId: input.skill_id,
            totalImages: skill.gallery.length,
            images,
          }, null, 2);
        },
      },
      {
        name: 'get_gallery_image_base64',
        description: 'Gets a specific image from a gallery as base64-encoded data. For URL images, fetches and optimizes to JPEG. For base64 images, returns existing data.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the image skill (e.g., "skill-1")',
            },
            image_index: {
              type: 'number',
              description: 'The index of the image to view',
            },
          },
          required: ['skill_id', 'image_index'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'image') {
            return `Skill ${input.skill_id} is not an image skill (type: ${skill.type})`;
          }
          if (!skill.gallery || skill.gallery.length === 0) {
            return `Skill ${input.skill_id} has no gallery images`;
          }

          const image = skill.gallery.find(img => img.index === input.image_index);
          if (!image) {
            return `Image with index ${input.image_index} not found in gallery`;
          }

          try {
            if (isDataURI(image.content)) {
              // Extract base64 data from data URI
              const match = image.content.match(/^data:([^;]+);base64,(.+)$/);
              if (!match) {
                throw new Error('Invalid base64 data URI format');
              }

              return JSON.stringify({
                skillId: skill.id,
                imageIndex: input.image_index,
                type: 'image',
                mimeType: match[1],
                base64Data: match[2],
                altText: image.altText,
              }, null, 2);
            } else {
              // Optimize and convert image URL to JPEG
              const { mimeType, base64Data } = await optimizeImageForAI(image.content);

              return JSON.stringify({
                skillId: skill.id,
                imageIndex: input.image_index,
                type: 'image',
                url: image.content,
                mimeType: mimeType,
                base64Data: base64Data,
                altText: image.altText,
                optimized: true,
                format: 'JPEG (70% quality, max 800x800)',
              }, null, 2);
            }
          } catch (error) {
            return `Error getting base64: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      },
      {
        name: 'set_image_annotation',
        description: 'Adds or updates an annotation text that appears directly below an image. For single images, annotates the image. For galleries, requires image_index to annotate a specific image in the gallery.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the image skill (e.g., "skill-1")',
            },
            annotation: {
              type: 'string',
              description: 'The annotation text to display below the image. Can be empty to remove the annotation.',
            },
            image_index: {
              type: 'number',
              description: 'For gallery images only: the index of the specific image to annotate (e.g., 1, 2, 3). Omit for single images.',
            },
          },
          required: ['skill_id', 'annotation'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'image') {
            return `Skill ${input.skill_id} is not an image skill (type: ${skill.type})`;
          }

          // All images are galleries - find by index
          const gallery = skill.gallery || [];
          if (input.image_index === undefined || input.image_index === null) {
            return `Please specify image_index parameter (e.g., 1, 2, 3) to annotate a specific image.`;
          }

          const image = gallery.find(img => img.index === input.image_index);
          if (!image) {
            return `Image with index ${input.image_index} not found in gallery. Available indices: ${gallery.map(img => img.index).join(', ')}`;
          }

          // Set or clear annotation for this specific image
          if (input.annotation && input.annotation.trim().length > 0) {
            image.annotation = input.annotation;
            api.notifyContentUpdated(input.skill_id);
            api.showToast(`Annotation added to image ${input.image_index}`);
            return `Annotation added to image ${input.image_index} in ${input.skill_id}: "${input.annotation}"`;
          } else {
            image.annotation = undefined;
            api.notifyContentUpdated(input.skill_id);
            api.showToast(`Annotation removed from image ${input.image_index}`);
            return `Annotation removed from image ${input.image_index} in ${input.skill_id}`;
          }
        },
      },
    ];
  },

  getInstructions: (): string => {
    return `- 'image': Images from URLs or base64 data URIs. All images are galleries (even single images).
  * To create an image: Use create_skill with type='image' and content=URL or data URI
  * Single images are automatically created as a gallery with 1 item (index 1)
  * To add more images: Use add_image_to_gallery to add to the same skill
  * ALL images have index numbers displayed in the corner (1, 2, 3, etc.)

  Visual Analysis:
  * look_at_image(skill_id, image_index): Sends the image to you for visual analysis
  * IMPORTANT: The image is sent directly to you so you can SEE it
  * Default index is 1 if not specified
  * Use when user says "look at image 1" or "look at image 3"
  * Example: look_at_image("skill-1", 2) to see the second image
  * Images are compressed to JPEG (25% quality) to fit RTCDataChannel limits

  Image Annotations (per individual image):
  * set_image_annotation(skill_id, annotation, image_index): Add text that appears below a specific image
  * ALWAYS specify image_index (even for single images use index 1)
  * Example: set_image_annotation("skill-1", "This shows the login flow", 1)
  * Each image can have its own annotation shown directly below it
  * Use annotations to explain, label, or provide context for individual images
  * Pass empty string to remove an annotation

  Image Resizing (applies to single images or ALL images in a gallery):
  * set_image_size: Resize by percentage (50 = half, 100 = original, 200 = double)
  * set_image_width: Resize to specific width in pixels (maintains aspect ratio)
  * set_image_height: Resize to specific height in pixels (maintains aspect ratio)
  * set_gallery_image_size: Resize a specific gallery image by index and percentage

  Individual Gallery Image Operations:
  * remove_image_from_gallery: Remove specific image by index
  * read_gallery_images: List all images with their indices`;
  },
};
