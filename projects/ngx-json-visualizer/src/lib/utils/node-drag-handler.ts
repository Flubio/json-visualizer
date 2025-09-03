import type { VisualizerConfig, VisualizerNode } from '../types/visualizer.types'

export interface DragState {
  isDragging: boolean
  draggedNode: VisualizerNode | null
  dragOffset: { x: number, y: number }
  nodeElements: Map<string, SVGGElement>
}

export class NodeDragHandler {
  private dragState: DragState = {
    isDragging: false,
    draggedNode: null,
    dragOffset: { x: 0, y: 0 },
    nodeElements: new Map(),
  }

  constructor(
    private config: VisualizerConfig,
    private collisionDetector: any, // Use any to avoid circular dependency
    private svgRenderer: any, // Use any to avoid circular dependency
    private panState: { panX: number, panY: number, zoomLevel: number },
  ) { }

  addNodeDragListeners(rect: SVGRectElement, node: VisualizerNode): void {
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
    const rect = svgElement.getBoundingClientRect()

    // Calculate mouse position in SVG coordinates
    const mouseX = (event.clientX - rect.left - this.panState.panX) / (this.panState.zoomLevel / 100)
    const mouseY = (event.clientY - rect.top - this.panState.panY) / (this.panState.zoomLevel / 100)

    this.dragState.dragOffset = {
      x: mouseX - (node.x || 0),
      y: mouseY - (node.y || 0),
    }

    // Add visual feedback for dragging
    this.addDragVisualFeedback(node)

    // Add global listeners for mouse move and up
    document.addEventListener('mousemove', this.onNodeDrag)
    document.addEventListener('mouseup', this.onNodeDragEnd)

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

  private onNodeDrag = (event: MouseEvent): void => {
    if (!this.dragState.isDragging || !this.dragState.draggedNode)
      return

    const svg = document.querySelector('svg') as SVGSVGElement
    const rect = svg.getBoundingClientRect()

    // Calculate new position in SVG coordinates
    const mouseX = (event.clientX - rect.left - this.panState.panX) / (this.panState.zoomLevel / 100)
    const mouseY = (event.clientY - rect.top - this.panState.panY) / (this.panState.zoomLevel / 100)

    const newX = mouseX - this.dragState.dragOffset.x
    const newY = mouseY - this.dragState.dragOffset.y

    // Check for collisions with other nodes and highlight them
    this.collisionDetector.highlightCollisions(this.dragState.draggedNode, newX, newY, this.dragState.nodeElements)

    // Find valid position considering collisions
    const validPosition = this.collisionDetector.findValidPosition(this.dragState.draggedNode, newX, newY)

    // Update node position
    this.dragState.draggedNode.x = validPosition.x
    this.dragState.draggedNode.y = validPosition.y

    // Update visual representation
    this.updateNodePosition(this.dragState.draggedNode)
  }

  private onNodeDragEnd = (): void => {
    if (this.dragState.draggedNode) {
      // Remove visual feedback
      this.removeDragVisualFeedback(this.dragState.draggedNode)
    }

    // Clear collision highlights
    this.collisionDetector.clearCollisionHighlights(this.dragState.nodeElements)

    this.dragState.isDragging = false
    this.dragState.draggedNode = null

    // Remove global listeners
    document.removeEventListener('mousemove', this.onNodeDrag)
    document.removeEventListener('mouseup', this.onNodeDragEnd)
  }

  private updateNodePosition(node: VisualizerNode): void {
    const group = this.dragState.nodeElements.get(node.id)
    if (!group || node.x === undefined || node.y === undefined)
      return

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
    this.svgRenderer.updateLinks()
  }

  isDragging(): boolean {
    return this.dragState.isDragging
  }

  setNodeElements(nodeElements: Map<string, SVGGElement>): void {
    this.dragState.nodeElements = nodeElements
  }

  updatePanState(panX: number, panY: number, zoomLevel: number): void {
    this.panState.panX = panX
    this.panState.panY = panY
    this.panState.zoomLevel = zoomLevel
  }
}
