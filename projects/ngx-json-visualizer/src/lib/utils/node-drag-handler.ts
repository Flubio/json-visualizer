import type { VisualizerConfig, VisualizerNode } from '../types/visualizer.types'

export interface DragState {
  isDragging: boolean
  draggedNode: VisualizerNode | null
  dragOffset: { x: number, y: number }
  nodeElements: Map<string, SVGGElement>
  svgElement: SVGSVGElement | null
  animationId: number | null
}

export class NodeDragHandler {
  private dragState: DragState = {
    isDragging: false,
    draggedNode: null,
    dragOffset: { x: 0, y: 0 },
    nodeElements: new Map(),
    svgElement: null,
    animationId: null,
  }

  private allNodes: VisualizerNode[] = []
  private links: Array<{ source: string, target: string }> = []
  private layoutCalculator: any // Use any to avoid circular dependency

  constructor(
    private config: VisualizerConfig,
    private collisionDetector: any, // Use any to avoid circular dependency
    private svgRenderer: any, // Use any to avoid circular dependency
    private panState: { panX: number, panY: number, zoomLevel: number },
  ) { }

  addNodeDragListeners(rect: SVGRectElement, node: VisualizerNode): void {
    // Only add drag listeners if dragging is enabled
    if (!this.config.enableDragging) {
      return
    }

    rect.addEventListener('mousedown', (event) => {
      event.stopPropagation() // Prevent panning
      this.startNodeDrag(event, node)
    })
  }

  private startNodeDrag(event: MouseEvent, node: VisualizerNode): void {
    this.dragState.isDragging = true
    this.dragState.draggedNode = node

    const svg = event.target as Element
    const svgElement = svg.closest('svg') as SVGSVGElement
    this.dragState.svgElement = svgElement

    const rect = svgElement.getBoundingClientRect()

    // Calculate mouse position in SVG coordinates
    const mouseX = (event.clientX - rect.left - this.panState.panX) / (this.panState.zoomLevel / 100)
    const mouseY = (event.clientY - rect.top - this.panState.panY) / (this.panState.zoomLevel / 100)

    // Calculate offset from mouse to node's current position
    this.dragState.dragOffset = {
      x: mouseX - (node.x || 0),
      y: mouseY - (node.y || 0),
    }

    // Record drag start time to prevent early collision checks
    this.dragStartTime = Date.now()
    this.lastNodePosition = null // Reset position smoothing

    // Add visual feedback for dragging
    this.addDragVisualFeedback(node)

    // Add global listeners for mouse move and up
    // Listen on window to catch events outside SVG/document
    window.addEventListener('mousemove', this.onNodeDrag)
    window.addEventListener('mouseup', this.onNodeDragEnd)
    window.addEventListener('mouseleave', this.onNodeDragEnd)

    event.preventDefault()
  }

