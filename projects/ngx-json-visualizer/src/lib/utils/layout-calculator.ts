import type { VisualizerConfig, VisualizerNode } from '../types/visualizer.types'

export interface LayoutPosition {
  nodeId: string
  x: number
  y: number
}

interface LayoutConstants {
  HORIZONTAL_SPACE: number
  VERTICAL_SPACE: number
  NODE_WIDTH: number
  NODE_HEIGHT: number
}

export class LayoutCalculator {
  private constants: LayoutConstants = {
    HORIZONTAL_SPACE: 250,
    VERTICAL_SPACE: 60,
    NODE_WIDTH: 160,
    NODE_HEIGHT: 40,
  }

  constructor(private config: VisualizerConfig) { }

  calculateLayout(
    nodes: VisualizerNode[],
    _links: Array<{ source: string, target: string }>,
  ): LayoutPosition[] {
    if (nodes.length === 0) {
      return []
    }

    const rootNode = nodes[0]
    const positions: LayoutPosition[] = []

    // Calculate tree positions using the reference algorithm
    this.computeTreePosition(rootNode)
    this.updateTreePosition(rootNode, 100, 100) // Start at top-left with padding

    // Extract positions from nodes
    this.extractPositions(rootNode, positions)

    return positions
  }

  private computeTreePosition(node: VisualizerNode): void {
    if (!node.children || node.children.length === 0) {
      node.childrenHeight = this.constants.NODE_HEIGHT
      return
    }

    // Recursively compute positions for all children first
    for (const child of node.children) {
      this.computeTreePosition(child)
    }

    // Calculate total height needed for all children
    const totalChildrenHeight = node.children.reduce((sum, child) => sum + (child.childrenHeight || this.constants.NODE_HEIGHT), 0)
    const totalVerticalSpace = this.constants.VERTICAL_SPACE * Math.max(0, node.children.length - 1)

    node.childrenHeight = Math.max(totalChildrenHeight + totalVerticalSpace, this.constants.NODE_HEIGHT)
  }

  private updateTreePosition(node: VisualizerNode, x: number, y: number): void {
    // Set position for current node
    node.x = x
    node.y = y

    if (!node.children || node.children.length === 0) {
      return
    }

    // Position children vertically
    let currentY = y - (node.childrenHeight || 0) / 2

    for (const child of node.children) {
      const childHeight = child.childrenHeight || this.constants.NODE_HEIGHT
      const childY = currentY + childHeight / 2

      // Position child to the right of parent
      const childX = x + this.constants.HORIZONTAL_SPACE

      this.updateTreePosition(child, childX, childY)

      // Move to next child position
      currentY += childHeight + this.constants.VERTICAL_SPACE
    }
  }

  private extractPositions(node: VisualizerNode, positions: LayoutPosition[]): void {
    positions.push({
      nodeId: node.id,
      x: node.x || 0,
      y: node.y || 0,
    })

    if (node.children) {
      for (const child of node.children) {
        this.extractPositions(child, positions)
      }
    }
  }

  applyPositionsToNodes(nodes: VisualizerNode[], positions: LayoutPosition[]): void {
    const allNodes = this.flattenNodes(nodes)

    // Apply positions to nodes
    positions.forEach((pos) => {
      const node = allNodes.find(n => n.id === pos.nodeId)
      if (node) {
        node.x = pos.x
        node.y = pos.y
      }
    })
  }

  centerContentInitially(
    nodes: VisualizerNode[],
    panState: { panX: number, panY: number, zoomLevel: number },
  ): { panX: number, panY: number } {
    const allNodes = this.flattenNodes(nodes)

    if (allNodes.length === 0) {
      return { panX: panState.panX, panY: panState.panY }
    }

    const validNodes = allNodes.filter(n => n.x !== undefined && n.y !== undefined)
    if (validNodes.length === 0) {
      return { panX: panState.panX, panY: panState.panY }
    }

    const minX = Math.min(...validNodes.map(n => n.x || 0))
    const maxX = Math.max(...validNodes.map((n) => {
      const renderer = this.config.nodeRenderers.find(r => r.canHandle(n))
      const style = renderer?.getNodeStyle?.(n)
      return (n.x || 0) + (style?.width || 160)
    }))
    const minY = Math.min(...validNodes.map(n => n.y || 0))
    const maxY = Math.max(...validNodes.map((n) => {
      const renderer = this.config.nodeRenderers.find(r => r.canHandle(n))
      const style = renderer?.getNodeStyle?.(n)
      return (n.y || 0) + (style?.height || 40)
    }))

    // Calculate content center
    const contentCenterX = (minX + maxX) / 2
    const contentCenterY = (minY + maxY) / 2

    // Center the content on first render if zoom hasn't been modified
    if (panState.zoomLevel === 150 && panState.panX === 0 && panState.panY === 0) {
      return {
        panX: -contentCenterX,
        panY: -contentCenterY,
      }
    }

    return { panX: panState.panX, panY: panState.panY }
  }

  reorderConnectedNodes(
    movedNode: VisualizerNode,
    allNodes: VisualizerNode[],
    links: Array<{ source: string, target: string }>,
  ): void {
    // Find nodes connected to the moved node
    const connectedNodeIds = new Set<string>()

    links.forEach((link) => {
      if (link.source === movedNode.id) {
        connectedNodeIds.add(link.target)
      }
      if (link.target === movedNode.id) {
        connectedNodeIds.add(link.source)
      }
    })

    // Get connected nodes
    const connectedNodes = allNodes.filter(n => connectedNodeIds.has(n.id))

    // Only reorder if we have connected nodes and the movement is significant
    if (connectedNodes.length === 0 || !movedNode.x || !movedNode.y) {
      return
    }

    // For each connected node, adjust its position to maintain better spacing
    connectedNodes.forEach((connectedNode) => {
      if (!connectedNode.x || !connectedNode.y)
        return

      // Calculate the link connecting these nodes
      const isSourceToTarget = links.some(l => l.source === movedNode.id && l.target === connectedNode.id)
      const isTargetToSource = links.some(l => l.target === movedNode.id && l.source === connectedNode.id)

      if (isSourceToTarget) {
        // movedNode is parent of connectedNode - keep connectedNode to the right
        const targetX = (movedNode.x || 0) + this.constants.HORIZONTAL_SPACE
        const targetY = (movedNode.y || 0)

        // Smoothly interpolate towards target position
        connectedNode.x = this.lerp(connectedNode.x, targetX, 0.1)
        connectedNode.y = this.lerp(connectedNode.y, targetY, 0.1)
      }
      else if (isTargetToSource) {
        // connectedNode is parent of movedNode - maintain spacing but don't override moved position
        // This could be extended to adjust sibling spacing if needed
      }
    })
  }

  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor
  }

  private flattenNodes(nodes: VisualizerNode[]): VisualizerNode[] {
    const result: VisualizerNode[] = []

    const flatten = (nodeList: VisualizerNode[]) => {
      nodeList.forEach((node) => {
        result.push(node)
        if (node.children) {
          flatten(node.children)
        }
      })
    }

    flatten(nodes)
    return result
  }
}
