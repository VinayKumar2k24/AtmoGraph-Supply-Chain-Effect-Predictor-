import dagre from 'dagre';

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 85;

/**
 * Calculates a clean, non-overlapping hierarchical layout for the supply chain graph
 * using Dagre based on actual graph connections and directionality.
 *
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @returns {Array} Updated nodes with calculated {x, y} coordinates
 */
export function getHierarchicalLayout(nodes = [], edges = []) {
  if (!nodes || nodes.length === 0) return nodes;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: 'TB',
    align: 'DL',
    nodesep: 90,
    ranksep: 140,
    marginx: 60,
    marginy: 60,
  });

  // Register nodes with bounding boxes
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  });

  // Register edges
  (edges || []).forEach((edge) => {
    if (edge.source && edge.target) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  // Map calculated coordinates back to React Flow nodes (top-left centered)
  return nodes.map((node) => {
    const nodeWithPos = dagreGraph.node(node.id);
    if (!nodeWithPos) return node;

    return {
      ...node,
      position: {
        x: Math.round(nodeWithPos.x - NODE_WIDTH / 2),
        y: Math.round(nodeWithPos.y - NODE_HEIGHT / 2),
      },
    };
  });
}