  private addDragVisualFeedback(node: VisualizerNode): void {
    const nodeGroup = this.dragState.nodeElements.get(node.id)
    if (nodeGroup) {
      nodeGroup.style.filter = 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4))'
      nodeGroup.style.opacity = '0.9'
    }
  }

  private removeDragVisualFeedback(node: VisualizerNode): void {
    const nodeGroup = this.dragState.nodeElements.get(node.id)
    if (nodeGroup) {
      nodeGroup.style.filter = ''
      nodeGroup.style.opacity = '1'
    }
  }

  private lastMousePosition: { x: number, y: number } | null = null
  private lastCollisionCheck = 0
  private collisionCheckInterval = 50 // Increase interval to reduce jitter from collision adjustments
  private dragStartTime = 0
  private initialDragThreshold = 100 // Don't check collisions for first 100ms of drag
  private lastNodePosition: { x: number, y: number } | null = null
  private positionSmoothing = 0.3 // Small amount of smoothing to reduce jitter

  private onNodeDrag = (event: MouseEvent): void => {
    // Check if left mouse button is still pressed
    if ((event.buttons & 1) === 0) {
      this.onNodeDragEnd()
      return
    }

    if (!this.dragState.isDragging || !this.dragState.draggedNode || !this.dragState.svgElement) {
      return
    }

    const rect = this.dragState.svgElement.getBoundingClientRect()

    // Calculate mouse position in SVG coordinates
    const mouseX = (event.clientX - rect.left - this.panState.panX) / (this.panState.zoomLevel / 100)
    const mouseY = (event.clientY - rect.top - this.panState.panY) / (this.panState.zoomLevel / 100)

    // Store the latest mouse position
    this.lastMousePosition = { x: mouseX, y: mouseY }

    // Cancel previous animation frame if it exists
    if (this.dragState.animationId) {
      cancelAnimationFrame(this.dragState.animationId)
    }

    // Use requestAnimationFrame for smooth updates
    this.dragState.animationId = requestAnimationFrame(() => {
      if (this.lastMousePosition && this.dragState.draggedNode) {
        // Position node so the mouse cursor stays at the same relative position on the node
        const newX = this.lastMousePosition.x - this.dragState.dragOffset.x
        const newY = this.lastMousePosition.y - this.dragState.dragOffset.y

        // Check for collisions less frequently for better performance
        const now = Date.now()
        let finalX = newX
        let finalY = newY

        if (now - this.lastCollisionCheck > this.collisionCheckInterval
          && now - this.dragStartTime > this.initialDragThreshold) {
          // Check collisions and find valid position
          const validPosition = this.collisionDetector.findValidPosition(this.dragState.draggedNode, newX, newY)
          finalX = validPosition.x
          finalY = validPosition.y
          this.lastCollisionCheck = now

          // Highlight collisions for visual feedback
          this.collisionDetector.highlightCollisions(this.dragState.draggedNode, newX, newY, this.dragState.nodeElements)
        }

        // Apply position smoothing to reduce jitter
        if (this.lastNodePosition) {
          finalX = this.lastNodePosition.x + (finalX - this.lastNodePosition.x) * this.positionSmoothing
          finalY = this.lastNodePosition.y + (finalY - this.lastNodePosition.y) * this.positionSmoothing
        }
        this.lastNodePosition = { x: finalX, y: finalY }

        // Update position
        this.dragState.draggedNode.x = finalX
        this.dragState.draggedNode.y = finalY

        // Ensure the position is also updated in the allNodes array
        const nodeInAllNodes = this.allNodes.find(n => n.id === this.dragState.draggedNode!.id)
        if (nodeInAllNodes) {
          nodeInAllNodes.x = finalX
          nodeInAllNodes.y = finalY
          console.error('Updated node position in allNodes:', nodeInAllNodes.id, finalX, finalY)
        }
        else {
          console.error('Could not find node in allNodes array:', this.dragState.draggedNode!.id)
        }

        // Update visual representation immediately for smooth movement
        this.updateNodePositionDirect(this.dragState.draggedNode)
      }
      this.dragState.animationId = null
    })
  }

  private onNodeDragEnd = (): void => {
    // Cancel any pending animation frame
    if (this.dragState.animationId) {
      cancelAnimationFrame(this.dragState.animationId)
      this.dragState.animationId = null
    }

    if (this.dragState.draggedNode) {
      // Remove visual feedback
      this.removeDragVisualFeedback(this.dragState.draggedNode)

      // Update links after drag is complete for better performance
      this.svgRenderer.updateLinks(this.allNodes, this.links)

      // Trigger reordering of connected nodes for better layout
      if (this.layoutCalculator && this.allNodes && this.links) {
        this.layoutCalculator.reorderConnectedNodes(
          this.dragState.draggedNode,
          this.allNodes,
          this.links,
        )
        // Update positions for reordered nodes and refresh links
        this.svgRenderer.updateLinks(this.allNodes, this.links)
      }

      // Final link update to ensure all connections are properly rendered
      setTimeout(() => this.svgRenderer.updateLinks(this.allNodes, this.links), 16)
    }

    // Clear collision highlights
    this.collisionDetector.clearCollisionHighlights(this.dragState.nodeElements)

    this.dragState.isDragging = false
    this.dragState.draggedNode = null
    this.dragState.svgElement = null
    this.lastMousePosition = null
    this.lastNodePosition = null // Reset position smoothing

    // Remove global listeners
    window.removeEventListener('mousemove', this.onNodeDrag)
    window.removeEventListener('mouseup', this.onNodeDragEnd)
    window.removeEventListener('mouseleave', this.onNodeDragEnd)
  }

  private lastLinkUpdate = 0
  private linkUpdateThrottle = 100 // ms between updates

  private updateNodePositionDirect(node: VisualizerNode): void {
    const group = this.dragState.nodeElements.get(node.id)
    if (!group || node.x === undefined || node.y === undefined) {
      return
    }

    // Move the whole group using transform - this is the fastest way
    group.setAttribute('transform', `translate(${node.x}, ${node.y})`)

    // Throttle link updates to avoid performance issues
    const now = Date.now()
    if (now - this.lastLinkUpdate > this.linkUpdateThrottle) {
      this.svgRenderer.updateLinks(this.allNodes, this.links)
      this.lastLinkUpdate = now
    }
  }

  private updateNodePosition(node: VisualizerNode): void {
    const group = this.dragState.nodeElements.get(node.id)
    if (!group || node.x === undefined || node.y === undefined) {
      return
    }

    // Move the whole group using transform
    group.setAttribute('transform', `translate(${node.x}, ${node.y})`)

    // Update auto-layout elements
    const rect = group.querySelector('.node-rect') as SVGRectElement
    const autoElems = group.querySelectorAll('.auto-layout')

    const width = rect ? Number.parseFloat(rect.getAttribute('width') || '160') : 160
    const height = rect ? Number.parseFloat(rect.getAttribute('height') || '40') : 40

    autoElems.forEach((el, index) => {
      const elText = el as SVGTextElement
      elText.setAttribute('x', String(width / 2))
      const yOffset = autoElems.length > 1 ? (index === 0 ? -5 : 12) : 0
      elText.setAttribute('y', String(height / 2 + yOffset))
    })
    // Update connected links
    this.svgRenderer.updateLinks(this.allNodes, this.links)
  }

  isDragging(): boolean {
    return this.dragState.isDragging
  }

  isDraggingEnabled(): boolean {
    return this.config.enableDragging ?? true
  }

  setNodeElements(nodeElements: Map<string, SVGGElement>): void {
    this.dragState.nodeElements = nodeElements
  }

  updatePanState(panX: number, panY: number, zoomLevel: number): void {
    this.panState.panX = panX
    this.panState.panY = panY
    this.panState.zoomLevel = zoomLevel
  }

  setAllNodes(allNodes: VisualizerNode[]): void {
    this.allNodes = allNodes
  }

  setLinks(links: Array<{ source: string, target: string }>): void {
    this.links = links
  }

  setLayoutCalculator(layoutCalculator: any): void {
    this.layoutCalculator = layoutCalculator
  }
}
