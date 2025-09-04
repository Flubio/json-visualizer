import type { VisualizerConfig, VisualizerNode } from '../types/visualizer.types'

export class CollisionDetector {
  constructor(
    private config: VisualizerConfig,
    private getNodeRenderer: (node: VisualizerNode) => any,
  ) { }

  highlightCollisions(draggedNode: VisualizerNode, targetX: number, targetY: number, nodeElements: Map<string, SVGGElement>): void {
    const draggedRenderer = this.getNodeRenderer(draggedNode)
    const draggedStyle = draggedRenderer?.getNodeStyle?.(draggedNode) || { width: 160, height: 40 }
    const draggedWidth = draggedStyle.width || 160
    const draggedHeight = draggedStyle.height || 40
    const margin = 15

    // Clear previous highlights
    this.clearCollisionHighlights(nodeElements)

    for (const otherNode of this.allNodes) {
      if (otherNode.id === draggedNode.id || otherNode.x === undefined || otherNode.y === undefined)
        continue

      const otherRenderer = this.getNodeRenderer(otherNode)
      const otherStyle = otherRenderer?.getNodeStyle?.(otherNode) || { width: 160, height: 40 }
      const otherWidth = otherStyle.width || 160
      const otherHeight = otherStyle.height || 40

      // Check if rectangles would overlap
      if (this.rectanglesOverlap(
        targetX,
        targetY,
        draggedWidth,
        draggedHeight,
        otherNode.x,
        otherNode.y,
        otherWidth,
        otherHeight,
        margin,
      )) {
        // Highlight the conflicting node
        const nodeGroup = nodeElements.get(otherNode.id)
        if (nodeGroup) {
          const rect = nodeGroup.querySelector('.node-rect') as SVGRectElement
          if (rect) {
            rect.style.stroke = '#e53e3e'
            rect.style.strokeWidth = '3'
            rect.classList.add('collision-highlight')
          }
        }
      }
    }
  }

  clearCollisionHighlights(nodeElements: Map<string, SVGGElement>): void {
    nodeElements.forEach((group) => {
      const rect = group.querySelector('.node-rect.collision-highlight') as SVGRectElement
      if (rect) {
        rect.style.stroke = ''
        rect.style.strokeWidth = ''
        rect.classList.remove('collision-highlight')
      }
    })
  }

  resolveInitialCollisions(allNodes: VisualizerNode[]): void {
    const margin = 15
    let hasCollisions = true
    const maxIterations = 100 // Prevent infinite loops
    let iteration = 0

    while (hasCollisions && iteration < maxIterations) {
      hasCollisions = false
      iteration++

      for (let i = 0; i < allNodes.length; i++) {
        const nodeA = allNodes[i]
        if (!nodeA.x || !nodeA.y)
          continue

        const rendererA = this.getNodeRenderer(nodeA)
        const styleA = rendererA?.getNodeStyle?.(nodeA) || { width: 160, height: 40 }
        const widthA = styleA.width || 160
        const heightA = styleA.height || 40

        for (let j = i + 1; j < allNodes.length; j++) {
          const nodeB = allNodes[j]
          if (!nodeB.x || !nodeB.y)
            continue

          const rendererB = this.getNodeRenderer(nodeB)
          const styleB = rendererB?.getNodeStyle?.(nodeB) || { width: 160, height: 40 }
          const widthB = styleB.width || 160
          const heightB = styleB.height || 40

          if (this.rectanglesOverlap(
            nodeA.x,
            nodeA.y,
            widthA,
            heightA,
            nodeB.x,
            nodeB.y,
            widthB,
            heightB,
            margin,
          )) {
            hasCollisions = true
            // Move nodeB to resolve collision
            const validPosition = this.findClosestValidPosition(
              nodeB,
              nodeB.x,
              nodeB.y,
              nodeA.x,
              nodeA.y,
              widthA,
              heightA,
              margin,
            )

            // Check if the new position is actually different and valid
            if (this.isPositionValid(nodeB, validPosition.x, validPosition.y, margin)) {
              nodeB.x = validPosition.x
              nodeB.y = validPosition.y
            }
            else {
              // If we can't find a valid position nearby, move it further away
              nodeB.x = nodeA.x + widthA + margin + 20
              nodeB.y = nodeA.y + Math.random() * 100 - 50
            }
          }
        }
      }
    }

    if (iteration >= maxIterations) {
      console.warn('Maximum collision resolution iterations reached')
    }
  }

