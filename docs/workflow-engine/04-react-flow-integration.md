# React Flow Integration Guide

This document explains how to integrate the workflow engine with React Flow for visual workflow building.

---

## Overview

React Flow provides the visual interface where users can:
- Drag and drop nodes from a palette
- Connect nodes to define workflow logic
- Configure node properties
- View live execution status
- Export/import YAML workflows

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Flow Editor                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Canvas   │  │   Palette  │  │   Config   │            │
│  │            │  │            │  │   Panel    │            │
│  │  [Nodes &  │  │  [Drag to  │  │            │            │
│  │   Edges]   │  │   add]     │  │  [Props]   │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│ ReactFlow Adapter│  │   Registry   │  │ YAML Parser  │
└──────────────────┘  └──────────────┘  └──────────────┘
         │                    │                    │
         └────────────────────┴────────────────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  BehaviorTree    │
                  │  (Execution)     │
                  └──────────────────┘
```

---

## Installation

```bash
npm install reactflow
npm install @xyflow/react
```

---

## React Flow Adapter

**File**: `src/integrations/react-flow/adapter.ts`

```typescript
import type { Node, Edge } from 'reactflow';
import { BehaviorTree } from '../../behavior-tree.js';
import type { Registry } from '../../registry.js';
import type { TreeNode } from '../../types.js';

export class ReactFlowAdapter {
  /**
   * Convert BehaviorTree to React Flow format
   */
  static toReactFlow(tree: BehaviorTree, registry: Registry): {
    nodes: Node[];
    edges: Edge[];
  } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let edgeId = 0;
    
    // Traverse tree and build nodes/edges
    this.traverseTree(tree.getRoot(), null, nodes, edges, registry, edgeId);
    
    return { nodes, edges };
  }
  
  /**
   * Traverse tree recursively
   */
  private static traverseTree(
    node: TreeNode,
    parentId: string | null,
    nodes: Node[],
    edges: Edge[],
    registry: Registry,
    edgeId: number
  ): void {
    const metadata = registry.getMetadata(node.type);
    const config = (node as any).config || {};
    
    // Create React Flow node
    const rfNode: Node = {
      id: node.id,
      type: node.type,
      position: config.position || { x: 0, y: 0 },
      data: {
        label: node.name,
        icon: (metadata as any)?.icon || 'circle',
        color: config.color || (metadata as any)?.color || '#666',
        config: config,
        inputs: (metadata as any)?.inputs || [],
        outputs: (metadata as any)?.outputs || [],
        status: node.status()
      }
    };
    
    nodes.push(rfNode);
    
    // Create edge from parent
    if (parentId) {
      edges.push({
        id: `edge-${edgeId++}`,
        source: parentId,
        target: node.id,
        type: 'smoothstep'
      });
    }
    
    // Process children
    if (node.children) {
      for (const child of node.children) {
        this.traverseTree(child, node.id, nodes, edges, registry, edgeId);
      }
    }
  }
  
  /**
   * Convert React Flow format to BehaviorTree
   */
  static fromReactFlow(
    nodes: Node[],
    edges: Edge[],
    registry: Registry
  ): BehaviorTree {
    // Build node map
    const nodeMap = new Map<string, TreeNode>();
    
    for (const rfNode of nodes) {
      const treeNode = registry.create(rfNode.type, {
        id: rfNode.id,
        name: rfNode.data.label,
        position: rfNode.position,
        color: rfNode.data.color,
        ...rfNode.data.config
      });
      nodeMap.set(rfNode.id, treeNode);
    }
    
    // Build tree structure from edges
    const graph = this.buildGraph(edges);
    const rootId = this.findRoot(graph, nodes);
    const root = nodeMap.get(rootId);
    
    if (!root) {
      throw new Error(`Root node '${rootId}' not found`);
    }
    
    // Attach children
    this.attachChildren(root, graph, nodeMap);
    
    return new BehaviorTree(root);
  }
  
  /**
   * Build adjacency list from edges
   */
  private static buildGraph(edges: Edge[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const edge of edges) {
      const children = graph.get(edge.source) || [];
      children.push(edge.target);
      graph.set(edge.source, children);
    }
    
    return graph;
  }
  
  /**
   * Find root node (no incoming edges)
   */
  private static findRoot(graph: Map<string, string[]>, nodes: Node[]): string {
    const inDegree = new Map<string, number>();
    
    // Initialize all nodes with 0
    for (const node of nodes) {
      if (!inDegree.has(node.id)) {
        inDegree.set(node.id, 0);
      }
    }
    
    // Count incoming edges
    for (const children of graph.values()) {
      for (const child of children) {
        inDegree.set(child, (inDegree.get(child) || 0) + 1);
      }
    }
    
    // Find nodes with no incoming edges
    const roots = Array.from(inDegree.entries())
      .filter(([_, degree]) => degree === 0)
      .map(([nodeId]) => nodeId);
    
    if (roots.length === 0) {
      throw new Error('No root node found (circular dependency?)');
    }
    
    if (roots.length > 1) {
      throw new Error(`Multiple root nodes found: ${roots.join(', ')}`);
    }
    
    return roots[0];
  }
  
  /**
   * Recursively attach children
   */
  private static attachChildren(
    node: TreeNode,
    graph: Map<string, string[]>,
    nodeMap: Map<string, TreeNode>
  ): void {
    const childIds = graph.get(node.id) || [];
    
    if (childIds.length === 0) return;
    
    const children = childIds.map(id => nodeMap.get(id)!);
    
    // Attach based on node type
    if ('setChild' in node && typeof node.setChild === 'function') {
      if (children.length !== 1) {
        throw new Error(`Decorator ${node.id} must have exactly one child`);
      }
      (node as any).setChild(children[0]);
    } else if ('addChildren' in node && typeof node.addChildren === 'function') {
      (node as any).addChildren(children);
    }
    
    // Recurse
    for (const child of children) {
      this.attachChildren(child, graph, nodeMap);
    }
  }
}
```

---

## React Components

### Main Workflow Editor

```typescript
// components/WorkflowEditor.tsx
import React, { useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection
} from 'reactflow';
import 'reactflow/dist/style.css';

