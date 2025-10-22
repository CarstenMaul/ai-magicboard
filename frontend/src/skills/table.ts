import { Skill, SkillHandler, ScratchpadAPI, ToolDefinition } from './types';

// Table data structure
interface TableData {
  columns: string[];
  data: any[][];
}

// Parse table content
function parseTableContent(content: string): TableData {
  try {
    return JSON.parse(content);
  } catch (error) {
    // Return empty table if parsing fails
    return { columns: [], data: [] };
  }
}

// Generate unique table ID for Grid.js
let tableIdCounter = 1;
function generateTableId(): string {
  return `table-grid-${tableIdCounter++}`;
}

export const tableSkill: SkillHandler = {
  type: 'table',

  render: async (skill: Skill): Promise<string> => {
    const tableData = parseTableContent(skill.content);
    const tableId = generateTableId();

    // Return a div that will be populated by Grid.js
    // We'll use a data attribute to store the table data
    const dataAttr = JSON.stringify(tableData).replace(/"/g, '&quot;');

    return `
      <div class="skill-content table-skill">
        <div id="${tableId}" class="gridjs-wrapper" data-table='${dataAttr}'></div>
      </div>
    `;
  },

  generateDescription: (skill: Skill): string => {
    const tableData = parseTableContent(skill.content);
    if (tableData.columns.length === 0) {
      return 'Empty table';
    }
    return `Table: ${tableData.columns.length} columns, ${tableData.data.length} rows`;
  },

  getContentAsMarkdown: (skill: Skill): string => {
    const tableData = parseTableContent(skill.content);

    if (tableData.columns.length === 0) {
      return '_Empty table_';
    }

    // Generate markdown table
    const headerRow = '| ' + tableData.columns.join(' | ') + ' |';
    const separatorRow = '|' + tableData.columns.map(() => '---').join('|') + '|';
    const dataRows = tableData.data.map(row => '| ' + row.join(' | ') + ' |');

    return [headerRow, separatorRow, ...dataRows].join('\n');
  },

  getTools: (api: ScratchpadAPI): ToolDefinition[] => {
    return [
      {
        name: 'create_table',
        description: 'Creates a new table with specified columns and optional initial data.',
        parameters: {
          type: 'object',
          properties: {
            columns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of column names, e.g., ["Name", "Email", "Phone"]',
            },
            data: {
              type: 'array',
              items: {
                type: 'array',
                items: { type: 'string' }
              },
              description: 'Optional array of rows, where each row is an array of values matching columns',
            },
          },
          required: ['columns'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const tableData: TableData = {
            columns: input.columns || [],
            data: input.data || [],
          };

          // Validate data rows match column count
          if (tableData.data.length > 0) {
            const columnCount = tableData.columns.length;
            const invalidRows = tableData.data.filter(row => row.length !== columnCount);
            if (invalidRows.length > 0) {
              return `Error: All data rows must have ${columnCount} values to match column count`;
            }
          }

          // This will be called via create_skill with type='table'
          return JSON.stringify(tableData);
        },
      },
      {
        name: 'add_table_row',
        description: 'Adds a new row to an existing table.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the table (e.g., "skill-1")',
            },
            row: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of values for the new row, must match column count',
            },
          },
          required: ['skill_id', 'row'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'table') {
            return `Skill ${input.skill_id} is not a table skill (type: ${skill.type})`;
          }

          const tableData = parseTableContent(skill.content);

          if (input.row.length !== tableData.columns.length) {
            return `Error: Row must have ${tableData.columns.length} values to match column count`;
          }

          tableData.data.push(input.row);
          skill.content = JSON.stringify(tableData);

          api.updateUI();
          api.showToast(`Row added to table`);
          return `Row added. Table now has ${tableData.data.length} rows.`;
        },
      },
      {
        name: 'add_table_column',
        description: 'Adds a new column to an existing table.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the table (e.g., "skill-1")',
            },
            column_name: {
              type: 'string',
              description: 'Name of the new column',
            },
            default_value: {
              type: 'string',
              description: 'Default value for existing rows (optional, defaults to empty string)',
            },
          },
          required: ['skill_id', 'column_name'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'table') {
            return `Skill ${input.skill_id} is not a table skill (type: ${skill.type})`;
          }

          const tableData = parseTableContent(skill.content);
          const defaultValue = input.default_value || '';

          tableData.columns.push(input.column_name);
          tableData.data.forEach(row => row.push(defaultValue));

          skill.content = JSON.stringify(tableData);

          api.updateUI();
          api.showToast(`Column "${input.column_name}" added`);
          return `Column "${input.column_name}" added. Table now has ${tableData.columns.length} columns.`;
        },
      },
      {
        name: 'update_table_cell',
        description: 'Updates a specific cell value in the table.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the table (e.g., "skill-1")',
            },
            row_index: {
              type: 'number',
              description: 'Zero-based row index (0 for first row)',
            },
            column_index: {
              type: 'number',
              description: 'Zero-based column index (0 for first column)',
            },
            value: {
              type: 'string',
              description: 'New value for the cell',
            },
          },
          required: ['skill_id', 'row_index', 'column_index', 'value'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'table') {
            return `Skill ${input.skill_id} is not a table skill (type: ${skill.type})`;
          }

          const tableData = parseTableContent(skill.content);

          if (input.row_index < 0 || input.row_index >= tableData.data.length) {
            return `Error: Row index ${input.row_index} out of range (0-${tableData.data.length - 1})`;
          }
          if (input.column_index < 0 || input.column_index >= tableData.columns.length) {
            return `Error: Column index ${input.column_index} out of range (0-${tableData.columns.length - 1})`;
          }

          const oldValue = tableData.data[input.row_index][input.column_index];
          tableData.data[input.row_index][input.column_index] = input.value;

          skill.content = JSON.stringify(tableData);

          api.updateUI();
          api.showToast(`Cell updated`);
          return `Cell [${input.row_index}, ${input.column_index}] updated from "${oldValue}" to "${input.value}"`;
        },
      },
      {
        name: 'delete_table_row',
        description: 'Deletes a row from the table by index.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the table (e.g., "skill-1")',
            },
            row_index: {
              type: 'number',
              description: 'Zero-based row index to delete (0 for first row)',
            },
          },
          required: ['skill_id', 'row_index'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'table') {
            return `Skill ${input.skill_id} is not a table skill (type: ${skill.type})`;
          }

          const tableData = parseTableContent(skill.content);

          if (input.row_index < 0 || input.row_index >= tableData.data.length) {
            return `Error: Row index ${input.row_index} out of range (0-${tableData.data.length - 1})`;
          }

          tableData.data.splice(input.row_index, 1);
          skill.content = JSON.stringify(tableData);

          api.updateUI();
          api.showToast(`Row ${input.row_index} deleted`);
          return `Row ${input.row_index} deleted. Table now has ${tableData.data.length} rows.`;
        },
      },
      {
        name: 'read_table_data',
        description: 'Reads the complete table data including columns and all rows.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the table (e.g., "skill-1")',
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
          if (skill.type !== 'table') {
            return `Skill ${input.skill_id} is not a table skill (type: ${skill.type})`;
          }

          const tableData = parseTableContent(skill.content);
          return JSON.stringify(tableData, null, 2);
        },
      },
      {
        name: 'sort_table_by_column',
        description: 'Sorts the table data by a specific column in ascending or descending order.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the table (e.g., "skill-1")',
            },
            column_index: {
              type: 'number',
              description: 'Zero-based index of the column to sort by (0 for first column)',
            },
            order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort order: "asc" for ascending, "desc" for descending',
            },
          },
          required: ['skill_id', 'column_index', 'order'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'table') {
            return `Skill ${input.skill_id} is not a table skill (type: ${skill.type})`;
          }

          const tableData = parseTableContent(skill.content);

          if (input.column_index < 0 || input.column_index >= tableData.columns.length) {
            return `Error: Column index ${input.column_index} out of range (0-${tableData.columns.length - 1})`;
          }

          const columnName = tableData.columns[input.column_index];

          // Sort the data array
          tableData.data.sort((a, b) => {
            const aVal = a[input.column_index];
            const bVal = b[input.column_index];

            // Try to parse as numbers for numeric sorting
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);

            let comparison = 0;
            if (!isNaN(aNum) && !isNaN(bNum)) {
              // Numeric comparison
              comparison = aNum - bNum;
            } else {
              // String comparison
              comparison = String(aVal).localeCompare(String(bVal));
            }

            return input.order === 'asc' ? comparison : -comparison;
          });

          skill.content = JSON.stringify(tableData);

          api.updateUI();
          api.showToast(`Table sorted by "${columnName}" (${input.order})`);
          return `Table sorted by column "${columnName}" in ${input.order === 'asc' ? 'ascending' : 'descending'} order`;
        },
      },
    ];
  },

  getImage: async (skill: Skill, _imageIndex: number = 1): Promise<string> => {
    const tableData = parseTableContent(skill.content);
    return `Table skills do not provide images for visual analysis. This is a data table skill with ${tableData.columns.length} column${tableData.columns.length !== 1 ? 's' : ''} and ${tableData.data.length} row${tableData.data.length !== 1 ? 's' : ''}. Use read_table_data to read the table content instead.`;
  },

  getInstructions: (): string => {
    return `- 'table': Interactive data tables powered by Grid.js
  * Create tables with columns and data
  * Add/remove rows and columns dynamically
  * Update individual cells
  * Built-in sorting (click column headers in UI) and search functionality
  * Pagination (10 rows per page)
  * To create: Use create_skill with type='table' and content from create_table tool

  Table Management Tools:
  * create_table: Define columns and optional initial data
  * add_table_row: Append new rows to the table
  * add_table_column: Add new columns (fills existing rows with default value)
  * update_table_cell: Update specific cell values by row/column index
  * delete_table_row: Remove rows by index
  * read_table_data: View complete table structure and data
  * sort_table_by_column: Sort table by column index (asc/desc) - supports numeric and alphabetic sorting

  Sorting:
  * Users can click column headers to sort interactively
  * Programmatic sorting: sort_table_by_column(skill_id, column_index, order="asc"/"desc")
  * Smart sorting: Automatically detects numbers vs text for proper sorting

  Example workflow:
  1. tableContent = create_table(columns=["Name", "Age"], data=[["Alice", "25"], ["Bob", "30"]])
  2. create_skill(type='table', content=tableContent)
  3. add_table_row(skill_id="skill-1", row=["Charlie", "20"])
  4. sort_table_by_column(skill_id="skill-1", column_index=1, order="asc")  # Sort by Age ascending`;
  },
};
