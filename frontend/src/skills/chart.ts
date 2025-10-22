import { Skill, SkillHandler, ScratchpadAPI, ToolDefinition } from './types';
import { Chart } from 'chart.js';

// Chart data structure
interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'doughnut';
  labels: string[];
  datasets: ChartDataset[];
  _data_object_name?: string; // Metadata for auto-subscription
}

// Parse chart content
function parseChartContent(content: string): ChartData {
  try {
    return JSON.parse(content);
  } catch (error) {
    // Return empty chart if parsing fails
    return { type: 'bar', labels: [], datasets: [] };
  }
}

// Auto-generate color palette
const COLOR_PALETTE = [
  { bg: 'rgba(75, 192, 192, 0.6)', border: 'rgba(75, 192, 192, 1)' },
  { bg: 'rgba(255, 99, 132, 0.6)', border: 'rgba(255, 99, 132, 1)' },
  { bg: 'rgba(54, 162, 235, 0.6)', border: 'rgba(54, 162, 235, 1)' },
  { bg: 'rgba(255, 206, 86, 0.6)', border: 'rgba(255, 206, 86, 1)' },
  { bg: 'rgba(153, 102, 255, 0.6)', border: 'rgba(153, 102, 255, 1)' },
  { bg: 'rgba(255, 159, 64, 0.6)', border: 'rgba(255, 159, 64, 1)' },
];

function getDatasetColor(index: number) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

// Convert table format to chart format
function convertTableToChart(tableData: any, chartType: ChartData['type']): Omit<ChartData, '_data_object_name'> {
  if (!tableData.columns || !tableData.data || tableData.data.length === 0) {
    return { type: chartType, labels: [], datasets: [] };
  }

  // First column becomes labels
  const labels = tableData.data.map((row: any[]) => String(row[0]));

  // Remaining columns become datasets
  const datasets: ChartDataset[] = [];
  for (let i = 1; i < tableData.columns.length; i++) {
    const color = getDatasetColor(i - 1);
    datasets.push({
      label: tableData.columns[i],
      data: tableData.data.map((row: any[]) => parseFloat(row[i]) || 0),
      backgroundColor: color.bg,
      borderColor: color.border,
      borderWidth: 2,
    });
  }

  return { type: chartType, labels, datasets };
}

// Helper: Update chart data (either via data object or directly)
function updateChartData(skill: Skill, newChartData: ChartData, api: ScratchpadAPI, skillId: string): void {
  // Check if this chart is subscribed to a data object
  let dataObjectName = skill.dataObjectSubscriptions?.[0];

  // Fallback: check metadata in content
  if (!dataObjectName && newChartData._data_object_name) {
    dataObjectName = newChartData._data_object_name;
  }

  if (dataObjectName && api.hasDataObject(dataObjectName)) {
    // Update this skill's content first (since we'll be skipped in notification)
    const contentWithMeta = {
      ...newChartData,
      _data_object_name: dataObjectName
    };
    skill.content = JSON.stringify(contentWithMeta);

    // Update the data object (notifies OTHER subscribed skills)
    const cleanData = {
      type: newChartData.type,
      labels: newChartData.labels,
      datasets: newChartData.datasets
    };
    api.updateDataObject(dataObjectName, cleanData, skillId);

    // Trigger re-render
    api.updateUI();
  } else {
    // No data object subscription - update skill content directly
    skill.content = JSON.stringify(newChartData);
    api.notifyContentUpdated(skillId);
  }
}

// Generate unique chart ID
let chartIdCounter = 1;
function generateChartId(): string {
  return `chart-canvas-${chartIdCounter++}`;
}

// Generate unique data object name
let dataObjectCounter = 1;
function generateDataObjectName(): string {
  return `chart-data-${dataObjectCounter++}`;
}