  findValidPosition(draggedNode: VisualizerNode, targetX: number, targetY: number): { x: number, y: number } {
    const draggedRenderer = this.getNodeRenderer(draggedNode)
    const draggedStyle = draggedRenderer?.getNodeStyle?.(draggedNode) || { width: 160, height: 40 }
    const draggedWidth = draggedStyle.width || 160
    const draggedHeight = draggedStyle.height || 40
    const margin = 15 // Minimum distance between nodes

    // Snap to grid (optional - can be enabled/disabled)
    const gridSize = 10
    const snappedX = Math.round(targetX / gridSize) * gridSize
    const snappedY = Math.round(targetY / gridSize) * gridSize

    // Check collision with each other node
    for (const otherNode of this.allNodes) {
      if (otherNode.id === draggedNode.id || otherNode.x === undefined || otherNode.y === undefined)
        continue

      const otherRenderer = this.getNodeRenderer(otherNode)
      const otherStyle = otherRenderer?.getNodeStyle?.(otherNode) || { width: 160, height: 40 }
      const otherWidth = otherStyle.width || 160
      const otherHeight = otherStyle.height || 40

      // Check if rectangles would overlap
      if (this.rectanglesOverlap(
        snappedX,
        snappedY,
        draggedWidth,
        draggedHeight,
        otherNode.x,
        otherNode.y,
        otherWidth,
        otherHeight,
        margin,
      )) {
        // Find the closest valid position
        return this.findClosestValidPosition(
          draggedNode,
          snappedX,
          snappedY,
          otherNode.x,
          otherNode.y,
          otherWidth,
          otherHeight,
          margin,
        )
      }
    }

    return { x: snappedX, y: snappedY }
  }

  private rectanglesOverlap(
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    x2: number,
    y2: number,
    w2: number,
    h2: number,
    margin: number = 0,
  ): boolean {
    return !(
      x1 + w1 + margin <= x2
      || x2 + w2 + margin <= x1
      || y1 + h1 + margin <= y2
      || y2 + h2 + margin <= y1
    )
  }

  private findClosestValidPosition(
    draggedNode: VisualizerNode,
    targetX: number,
    targetY: number,
    obstacleX: number,
    obstacleY: number,
    obstacleWidth: number,
    obstacleHeight: number,
    margin: number,
  ): { x: number, y: number } {
    const draggedRenderer = this.getNodeRenderer(draggedNode)
    const draggedStyle = draggedRenderer?.getNodeStyle?.(draggedNode) || { width: 160, height: 40 }
    const draggedWidth = draggedStyle.width || 160
    const draggedHeight = draggedStyle.height || 40

    // Calculate possible positions around the obstacle
    const positions = [
      // Right of obstacle
      { x: obstacleX + obstacleWidth + margin, y: targetY },
      // Left of obstacle
      { x: obstacleX - draggedWidth - margin, y: targetY },
      // Below obstacle
      { x: targetX, y: obstacleY + obstacleHeight + margin },
      // Above obstacle
      { x: targetX, y: obstacleY - draggedHeight - margin },
      // Diagonal positions
      { x: obstacleX + obstacleWidth + margin, y: obstacleY + obstacleHeight + margin },
      { x: obstacleX - draggedWidth - margin, y: obstacleY - draggedHeight - margin },
      { x: obstacleX + obstacleWidth + margin, y: obstacleY - draggedHeight - margin },
      { x: obstacleX - draggedWidth - margin, y: obstacleY + obstacleHeight + margin },
    ]

    // Find the closest valid position
    let closestPosition = { x: targetX, y: targetY }
    let closestDistance = Number.POSITIVE_INFINITY

    for (const pos of positions) {
      const distance = Math.sqrt(
        (pos.x - targetX) ** 2 + (pos.y - targetY) ** 2,
      )

      if (distance < closestDistance && this.isPositionValid(draggedNode, pos.x, pos.y, margin)) {
        closestDistance = distance
        closestPosition = pos
      }
    }

    return closestPosition
  }

  private isPositionValid(node: VisualizerNode, x: number, y: number, margin: number): boolean {
    const renderer = this.getNodeRenderer(node)
    const style = renderer?.getNodeStyle?.(node) || { width: 160, height: 40 }
    const width = style.width || 160
    const height = style.height || 40

    for (const otherNode of this.allNodes) {
      if (otherNode.id === node.id || otherNode.x === undefined || otherNode.y === undefined)
        continue

      const otherRenderer = this.getNodeRenderer(otherNode)
      const otherStyle = otherRenderer?.getNodeStyle?.(otherNode) || { width: 160, height: 40 }
      const otherWidth = otherStyle.width || 160
      const otherHeight = otherStyle.height || 40

      if (this.rectanglesOverlap(x, y, width, height, otherNode.x, otherNode.y, otherWidth, otherHeight, margin)) {
        return false
      }
    }

    return true
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

  // This method needs to be updated to accept all nodes from the component
  setAllNodes(nodes: VisualizerNode[]): void {
    this.allNodes = nodes
  }

  private allNodes: VisualizerNode[] = []
}