import { NodePalette } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import { CustomNode } from './CustomNode';
import type { Registry } from '@wayfarer-ai/btree';

const nodeTypes = {
  Sequence: CustomNode,
  Selector: CustomNode,
  Parallel: CustomNode,
  HttpRequest: CustomNode,
  Script: CustomNode,
  // ... register all node types
};

interface WorkflowEditorProps {
  registry: Registry;
  onSave?: (nodes: Node[], edges: Edge[]) => void;
}

export function WorkflowEditor({ registry, onSave }: WorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  
  // Handle new connections
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );
  
  // Handle node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
    },
    []
  );
  
  // Handle node drag from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);
  
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      const type = event.dataTransfer.getData('application/reactflow');
      const metadata = registry.getMetadata(type);
      
      if (!metadata) return;
      
      const position = {
        x: event.clientX,
        y: event.clientY
      };
      
      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: (metadata as any).displayName || type,
          icon: (metadata as any).icon,
          color: (metadata as any).color,
          config: {}
        }
      };
      
      setNodes((nds) => nds.concat(newNode));
    },
    [registry, setNodes]
  );
  
  // Handle node config update
  const onNodeConfigUpdate = useCallback(
    (nodeId: string, config: any) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, config } }
            : node
        )
      );
    },
    [setNodes]
  );
  
  // Handle save
  const handleSave = useCallback(() => {
    onSave?.(nodes, edges);
  }, [nodes, edges, onSave]);
  
  return (
    <div className="workflow-editor" style={{ height: '100vh', display: 'flex' }}>
      {/* Node Palette */}
      <NodePalette registry={registry} />
      
      {/* Main Canvas */}
      <div style={{ flex: 1 }}>
        <div style={{ padding: '10px' }}>
          <button onClick={handleSave}>Save Workflow</button>
        </div>
        
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      
      {/* Config Panel */}
      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onUpdate={(config) => onNodeConfigUpdate(selectedNode.id, config)}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
```

### Node Palette

```typescript
// components/NodePalette.tsx
import React from 'react';
import type { Registry } from '@wayfarer-ai/btree';

interface NodePaletteProps {
  registry: Registry;
}

export function NodePalette({ registry }: NodePaletteProps) {
  const categories = registry.getCategories();
  
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };
  
  return (
    <div className="node-palette" style={{ width: '250px', borderRight: '1px solid #ddd', overflow: 'auto' }}>
      <div style={{ padding: '10px' }}>
        <h3>Nodes</h3>
        
        {categories.map(({ category, count }) => {
          const nodes = registry.getNodesByCategory(category);
          
          return (
            <div key={category} style={{ marginBottom: '20px' }}>
              <h4>{category} ({count})</h4>
              
              {nodes.map((metadata) => (
                <div
                  key={metadata.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, metadata.type)}
                  style={{
                    padding: '8px',
                    margin: '4px 0',
                    backgroundColor: (metadata as any).color || '#666',
                    color: 'white',
                    borderRadius: '4px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>{(metadata as any).icon || '○'}</span>
                  <span>{(metadata as any).displayName || metadata.type}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Custom Node Component

```typescript
// components/CustomNode.tsx
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export const CustomNode = memo(({ data }: { data: any }) => {
  return (
    <div
      style={{
        padding: '10px 20px',
        borderRadius: '8px',
        backgroundColor: data.color || '#666',
        color: 'white',
        border: '2px solid',
        borderColor: data.status === 'RUNNING' ? '#ff9800' :
                     data.status === 'SUCCESS' ? '#4caf50' :
                     data.status === 'FAILURE' ? '#f44336' : '#666',
        minWidth: '150px'
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{data.icon || '○'}</span>
        <strong>{data.label}</strong>
      </div>
      
      {data.status && (
        <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
          {data.status}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});
```

### Node Config Panel

```typescript
// components/NodeConfigPanel.tsx
import React, { useState } from 'react';
import type { Node } from 'reactflow';

interface NodeConfigPanelProps {
  node: Node;
  onUpdate: (config: any) => void;
  onClose: () => void;
}

export function NodeConfigPanel({ node, onUpdate, onClose }: NodeConfigPanelProps) {
  const [config, setConfig] = useState(node.data.config || {});
  
  const handleChange = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onUpdate(newConfig);
  };
  
  return (
    <div className="config-panel" style={{
      width: '300px',
      borderLeft: '1px solid #ddd',
      padding: '20px',
      overflow: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3>Configure Node</h3>
        <button onClick={onClose}>×</button>
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label>
          <strong>Name</strong>
          <input
            type="text"
            value={node.data.label}
            onChange={(e) => {
              node.data.label = e.target.value;
            }}
            style={{ width: '100%', marginTop: '5px', padding: '5px' }}
          />
        </label>
      </div>
      
      {/* Render config fields based on node type */}
      {node.type === 'HttpRequest' && (
        <>
          <div style={{ marginBottom: '15px' }}>
            <label>
              <strong>URL</strong>
              <input
                type="text"
                value={config.url || ''}
                onChange={(e) => handleChange('url', e.target.value)}
                style={{ width: '100%', marginTop: '5px', padding: '5px' }}
                placeholder="https://api.example.com"
              />
            </label>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label>
              <strong>Method</strong>
              <select
                value={config.method || 'GET'}
                onChange={(e) => handleChange('method', e.target.value)}
                style={{ width: '100%', marginTop: '5px', padding: '5px' }}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </label>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label>
              <strong>Request Body (JSON)</strong>
              <textarea
                value={JSON.stringify(config.body || {}, null, 2)}
                onChange={(e) => {
                  try {
                    handleChange('body', JSON.parse(e.target.value));
                  } catch {
                    // Invalid JSON, don't update
                  }
                }}
                style={{ width: '100%', marginTop: '5px', padding: '5px', minHeight: '100px', fontFamily: 'monospace' }}
              />
            </label>
          </div>
        </>
      )}
      
      {node.type === 'Script' && (
        <div style={{ marginBottom: '15px' }}>
          <label>
            <strong>Script</strong>
            <textarea
              value={config.textContent || ''}
              onChange={(e) => handleChange('textContent', e.target.value)}
              style={{ width: '100%', marginTop: '5px', padding: '5px', minHeight: '200px', fontFamily: 'monospace' }}
              placeholder="# Write your script here"
            />
          </label>
        </div>
      )}
      
      {/* Add more node-specific config fields */}
    </div>
  );
}
```

---

## Live Execution Visualization

```typescript
// hooks/useWorkflowExecution.ts
import { useEffect, useState } from 'react';
import { WorkflowEngine, NodeEventType, NodeStatus } from '@wayfarer-ai/btree';
import type { BehaviorTree } from '@wayfarer-ai/btree';

export function useWorkflowExecution(workflow: BehaviorTree) {
  const [executionState, setExecutionState] = useState<{
    running: Set<string>;
    completed: Map<string, NodeStatus>;
    errors: Map<string, string>;
  }>({
    running: new Set(),
    completed: new Map(),
    errors: new Map()
  });
  
  const [engine, setEngine] = useState<WorkflowEngine | null>(null);
  
  useEffect(() => {
    const wfEngine = new WorkflowEngine(workflow, {
      treeRegistry: registry,
      eventEmitter: new NodeEventEmitter()
    });
    
    // Subscribe to execution events
    wfEngine.options.eventEmitter?.on(NodeEventType.TICK_START, (event) => {
      setExecutionState(prev => ({
        ...prev,
        running: new Set([...prev.running, event.nodeId])
      }));
    });
    
    wfEngine.options.eventEmitter?.on(NodeEventType.TICK_END, (event) => {
      setExecutionState(prev => {
        const running = new Set(prev.running);
        running.delete(event.nodeId);
        
        const completed = new Map(prev.completed);
        completed.set(event.nodeId, event.data.status);
        
        return { ...prev, running, completed };
      });
    });
    
    wfEngine.options.eventEmitter?.on(NodeEventType.ERROR, (event) => {
      setExecutionState(prev => {
        const errors = new Map(prev.errors);
        errors.set(event.nodeId, event.data.error);
        return { ...prev, errors };
      });
    });
    
    setEngine(wfEngine);
    
    return () => {
      wfEngine.halt();
    };
  }, [workflow]);
  
  return {
    executionState,
    start: (input?: any) => engine?.execute(input),
    pause: () => engine?.halt(),
    reset: () => {
      engine?.reset();
      setExecutionState({
        running: new Set(),
        completed: new Map(),
        errors: new Map()
      });
    }
  };
}
```

**Use in component**:
```typescript
const { executionState, start, pause, reset } = useWorkflowExecution(workflow);

// Update node colors based on execution state
useEffect(() => {
  setNodes((nds) =>
    nds.map((node) => ({
      ...node,
      data: {
        ...node.data,
        status: executionState.running.has(node.id) ? 'RUNNING' :
                executionState.completed.get(node.id) || 'IDLE'
      }
    }))
  );
}, [executionState]);
```

---

## Import/Export

### Export to YAML

```typescript
import { YamlSerializer } from '@wayfarer-ai/btree';

function exportToYaml(nodes: Node[], edges: Edge[]) {
  // Convert to BehaviorTree
  const tree = ReactFlowAdapter.fromReactFlow(nodes, edges, registry);
  
  // Serialize to YAML
  const serializer = new YamlSerializer();
  const yaml = serializer.serialize(tree, metadata);
  
  // Download
  const blob = new Blob([yaml], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'workflow.yaml';
  a.click();
}
```

### Import from YAML

```typescript
import { YamlParser } from '@wayfarer-ai/btree';

function importFromYaml(yamlString: string) {
  // Parse YAML
  const parser = new YamlParser(registry);
  const { tree, metadata } = parser.parse(yamlString);
  
  // Convert to React Flow format
  const { nodes, edges } = ReactFlowAdapter.toReactFlow(tree, registry);
  
  setNodes(nodes);
  setEdges(edges);
}
```

---

## Best Practices

### 1. Use Custom Handles for Typed Connections

```typescript
<Handle
  type="source"
  position={Position.Bottom}
  id="success"
  style={{ background: '#4caf50' }}
/>
<Handle
  type="source"
  position={Position.Bottom}
  id="failure"
  style={{ background: '#f44336' }}
/>
```

### 2. Validate Connections

```typescript
const isValidConnection = (connection: Connection) => {
  const sourceNode = nodes.find(n => n.id === connection.source);
  const targetNode = nodes.find(n => n.id === connection.target);
  
  // Prevent self-connections
  if (connection.source === connection.target) return false;
  
  // Decorator nodes can only have one child
  if (sourceNode?.type === 'Retry' && 
      edges.some(e => e.source === connection.source)) {
    return false;
  }
  
  return true;
};
```

### 3. Auto-Layout

Use dagre for automatic layout:

```typescript
import dagre from 'dagre';

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB' });
  
  nodes.forEach(node => {
    dagreGraph.setNode(node.id, { width: 150, height: 50 });
  });
  
  edges.forEach(edge => {
    dagreGraph.setEdge(edge.source, edge.target);
  });
  
  dagre.layout(dagreGraph);
  
  const layoutedNodes = nodes.map(node => {
    const position = dagreGraph.node(node.id);
    return { ...node, position: { x: position.x, y: position.y } };
  });
  
  return { nodes: layoutedNodes, edges };
}
```

---

## Summary

The React Flow integration provides:
- Visual workflow building with drag-and-drop
- Real-time execution visualization
- Node configuration UI
- YAML import/export
- Auto-layout capabilities

All while maintaining full compatibility with the core btree engine.
