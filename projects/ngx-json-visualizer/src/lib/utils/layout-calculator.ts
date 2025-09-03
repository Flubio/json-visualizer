import type { VisualizerConfig, VisualizerNode } from '../types/visualizer.types'

export interface LayoutPosition {
  nodeId: string
  x: number
  y: number
}

export class LayoutCalculator {
  constructor(private config: VisualizerConfig) { }

  calculateLayout(
    nodes: VisualizerNode[],
    links: Array<{ source: string, target: string }>,
  ): LayoutPosition[] {
    const allNodes = this.flattenNodes(nodes)

    // Use configured layout provider
    const positions = this.config.layoutProvider.calculateLayout(
      allNodes,
      links,
      this.config.layout || {
        nodeSpacing: { x: 200, y: 80 },
        padding: { top: 40, right: 40, bottom: 40, left: 40 },
      },
    )

    return positions
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
    if (panState.zoomLevel === 100 && panState.panX === 0 && panState.panY === 0) {
      return {
        panX: -contentCenterX,
        panY: -contentCenterY,
      }
    }

    return { panX: panState.panX, panY: panState.panY }
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