export const chartSkill: SkillHandler = {
  type: 'chart',

  onDataObjectUpdated: (skill: Skill, dataObjectName: string, newData: any) => {
    // Check if this is table data (needs conversion) or chart data
    const isTableData = newData.columns !== undefined && newData.data !== undefined;

    if (isTableData) {
      // Convert table format to chart format
      const currentChartData = parseChartContent(skill.content);
      const chartData = convertTableToChart(newData, currentChartData.type);

      // Preserve metadata
      const contentWithMeta = {
        ...chartData,
        _data_object_name: dataObjectName
      };
      skill.content = JSON.stringify(contentWithMeta);
    } else {
      // Already chart data, just preserve metadata
      const contentWithMeta = {
        ...newData,
        _data_object_name: dataObjectName
      };
      skill.content = JSON.stringify(contentWithMeta);
    }
  },

  render: async (skill: Skill): Promise<string> => {
    const chartData = parseChartContent(skill.content);
    const chartId = generateChartId();

    // Store chart data in data attribute
    const dataAttr = JSON.stringify(chartData).replace(/"/g, '&quot;');

    return `
      <div class="skill-content chart-skill">
        <div class="chart-container" style="position: relative; width: 100%; height: 400px;">
          <canvas id="${chartId}" class="chart-canvas" data-chart='${dataAttr}'></canvas>
        </div>
      </div>
    `;
  },

  generateDescription: (skill: Skill): string => {
    const chartData = parseChartContent(skill.content);
    const datasetCount = chartData.datasets.length;
    const labelCount = chartData.labels.length;
    return `${chartData.type} chart: ${datasetCount} dataset${datasetCount !== 1 ? 's' : ''}, ${labelCount} label${labelCount !== 1 ? 's' : ''}`;
  },

  getContentAsMarkdown: (skill: Skill): string => {
    const chartData = parseChartContent(skill.content);
    let md = `## ${chartData.type.charAt(0).toUpperCase() + chartData.type.slice(1)} Chart\n\n`;
    md += `**Labels:** ${chartData.labels.join(', ')}\n\n`;

    chartData.datasets.forEach((dataset, i) => {
      md += `**Dataset ${i + 1}: ${dataset.label}**\n`;
      md += `Data: ${dataset.data.join(', ')}\n\n`;
    });

    return md;
  },

  getTools: (api: ScratchpadAPI): ToolDefinition[] => {
    return [
      {
        name: 'create_chart',
        description: 'Creates a new chart with specified type, labels, and datasets. ALWAYS creates or references a data object - every chart is backed by one. Can also reference existing table data objects for auto-conversion.',
        parameters: {
          type: 'object',
          properties: {
            chart_type: {
              type: 'string',
              enum: ['line', 'bar', 'pie', 'doughnut'],
              description: 'Type of chart: line, bar, pie, or doughnut',
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of labels for X-axis or categories (e.g., ["Jan", "Feb", "Mar"]). Optional if data_object_name references existing data.',
            },
            datasets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  data: {
                    type: 'array',
                    items: { type: 'number' }
                  }
                }
              },
              description: 'Array of datasets with label and data arrays. Colors auto-generated. Optional if data_object_name references existing data.',
            },
            data_object_name: {
              type: 'string',
              description: 'Optional: Name for the data object. If it exists (table or chart), uses that data. If not provided, auto-generates a unique name.',
            },
          },
          required: [],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          let chartData: ChartData;
          let dataObjectName: string;
          const chartType = (input.chart_type || 'bar') as ChartData['type'];

          // Case 1: data_object_name provided and exists
          if (input.data_object_name && api.hasDataObject(input.data_object_name)) {
            dataObjectName = input.data_object_name;
            const existingData = api.getDataObject(dataObjectName);

            // Check if it's table data (needs conversion) or chart data
            const isTableData = existingData.columns !== undefined;

            if (isTableData) {
              // Convert table format to chart format
              const converted = convertTableToChart(existingData, chartType);
              chartData = {
                ...converted,
                _data_object_name: dataObjectName
              };
            } else {
              // Already chart data
              chartData = {
                ...existingData,
                type: chartType, // Use specified chart type
                _data_object_name: dataObjectName
              };
            }

            return JSON.stringify(chartData) + `\n\n[Using data from existing data object "${dataObjectName}". Chart will auto-subscribe when created.]`;
          }

          // Case 2 & 3: Create new chart data
          if (!input.labels || !input.datasets) {
            return 'Error: labels and datasets are required when creating new chart data';
          }

          // Auto-assign colors to datasets
          const datasets = input.datasets.map((ds: any, i: number) => {
            const color = getDatasetColor(i);
            return {
              label: ds.label,
              data: ds.data,
              backgroundColor: color.bg,
              borderColor: color.border,
              borderWidth: 2,
            };
          });

          chartData = {
            type: chartType,
            labels: input.labels,
            datasets: datasets,
          };

          // Determine data object name
          dataObjectName = input.data_object_name || generateDataObjectName();

          // Register the data object
          const dataToRegister = {
            type: chartData.type,
            labels: chartData.labels,
            datasets: chartData.datasets
          };
          api.registerDataObject(dataObjectName, 'chartdata', dataToRegister);

          // Return chart content with metadata
          const chartDataWithMeta = {
            ...chartData,
            _data_object_name: dataObjectName
          };

          const wasAutoGenerated = !input.data_object_name;
          const message = wasAutoGenerated
            ? `\n\n[Auto-created data object "${dataObjectName}". Chart will auto-subscribe when created.]`
            : `\n\n[Registered as data object "${dataObjectName}". Chart will auto-subscribe when created.]`;

          return JSON.stringify(chartDataWithMeta) + message;
        },
      },
      {
        name: 'update_chart_dataset',
        description: 'Updates an existing dataset in a chart by index.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the chart (e.g., "skill-1")',
            },
            dataset_index: {
              type: 'number',
              description: 'Zero-based index of the dataset to update (0 for first dataset)',
            },
            data: {
              type: 'array',
              items: { type: 'number' },
              description: 'New data array for the dataset',
            },
            label: {
              type: 'string',
              description: 'Optional: New label for the dataset',
            },
          },
          required: ['skill_id', 'dataset_index', 'data'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'chart') {
            return `Skill ${input.skill_id} is not a chart skill (type: ${skill.type})`;
          }

          const chartData = parseChartContent(skill.content);

          if (input.dataset_index < 0 || input.dataset_index >= chartData.datasets.length) {
            return `Error: Dataset index ${input.dataset_index} out of range (0-${chartData.datasets.length - 1})`;
          }

          chartData.datasets[input.dataset_index].data = input.data;
          if (input.label) {
            chartData.datasets[input.dataset_index].label = input.label;
          }

          updateChartData(skill, chartData, api, input.skill_id);

          api.showToast(`Dataset ${input.dataset_index} updated`);
          return `Dataset ${input.dataset_index} updated successfully`;
        },
      },
      {
        name: 'add_chart_dataset',
        description: 'Adds a new dataset to an existing chart.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the chart (e.g., "skill-1")',
            },
            label: {
              type: 'string',
              description: 'Label for the new dataset',
            },
            data: {
              type: 'array',
              items: { type: 'number' },
              description: 'Data array for the new dataset',
            },
          },
          required: ['skill_id', 'label', 'data'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'chart') {
            return `Skill ${input.skill_id} is not a chart skill (type: ${skill.type})`;
          }

          const chartData = parseChartContent(skill.content);
          const color = getDatasetColor(chartData.datasets.length);

          chartData.datasets.push({
            label: input.label,
            data: input.data,
            backgroundColor: color.bg,
            borderColor: color.border,
            borderWidth: 2,
          });

          updateChartData(skill, chartData, api, input.skill_id);

          api.showToast(`Dataset added`);
          return `Dataset "${input.label}" added. Chart now has ${chartData.datasets.length} datasets.`;
        },
      },
      {
        name: 'remove_chart_dataset',
        description: 'Removes a dataset from a chart by index.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the chart (e.g., "skill-1")',
            },
            dataset_index: {
              type: 'number',
              description: 'Zero-based index of the dataset to remove (0 for first dataset)',
            },
          },
          required: ['skill_id', 'dataset_index'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'chart') {
            return `Skill ${input.skill_id} is not a chart skill (type: ${skill.type})`;
          }

          const chartData = parseChartContent(skill.content);

          if (input.dataset_index < 0 || input.dataset_index >= chartData.datasets.length) {
            return `Error: Dataset index ${input.dataset_index} out of range (0-${chartData.datasets.length - 1})`;
          }

          const removed = chartData.datasets.splice(input.dataset_index, 1)[0];

          updateChartData(skill, chartData, api, input.skill_id);

          api.showToast(`Dataset removed`);
          return `Dataset "${removed.label}" removed. Chart now has ${chartData.datasets.length} datasets.`;
        },
      },
      {
        name: 'update_chart_labels',
        description: 'Updates the labels (X-axis or categories) of a chart.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the chart (e.g., "skill-1")',
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'New array of labels',
            },
          },
          required: ['skill_id', 'labels'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'chart') {
            return `Skill ${input.skill_id} is not a chart skill (type: ${skill.type})`;
          }

          const chartData = parseChartContent(skill.content);
          chartData.labels = input.labels;

          updateChartData(skill, chartData, api, input.skill_id);

          api.showToast(`Labels updated`);
          return `Labels updated. Chart now has ${input.labels.length} labels.`;
        },
      },
      {
        name: 'set_dataset_colors',
        description: 'Sets custom colors for a dataset.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the chart (e.g., "skill-1")',
            },
            dataset_index: {
              type: 'number',
              description: 'Zero-based index of the dataset (0 for first dataset)',
            },
            background_color: {
              type: 'string',
              description: 'Background color (CSS color, e.g., "rgba(255,99,132,0.6)" or "#FF6384")',
            },
            border_color: {
              type: 'string',
              description: 'Border color (CSS color)',
            },
          },
          required: ['skill_id', 'dataset_index', 'background_color', 'border_color'],
          additionalProperties: true,
        },
        execute: async (input: any) => {
          const skill = api.getSkillById(input.skill_id);
          if (!skill) {
            return `Skill ${input.skill_id} not found`;
          }
          if (skill.type !== 'chart') {
            return `Skill ${input.skill_id} is not a chart skill (type: ${skill.type})`;
          }

          const chartData = parseChartContent(skill.content);

          if (input.dataset_index < 0 || input.dataset_index >= chartData.datasets.length) {
            return `Error: Dataset index ${input.dataset_index} out of range (0-${chartData.datasets.length - 1})`;
          }

          chartData.datasets[input.dataset_index].backgroundColor = input.background_color;
          chartData.datasets[input.dataset_index].borderColor = input.border_color;

          updateChartData(skill, chartData, api, input.skill_id);

          api.showToast(`Colors updated`);
          return `Colors updated for dataset ${input.dataset_index}`;
        },
      },
      {
        name: 'look_at_chart',
        description: 'Sends a chart to you as an image for visual analysis. The chart is rendered and sent directly so you can SEE it and describe what it shows. Use this when you need to visually analyze or describe a chart.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description: 'The skill ID of the chart (e.g., "skill-1")',
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
          if (skill.type !== 'chart') {
            return `Skill ${input.skill_id} is not a chart skill (type: ${skill.type})`;
          }

          try {
            const result = await chartSkill.getImage!(skill);
            return result; // Returns {type: 'image', data: base64, mediaType: 'image/png'}
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return `Failed to get chart image: ${errorMessage}`;
          }
        },
      },
    ];
  },

  getImage: async (skill: Skill, _imageIndex: number = 1): Promise<{ type: string; data: string; mediaType: string }> => {
    const chartData = parseChartContent(skill.content);

    // Create a temporary canvas element to render the chart
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context for chart rendering');
    }

    // Create a Chart.js instance on the temporary canvas
    const chart = new Chart(ctx, {
      type: chartData.type,
      data: {
        labels: chartData.labels,
        datasets: chartData.datasets,
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false, // Disable animations for immediate rendering
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
        },
      },
    });

    // Wait for chart to render
    await new Promise(resolve => setTimeout(resolve, 100));

    // Extract image data from canvas
    const dataURL = canvas.toDataURL('image/png');

    // Clean up: destroy the chart instance
    chart.destroy();

    // Parse the data URL to extract base64 data
    const match = dataURL.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Failed to extract image data from chart canvas');
    }

    return {
      type: 'image',
      data: match[2], // Base64 string without prefix
      mediaType: match[1], // e.g., 'image/png'
    };
  },

  getInstructions: (): string => {
    return `- 'chart': Interactive charts powered by Chart.js 4.5.1
  * Support for line, bar, pie, and doughnut charts
  * Responsive design with auto-scaling
  * Auto-generated color palettes
  * Can subscribe to table data objects for auto-conversion
  * Every chart is backed by a data object (single source of truth)

  Chart Management Tools:
  * create_chart: Create chart with type, labels, and datasets
    - IMPORTANT: ALWAYS creates or references a data object (every chart is backed by one)
    - If data_object_name provided and exists: uses data from that data object
    - If data_object_name references table: auto-converts table format to chart format
    - If data_object_name not provided: auto-generates a unique data object name
    - Charts automatically subscribe to their data objects on creation
    - Colors auto-generated from nice palette
  * update_chart_dataset: Update dataset values by index
  * add_chart_dataset: Add new dataset to chart
  * remove_chart_dataset: Remove dataset by index
  * update_chart_labels: Update chart labels (X-axis or categories)
  * set_dataset_colors: Set custom colors for a dataset
  * look_at_chart(skill_id): Sends the chart to you as an image for visual analysis
    - IMPORTANT: The chart is rendered as PNG and sent directly so you can SEE it
    - Use when you need to visually analyze or describe what a chart shows
    - Example: look_at_chart("skill-1") to see the chart as an image

  Basic workflow (auto-created data object):
  1. content = create_chart(chart_type='bar', labels=['Q1','Q2','Q3'], datasets=[{label:'Sales', data:[100,150,120]}])
     # Auto-creates data object "chart-data-1"
  2. create_skill(type='chart', content=content)  # skill-1 (auto-subscribes to "chart-data-1")
  3. update_chart_dataset(skill_id='skill-1', dataset_index=0, data=[110,160,130])
     # Updates "chart-data-1" → all subscribed charts update

  Chart from table data (auto-conversion):
  1. First create a table with data object: create_table(columns=['Month','Sales','Profit'], data=[['Jan',100,20],['Feb',150,30]], data_object_name='sales-data')
  2. create_skill(type='table', content=...)  # Create table
  3. chartContent = create_chart(chart_type='line', data_object_name='sales-data')
     # Auto-converts: First column → labels, remaining columns → datasets
  4. create_skill(type='chart', content=chartContent)  # Chart shows table data!
  5. Update table → chart updates automatically!

  Key benefits:
  - Every chart has a data object backing it
  - All chart operations update the data object (not individual charts)
  - Can subscribe to table data with automatic conversion
  - Auto-generated colors for professional appearance`;
  },
};
