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

  onDataObjectUpdated: (skill: Skill, dataObjectName: string, newData: any) => {
    // Update skill's content from the data object
    skill.content = JSON.stringify(newData);
  },

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

          api.notifyContentUpdated(input.skill_id);
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

          api.notifyContentUpdated(input.skill_id);
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

          api.notifyContentUpdated(input.skill_id);
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

          api.notifyContentUpdated(input.skill_id);
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

          api.notifyContentUpdated(input.skill_id);
          api.showToast(`Table sorted by "${columnName}" (${input.order})`);
          return `Table sorted by column "${columnName}" in ${input.order === 'asc' ? 'ascending' : 'descending'} order`;
        },
      },
      {
        name: 'register_table_data_object',
        description: 'Registers this table\'s data as a shared data object that other skills can subscribe to. This allows multiple skills to share and react to the same table data.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the table (e.g., "skill-1")',
            },
            data_object_name: {
              type: 'string',
              description: 'Unique name for the data object (e.g., "sales-data", "user-list")',
            },
          },
          required: ['skill_id', 'data_object_name'],
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
          api.registerDataObject(input.data_object_name, 'tabledata', tableData);

          api.showToast(`Data object "${input.data_object_name}" registered`);
          return `Table data registered as data object "${input.data_object_name}". Other skills can now subscribe to this data.`;
        },
      },
      {
        name: 'subscribe_table_to_data_object',
        description: 'Subscribes this table skill to an existing data object. When the data object is updated, this table will automatically update to reflect the changes.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the table to subscribe (e.g., "skill-1")',
            },
            data_object_name: {
              type: 'string',
              description: 'Name of the data object to subscribe to (must already exist)',
            },
          },
          required: ['skill_id', 'data_object_name'],
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

          if (!api.hasDataObject(input.data_object_name)) {
            return `Error: Data object "${input.data_object_name}" does not exist. Register it first using register_table_data_object or another registration tool.`;
          }

          api.subscribeToDataObject(input.data_object_name, input.skill_id);

          // Update table with current data from the data object
          const currentData = api.getDataObject(input.data_object_name);
          if (currentData) {
            skill.content = JSON.stringify(currentData);
            api.notifyContentUpdated(input.skill_id);
          }

          api.showToast(`Subscribed to "${input.data_object_name}"`);
          return `Table ${input.skill_id} subscribed to data object "${input.data_object_name}". It will now update automatically when the data changes.`;
        },
      },
      {
        name: 'unsubscribe_table_from_data_object',
        description: 'Unsubscribes this table from a data object. The table will no longer update when the data object changes.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the table to unsubscribe (e.g., "skill-1")',
            },
            data_object_name: {
              type: 'string',
              description: 'Name of the data object to unsubscribe from',
            },
          },
          required: ['skill_id', 'data_object_name'],
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

          api.unsubscribeFromDataObject(input.data_object_name, input.skill_id);

          api.showToast(`Unsubscribed from "${input.data_object_name}"`);
          return `Table ${input.skill_id} unsubscribed from data object "${input.data_object_name}".`;
        },
      },
      {
        name: 'update_table_data_object',
        description: 'Updates a data object with new table data. All skills subscribed to this data object will be notified and automatically update their content.',
        parameters: {
          type: 'object',
          properties: {
            data_object_name: {
              type: 'string',
              description: 'Name of the data object to update',
            },
            table_data: {
              type: 'object',
              properties: {
                columns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of column names',
                },
                data: {
                  type: 'array',
                  items: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  description: 'Array of rows, where each row is an array of values',
                },
              },
              required: ['columns', 'data'],
              description: 'The new table data structure',
            },
            updater_skill_id: {
              type: 'string',
              description: 'Optional: ID of the skill making the update (prevents it from being notified)',
            },
          },
          required: ['data_object_name', 'table_data'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          if (!api.hasDataObject(input.data_object_name)) {
            return `Error: Data object "${input.data_object_name}" does not exist. Register it first.`;
          }

          const tableData: TableData = {
            columns: input.table_data.columns || [],
            data: input.table_data.data || [],
          };

          // Validate data rows match column count
          if (tableData.data.length > 0) {
            const columnCount = tableData.columns.length;
            const invalidRows = tableData.data.filter(row => row.length !== columnCount);
            if (invalidRows.length > 0) {
              return `Error: All data rows must have ${columnCount} values to match column count`;
            }
          }

          api.updateDataObject(input.data_object_name, tableData, input.updater_skill_id);
          api.updateUI();

          api.showToast(`Data object "${input.data_object_name}" updated`);
          return `Data object "${input.data_object_name}" updated. All subscribed skills have been notified.`;
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

  Data Object Sharing (Advanced):
  * register_table_data_object: Register table data as a shared data object
  * subscribe_table_to_data_object: Subscribe table to an existing data object (auto-updates)
  * unsubscribe_table_from_data_object: Unsubscribe table from a data object
  * update_table_data_object: Update data object (notifies all subscribed skills)
  * Use case: Multiple tables can share the same data - update one, all update automatically
  * Subscriber skills reference the data object (not copies) and get notified of changes

  Sorting:
  * Users can click column headers to sort interactively
  * Programmatic sorting: sort_table_by_column(skill_id, column_index, order="asc"/"desc")
  * Smart sorting: Automatically detects numbers vs text for proper sorting

  Example workflow:
  1. tableContent = create_table(columns=["Name", "Age"], data=[["Alice", "25"], ["Bob", "30"]])
  2. create_skill(type='table', content=tableContent)
  3. add_table_row(skill_id="skill-1", row=["Charlie", "20"])
  4. sort_table_by_column(skill_id="skill-1", column_index=1, order="asc")  # Sort by Age ascending

  Data sharing example:
  1. create_skill(type='table', content=tableContent, altText="Master Table")  # skill-1
  2. register_table_data_object(skill_id="skill-1", data_object_name="shared-data")
  3. create_skill(type='table', content='{"columns":[],"data":[]}', altText="Mirror Table")  # skill-2
  4. subscribe_table_to_data_object(skill_id="skill-2", data_object_name="shared-data")
  5. Now updating shared-data will update both tables automatically!`;
  },
};
