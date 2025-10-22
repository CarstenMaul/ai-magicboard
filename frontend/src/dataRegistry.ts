// Data object interface
export interface DataObject {
  name: string;           // Unique identifier (e.g., "table-1-data")
  type: string;           // Type hint (e.g., "tabledata", "chartdata")
  data: any;              // The actual data
  subscribers: string[];  // Array of skill IDs subscribed to this data
}

// Type for update callback
type UpdateCallback = (dataObjectName: string, newData: any) => void;

// Global data registry for sharing data between skills
class DataRegistry {
  private dataObjects: Map<string, DataObject> = new Map();
  private updateCallbacks: Map<string, UpdateCallback> = new Map(); // key: skillId

  /**
   * Register a new data object in the registry
   */
  registerDataObject(name: string, type: string, initialData: any): void {
    if (this.dataObjects.has(name)) {
      console.warn(`[DataRegistry] Data object "${name}" already exists. Updating data.`);
      const existing = this.dataObjects.get(name)!;
      existing.data = initialData;
      existing.type = type;
      return;
    }

    this.dataObjects.set(name, {
      name,
      type,
      data: initialData,
      subscribers: [],
    });

    console.log(`[DataRegistry] Registered data object: ${name} (type: ${type})`);
  }

  /**
   * Subscribe a skill to a data object
   * @param dataObjectName - Name of the data object to subscribe to
   * @param skillId - ID of the subscribing skill
   * @param onUpdate - Callback function to call when data changes
   */
  subscribe(dataObjectName: string, skillId: string, onUpdate: UpdateCallback): void {
    const dataObject = this.dataObjects.get(dataObjectName);
    if (!dataObject) {
      console.error(`[DataRegistry] Cannot subscribe: data object "${dataObjectName}" not found`);
      return;
    }

    // Add subscriber if not already subscribed
    if (!dataObject.subscribers.includes(skillId)) {
      dataObject.subscribers.push(skillId);
      console.log(`[DataRegistry] Skill ${skillId} subscribed to ${dataObjectName}`);
    }

    // Store callback for this skill
    this.updateCallbacks.set(skillId, onUpdate);
  }

  /**
   * Unsubscribe a skill from a data object
   * Auto-deletes data object if no subscribers remain
   */
  unsubscribe(dataObjectName: string, skillId: string): void {
    const dataObject = this.dataObjects.get(dataObjectName);
    if (!dataObject) return;

    // Remove from subscribers
    dataObject.subscribers = dataObject.subscribers.filter(id => id !== skillId);
    console.log(`[DataRegistry] Skill ${skillId} unsubscribed from ${dataObjectName}`);

    // Auto-cleanup: delete data object if no subscribers remain
    if (dataObject.subscribers.length === 0) {
      this.dataObjects.delete(dataObjectName);
      console.log(`[DataRegistry] Deleted data object ${dataObjectName} (no subscribers)`);
    }

    // Remove callback
    this.updateCallbacks.delete(skillId);
  }

  /**
   * Unsubscribe a skill from ALL data objects
   * Called when a skill is deleted
   */
  unsubscribeAll(skillId: string): void {
    console.log(`[DataRegistry] Unsubscribing skill ${skillId} from all data objects`);

    // Find all data objects this skill is subscribed to
    const subscriptions: string[] = [];
    this.dataObjects.forEach((dataObject) => {
      if (dataObject.subscribers.includes(skillId)) {
        subscriptions.push(dataObject.name);
      }
    });

    // Unsubscribe from each
    subscriptions.forEach(dataObjectName => {
      this.unsubscribe(dataObjectName, skillId);
    });

    // Remove callback
    this.updateCallbacks.delete(skillId);
  }

  /**
   * Update a data object and notify subscribers
   * @param dataObjectName - Name of the data object
   * @param newData - New data to set
   * @param updaterSkillId - Optional: ID of skill making the update (won't be notified to prevent loops)
   */
  updateData(dataObjectName: string, newData: any, updaterSkillId?: string): void {
    const dataObject = this.dataObjects.get(dataObjectName);
    if (!dataObject) {
      console.error(`[DataRegistry] Cannot update: data object "${dataObjectName}" not found`);
      return;
    }

    // Update data
    dataObject.data = newData;
    console.log(`[DataRegistry] Updated data object: ${dataObjectName}`, updaterSkillId ? `(by ${updaterSkillId})` : '');

    // Notify all subscribers except the updater
    dataObject.subscribers.forEach(skillId => {
      if (skillId === updaterSkillId) {
        console.log(`[DataRegistry] Skipping notification to updater: ${skillId}`);
        return; // Skip notifying the skill that made the update
      }

      const callback = this.updateCallbacks.get(skillId);
      if (callback) {
        console.log(`[DataRegistry] Notifying subscriber: ${skillId}`);
        callback(dataObjectName, newData);
      }
    });
  }

  /**
   * Get data from a data object
   */
  getData(dataObjectName: string): any {
    const dataObject = this.dataObjects.get(dataObjectName);
    return dataObject?.data;
  }

  /**
   * Check if a data object exists
   */
  hasDataObject(dataObjectName: string): boolean {
    return this.dataObjects.has(dataObjectName);
  }

  /**
   * Get all data object names (for debugging/inspection)
   */
  getAllDataObjectNames(): string[] {
    return Array.from(this.dataObjects.keys());
  }

  /**
   * Get data object info (for debugging)
   */
  getDataObjectInfo(dataObjectName: string): DataObject | undefined {
    return this.dataObjects.get(dataObjectName);
  }
}

// Export singleton instance
export const dataRegistry = new DataRegistry();
