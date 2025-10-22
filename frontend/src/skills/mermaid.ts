import { Skill, SkillHandler } from './types';
import mermaid from 'mermaid';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

// Render mermaid diagrams in the DOM (called after DOM update)
export async function renderMermaidDiagrams(): Promise<void> {
  const scratchpadDiv = document.getElementById('scratchpad');
  if (!scratchpadDiv) return;

  const mermaidElements = scratchpadDiv.querySelectorAll('.mermaid');
  if (mermaidElements.length > 0) {
    console.log(`Found ${mermaidElements.length} mermaid diagram(s) to render`);

    // Log each mermaid element's content before rendering
    mermaidElements.forEach((element, index) => {
      console.log(`Mermaid diagram ${index + 1} content:`, element.textContent);
    });

    try {
      console.log('Calling mermaid.run()...');
      await mermaid.run({
        nodes: Array.from(mermaidElements) as HTMLElement[],
        suppressErrors: true,
      });
      console.log('Mermaid rendering completed successfully');
    } catch (error) {
      console.error('Failed to render mermaid diagrams:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  }
}

export const mermaidSkill: SkillHandler = {
  type: 'mermaid',

  render: async (skill: Skill): Promise<string> => {
    // Log mermaid markup to console for debugging
    console.log('=== MERMAID DIAGRAM ===');
    console.log(`Skill ID: ${skill.id}`);
    console.log('Markup:');
    console.log(skill.content);
    console.log('======================');

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
    return `- 'mermaid': Mermaid diagrams (flowcharts, sequence diagrams, class diagrams, etc.)

# Mermaid Diagram Reference Guide

## Shared Constructs (Usable Inside Many Diagrams)

- **Comments**: A whole line starting with \`%%\` is ignored
- **Direction** (where supported): \`direction TB|BT|LR|RL\` inside the diagram body
  - \`TB\` = Top to Bottom, \`BT\` = Bottom to Top, \`LR\` = Left to Right, \`RL\` = Right to Left
- **Inline Styling Hooks** (where supported):
  - Define a style class: \`classDef name prop:val,prop2:val2\`
  - Apply it: \`class id1,id2 name\` **or** \`id:::name\`
  - Direct style: \`style id prop:val\`

## Flowchart

**Start**: \`flowchart TB|TD|BT|LR|RL\` (TD ≙ TB)

**Nodes**:
- Minimal: \`A\` (id is label)
- Custom label: \`A["My label"]\`
- **Shapes**: \`A@{ shape: rect|rounded|stadium|circle|diam|hex|cyl|... }\`

**Edges**:
- Arrow: \`A --> B\`
- Line: \`A --- B\`
- Dotted: \`A -.-> B\`
- End markers: \`--o\` (circle), \`--x\` (cross)
- Labels: \`A -- "text" --> B\` *or* \`A -->|text| B\`

**Subgraphs**:
\`\`\`
subgraph Group Title
direction LR
A --> B
end
\`\`\`

## Sequence Diagram

**Start**: \`sequenceDiagram\`

**Participants**:
- \`participant A\`
- Alias: \`participant App as "Mobile App"\`

**Messages**:
- Solid: \`A->>B: text\`
- Dashed: \`A-->>B: text\`
- Self: \`A->>A: text\`

**Activate/Deactivate Lifeline**:
- \`activate B\` / \`deactivate B\`
- Or use \`+\`/\`-\` suffix on message arrows

**Grouping**:
- \`loop ... end\`
- \`alt ... else ... end\`
- \`opt ... end\`
- \`par ... and ... end\`
- \`critical ... option ... end\`
- \`break ... end\`

**Notes**:
- \`Note left of A: text\`
- \`Note over A,B: text\`

**Highlight Region**:
\`\`\`
rect rgba(0,0,255,.1)
  A->>B: call
end
\`\`\`

## Class Diagram

**Start**: \`classDiagram\`

**Classes**:
- \`class Animal\`
- Or define by relation: \`Vehicle <|-- Car\`

**Members**:
\`\`\`
Class {
  +id : int
  -calc() : number
}
\`\`\`

**Relations**:
- Inheritance: \`<|--\`
- Composition: \`*--\`
- Aggregation: \`o--\`
- Association: \`--\`
- Label: \`A -- "uses" --> B\`

## State Diagram

**Start**: \`stateDiagram\`

**States**:
- \`state idle\`
- \`Idle: Human-readable label\`
- Composite: \`state Idle { ... }\`

**Start/End**:
- \`[*] --> State\`
- \`State --> [*]\`

**Transitions**: \`A --> B : event\`

**Notes**: \`note right of Idle: text\`

## Entity-Relationship (ER) Diagram

**Start**: \`erDiagram\`

**Relations**:
\`\`\`
PROPERTY ||--|{ ROOM : contains
PERSON }|..|{ CAR : driver
\`\`\`

**Attributes**:
\`\`\`
USER {
  string name
  int id
  string email "primary email"
}
\`\`\`

## User Journey

**Start**: \`journey\`

**Sections & Tasks**:
\`\`\`
section Browsing
Search: 3: User
Add to cart: 4: User
section Checkout
Pay: 2: User, System
\`\`\`

**Score**: 1–5

## Gantt

**Start**: \`gantt\`

**Optional Headers**:
- \`title ...\`
- \`dateFormat ...\`
- \`axisFormat ...\`
- \`excludes weekends\`

**Tasks**:
\`\`\`
section Phase 1
Design      :done,   2025-01-01, 2025-01-07
Build       :active, after Design, 5d
Release     :milestone, 2025-01-15, 1d
\`\`\`

**Valid Tags**: \`active\`, \`done\`, \`crit\`, \`milestone\`

## Pie Chart

**Start**: \`pie\` (optional \`showData\`)

**Slices**: \`"Label" : value\`

## Quadrant Chart

**Start**: \`quadrantChart\`

**Axes & Quadrants**:
\`\`\`
title My Quadrants
x-axis Low --> High
y-axis Risk --> Safety
quadrant-1 "Q1 label"
Point A: [0.75, 0.80]
\`\`\`

## Requirement Diagram

**Start**: \`requirementDiagram\`

**Nodes**:
\`\`\`
requirement r1 {
  id: 1
  text: Must start in <1s>
  risk: High
  verifymethod: Test
}
\`\`\`

**Relations**: \`src - type -> dst\`
- Types: \`contains|copies|derives|satisfies|verifies|refines|traces\`

## GitGraph

**Start**: \`gitgraph\`

**Commands**: \`branch\`, \`checkout\`, \`commit\`, \`merge\`, \`tag\`

## Sankey

**Start**: \`sankey\`

**Body**: CSV-like with 3 columns: \`source,target,value\`

## XY Chart

**Start**: \`xychart-beta\`

**Structure**: Define x-axis, y-axis, then data lines

## Timeline

**Start**: \`timeline\`

**Structure**: \`title\`, then sections with events

## Mindmap

**Start**: \`mindmap\`

**Structure**: Indentation-based hierarchy

## Block Diagram

**Start**: \`block-beta\`

**Nodes**: \`block\`, \`columns\`, \`space\`

## Architecture

**Start**: \`architecture-beta\`

**Elements**: \`group\`, \`service\`, connections with \`:L\`, \`:R\`, etc.

## Treemap

**Start**: \`treemap\`

**Hierarchy**: By indentation, leaves supply values`;
  },

  getContentAsMarkdown: (skill: Skill): string => {
    // Wrap mermaid content in markdown code fence
    return `\`\`\`mermaid\n${skill.content}\n\`\`\``;
  },

  getImage: async (skill: Skill, imageIndex: number = 1): Promise<string> => {
    return `Mermaid diagram skills do not currently support image extraction for visual analysis. This skill contains a mermaid diagram definition. The diagram is rendered in the scratchpad for the user to view, but cannot be sent to you as an image.`;
  },
};
