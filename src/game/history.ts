import { ConveyorConnection, MachineNode } from './types';

export interface HistorySnapshot {
  nodes: MachineNode[];
  connections: ConveyorConnection[];
  description: string;
}

const MAX_HISTORY_STEPS = 40;

type HistoryListener = () => void;

export class FactoryHistoryManager {
  private undoStack: HistorySnapshot[] = [];
  private redoStack: HistorySnapshot[] = [];
  private listeners: Set<HistoryListener> = new Set();
  private maxSteps: number;

  constructor(maxSteps: number = MAX_HISTORY_STEPS) {
    this.maxSteps = maxSteps;
  }

  public subscribe(listener: HistoryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private cloneGraph(nodes: MachineNode[], connections: ConveyorConnection[]) {
    return {
      nodes: JSON.parse(JSON.stringify(nodes)) as MachineNode[],
      connections: JSON.parse(JSON.stringify(connections)) as ConveyorConnection[],
    };
  }

  /**
   * Pushes a new snapshot onto the undo stack. Clears the redo stack.
   */
  public pushSnapshot(
    nodes: MachineNode[],
    connections: ConveyorConnection[],
    description: string
  ) {
    const cloned = this.cloneGraph(nodes, connections);
    this.undoStack.push({
      nodes: cloned.nodes,
      connections: cloned.connections,
      description,
    });
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.notify();
  }

  /**
   * Undoes the last action, restoring previous nodes and connections.
   */
  public undo(
    currentNodes: MachineNode[],
    currentConnections: ConveyorConnection[]
  ): { nodes: MachineNode[]; connections: ConveyorConnection[]; description: string } | null {
    if (this.undoStack.length === 0) return null;
    const target = this.undoStack.pop()!;
    const currentCloned = this.cloneGraph(currentNodes, currentConnections);

    this.redoStack.push({
      nodes: currentCloned.nodes,
      connections: currentCloned.connections,
      description: target.description,
    });

    this.notify();
    return {
      nodes: target.nodes,
      connections: target.connections,
      description: target.description,
    };
  }

  /**
   * Redoes the last undone action.
   */
  public redo(
    currentNodes: MachineNode[],
    currentConnections: ConveyorConnection[]
  ): { nodes: MachineNode[]; connections: ConveyorConnection[]; description: string } | null {
    if (this.redoStack.length === 0) return null;
    const target = this.redoStack.pop()!;
    const currentCloned = this.cloneGraph(currentNodes, currentConnections);

    this.undoStack.push({
      nodes: currentCloned.nodes,
      connections: currentCloned.connections,
      description: target.description,
    });

    this.notify();
    return {
      nodes: target.nodes,
      connections: target.connections,
      description: target.description,
    };
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getUndoDescription(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.description ?? null;
  }

  public getRedoDescription(): string | null {
    return this.redoStack[this.redoStack.length - 1]?.description ?? null;
  }

  public clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}

export const factoryHistory = new FactoryHistoryManager();
