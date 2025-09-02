import type { ElementRef, OnChanges, OnDestroy, OnInit } from '@angular/core'
import type { VisualizerConfig, VisualizerNode } from './types/visualizer.types'
import { CommonModule } from '@angular/common'
import { Component, Input, ViewChild } from '@angular/core'
import { createDefaultConfig } from './providers/preset-configs'

@Component({
  selector: 'ngx-json-visualizer',
  imports: [CommonModule],
  template: `
    <div class="json-visualizer">
      <svg #svgContainer
           class="visualization-svg"
           (wheel)="onWheel($event)"
           (mousedown)="onMouseDown($event)"
           (mousemove)="onMouseMove($event)"
           (mouseup)="onMouseUp()"
           (mouseleave)="onMouseLeave()">
        <g #contentGroup class="content-group"></g>
      </svg>

      <!-- Zoom Controls (optional) -->
      <div class="zoom-controls" *ngIf="currentConfig?.enableZooming">
        <button class="zoom-btn" (click)="zoomIn()" title="Zoom In">+</button>
        <span class="zoom-level">{{ (zoomLevel) | number:'1.0-0' }}%</span>
        <button class="zoom-btn" (click)="zoomOut()" title="Zoom Out">-</button>
        <button class="zoom-btn" (click)="resetZoom()" title="Reset Zoom">⌂</button>
      </div>

      <!-- Smooth Zoom Indicator -->
      <div #zoomIndicator class="zoom-indicator">
        {{ (zoomLevel) | number:'1.0-0' }}%
      </div>
    </div>
  `,
  styles: [`
    .json-visualizer {
      background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
      overflow: hidden;
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 8px;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .visualization-svg {
      background: transparent;
      cursor: grab;
      width: 100%;
      height: 100%;
      transition: cursor 0.15s ease;
    }

    .visualization-svg.panning {
      cursor: grabbing;
    }

    .content-group {
      transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .content-group.smooth-pan {
      transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    .zoom-controls {
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 12px;
      padding: 10px 12px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1), 0 3px 10px rgba(0, 0, 0, 0.08);
      backdrop-filter: blur(16px);
      transform: translateY(0);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .zoom-controls:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .zoom-btn {
      background: transparent;
      border: none;
      border-radius: 8px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-weight: 600;
      color: #4a5568;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 16px;
      position: relative;
      overflow: hidden;
    }

    .zoom-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle, rgba(74, 85, 104, 0.1) 0%, transparent 70%);
      transform: scale(0);
      transition: transform 0.2s ease;
    }

    .zoom-btn:hover {
      background: rgba(74, 85, 104, 0.08);
      color: #2d3748;
      transform: scale(1.05);
    }

    .zoom-btn:hover::before {
      transform: scale(1);
    }

    .zoom-btn:active {
      background: rgba(74, 85, 104, 0.15);
      transform: scale(0.95);
    }

    .zoom-level {
      font-size: 13px;
      color: #4a5568;
      font-weight: 600;
      min-width: 40px;
      text-align: center;
      padding: 0 4px;
      background: rgba(74, 85, 104, 0.05);
      border-radius: 6px;
      line-height: 1.4;
    }

    /* Node styles with animations */
    .node-rect {
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    }

    .node-rect:hover {
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
      transform: translateY(-1px);
    }

    .node-text {
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Open Sans', 'Helvetica Neue', sans-serif;
    }

    .node-name {
      font-weight: 600;
      letter-spacing: 0.025em;
    }

    .node-value {
      font-weight: 500;
      opacity: 0.9;
    }

    .entity-name {
      font-weight: 600;
      font-size: 13px;
    }

    .entity-type {
      font-weight: 400;
      font-size: 10px;
      opacity: 0.8;
    }

    .entity-value {
      font-weight: 700;
      font-size: 12px;
    }

    .container-name {
      font-weight: 700;
      font-size: 14px;
    }

    .child-count {
      font-weight: 500;
      font-size: 10px;
      opacity: 0.7;
    }

    /* Link styles */
    .visualization-link {
      transition: all 0.2s ease;
      stroke-width: 1.5;
      opacity: 0.6;
    }

    .visualization-link:hover {
      opacity: 1;
      stroke-width: 2;
    }

    /* Smooth zoom indicator */
    .zoom-indicator {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .zoom-indicator.show {
      opacity: 1;
    }

    :global(.node-rect) {
      cursor: move;
      transition: all 0.2s ease;
    }

    :global(.node-rect:hover) {
      fill-opacity: 0.8;
      stroke-width: 2;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    }

    :global(.node-rect:active) {
      cursor: grabbing;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
    }

    :global(.node-rect.collision-highlight) {
      stroke: #e53e3e !important;
      stroke-width: 3 !important;
      animation: pulse 0.5s infinite alternate;
    }

    @keyframes pulse {
      from {
        stroke-opacity: 0.7;
      }
      to {
        stroke-opacity: 1;
      }
    }

    :global(.node-text) {
      font-size: 12px;
      font-family: monospace;
      fill: #2d3748;
      pointer-events: none;
      user-select: none;
    }

    :global(.link-line) {
      stroke: #a0aec0;
      stroke-width: 1;
      fill: none;
    }

    :global(.device-name) {
      font-weight: bold;
    }

    :global(.device-type) {
      font-size: 10px;
      fill: #a0aec0;
    }

    :global(.device-value) {
      font-weight: bold;
      fill: #48bb78;
    }

    :global(.tenant-name) {
      font-weight: bold;
    }

    :global(.child-count) {
      font-size: 10px;
      fill: #a0aec0;
    }
  `],
})
export class JsonVisualizerComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('svgContainer', { static: true }) svgRef!: ElementRef<SVGSVGElement>
  @ViewChild('contentGroup', { static: true }) contentGroupRef!: ElementRef<SVGGElement>
  @ViewChild('zoomIndicator', { static: true }) zoomIndicatorRef!: ElementRef<HTMLDivElement>
  @Input() data: any = null
  @Input() config: VisualizerConfig | null = null
  @Input() width = 800
  @Input() height = 600

  private nodes: VisualizerNode[] = []
  private links: Array<{ source: string, target: string }> = []
  currentConfig!: VisualizerConfig

  // Zoom and pan state
  zoomLevel = 100
  private minZoom = 10
  private maxZoom = 1000
  private panX = 0
  private panY = 0
  private isPanning = false
  private lastPanPoint = { x: 0, y: 0 }

  // Smooth panning state
  private panVelocity = { x: 0, y: 0 }
  private lastPanTime = 0
  private panHistory: Array<{ x: number, y: number, time: number }> = []
  private momentumAnimationId: number | null = null
  private readonly velocityDecay = 0.92
  private readonly minVelocity = 0.1
  private zoomIndicatorTimeout: number | null = null

  // Node dragging state
  private isDraggingNode = false
  private draggedNode: VisualizerNode | null = null
  private dragOffset = { x: 0, y: 0 }
  private nodeElements = new Map<string, SVGGElement>()

  ngOnInit(): void {
    this.currentConfig = this.config || createDefaultConfig()
    this.render()
  }

  ngOnChanges(): void {
    this.currentConfig = this.config || createDefaultConfig()
    this.render()
  }

  ngOnDestroy(): void {
    // Clean up any active drag listeners
    if (this.isDraggingNode) {
      document.removeEventListener('mousemove', this.onNodeDrag)
      document.removeEventListener('mouseup', this.onNodeDragEnd)
    }

    // Clean up momentum animation
    if (this.momentumAnimationId) {
      cancelAnimationFrame(this.momentumAnimationId)
      this.momentumAnimationId = null
    }

    // Clean up zoom indicator timeout
    if (this.zoomIndicatorTimeout) {
      clearTimeout(this.zoomIndicatorTimeout)
      this.zoomIndicatorTimeout = null
    }
  }

  private render(): void {
    if (!this.data)
      return

    // Clear previous content
    const svg = this.svgRef.nativeElement
    svg.innerHTML = ''

    try {
      // Transform data using configured transformer
      this.transformData()

      // Calculate layout using configured layout provider
      this.calculateLayout()

      // Render visualization
      this.renderVisualization()
    }
    catch (error) {
      console.error('Error rendering visualization:', error)
      this.renderError(svg, 'Failed to render visualization')
    }
  }

  private transformData(): void {
    this.nodes = []
    this.links = []

    const context = {
      // Remove maxDepth to enable infinite depth traversal
      maxDepth: undefined,
      valueProvider: this.currentConfig.valueProvider,
    }

    // Clear any circular reference tracking from previous transforms
    if ('processedObjects' in this.currentConfig.dataTransformer) {
      (this.currentConfig.dataTransformer as any).processedObjects = new WeakSet()
    }

    // Use the configured data transformer
    const transformedNodes = this.currentConfig.dataTransformer.transform(
      this.data,
      0,
      'root',
      context,
    )

    this.nodes = transformedNodes
    this.generateLinks(this.nodes)
  }

  private generateLinks(nodes: VisualizerNode[]): void {
    nodes.forEach((node) => {
      if (node.children) {
        node.children.forEach((child) => {
          this.links.push({
            source: node.id,
            target: child.id,
          })
        })
        // Recursively process children
        this.generateLinks(node.children)
      }
    })
  }

  private calculateLayout(): void {
    const allNodes = this.flattenNodes(this.nodes)

    // Use configured layout provider
    const positions = this.currentConfig.layoutProvider.calculateLayout(
      allNodes,
      this.links,
      this.currentConfig.layout || {
        nodeSpacing: { x: 200, y: 80 },
        padding: { top: 40, right: 40, bottom: 40, left: 40 },
      },
    )

    // Apply positions to nodes
    positions.forEach((pos) => {
      const node = allNodes.find(n => n.id === pos.nodeId)
      if (node) {
        node.x = pos.x
        node.y = pos.y
      }
    })

    // Apply collision detection to initial layout
    this.resolveInitialCollisions(allNodes)
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

  private renderVisualization(): void {
    const svg = this.svgRef.nativeElement
    const contentGroup = this.contentGroupRef.nativeElement
    const allNodes = this.flattenNodes(this.nodes)

    // Clear previous content
    svg.innerHTML = ''

    // Re-add content group
    svg.appendChild(contentGroup)
    contentGroup.innerHTML = ''

    // Create defs for arrowheads and styles
    this.setupSvgDefs(svg)

    // Render links first (so they appear behind nodes)
    this.renderLinks(contentGroup, allNodes)

    // Render nodes using configured renderers
    this.renderNodes(contentGroup, allNodes)

    // Update SVG dimensions
    this.updateSvgDimensions(svg, allNodes)

    // Apply current zoom and pan transformation
    this.updateTransform()
  }

  private setupSvgDefs(svg: SVGSVGElement): void {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')

    // Arrowhead marker
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker')
    marker.setAttribute('id', 'arrowhead')
    marker.setAttribute('markerWidth', '10')
    marker.setAttribute('markerHeight', '7')
    marker.setAttribute('refX', '9')
    marker.setAttribute('refY', '3.5')
    marker.setAttribute('orient', 'auto')

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7')
    polygon.setAttribute('fill', this.currentConfig.theme?.link?.stroke || '#a0aec0')

    marker.appendChild(polygon)
    defs.appendChild(marker)
    svg.appendChild(defs)
  }

  private renderLinks(container: SVGElement, allNodes: VisualizerNode[]): void {
    this.links.forEach((link) => {
      const sourceNode = allNodes.find(n => n.id === link.source)
      const targetNode = allNodes.find(n => n.id === link.target)

      if (sourceNode && targetNode && sourceNode.x !== undefined && targetNode.x !== undefined) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        line.classList.add('link-line')

        // Calculate connection points based on node style
        const sourceStyle = this.getNodeRenderer(sourceNode)?.getNodeStyle?.(sourceNode)
        const targetStyle = this.getNodeRenderer(targetNode)?.getNodeStyle?.(targetNode)

        const sourceWidth = sourceStyle?.width || 160
        const sourceHeight = sourceStyle?.height || 40
        const targetHeight = targetStyle?.height || 40

        line.setAttribute('x1', String((sourceNode.x ?? 0) + sourceWidth))
        line.setAttribute('y1', String((sourceNode.y ?? 0) + sourceHeight / 2))
        line.setAttribute('x2', String(targetNode.x ?? 0))
        line.setAttribute('y2', String((targetNode.y ?? 0) + targetHeight / 2))
        line.setAttribute('marker-end', 'url(#arrowhead)')

        // Apply theme styles
        const linkTheme = this.currentConfig.theme?.link
        if (linkTheme?.stroke)
          line.setAttribute('stroke', linkTheme.stroke)
        if (linkTheme?.strokeWidth)
          line.setAttribute('stroke-width', String(linkTheme.strokeWidth))

        container.appendChild(line)
      }
    })
  }

  private renderNodes(container: SVGElement, allNodes: VisualizerNode[]): void {
    // Clear node elements map
    this.nodeElements.clear()

    allNodes.forEach((node) => {
      if (node.x === undefined || node.y === undefined)
        return

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.setAttribute('data-node-id', node.id)
      group.style.cursor = 'move'

      // Store reference to node element
      this.nodeElements.set(node.id, group)

      const renderer = this.getNodeRenderer(node)

      if (renderer) {
        // Get node style from renderer
        const nodeStyle = renderer.getNodeStyle?.(node) || {
          fill: '#f7fafc',
          stroke: '#cbd5e0',
          strokeWidth: 1,
          rx: 6,
          width: 160,
          height: 40,
        }

        // Create base rectangle with hitbox
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        rect.classList.add('node-rect')
        rect.setAttribute('x', String(node.x))
        rect.setAttribute('y', String(node.y))
        rect.setAttribute('width', String(nodeStyle.width || 160))
        rect.setAttribute('height', String(nodeStyle.height || 40))
        rect.setAttribute('rx', String(nodeStyle.rx || 6))
        rect.setAttribute('fill', nodeStyle.fill || '#f7fafc')
        rect.setAttribute('stroke', nodeStyle.stroke || '#cbd5e0')
        rect.setAttribute('stroke-width', String(nodeStyle.strokeWidth || 1))

        // Add drag event listeners to the rectangle
        this.addNodeDragListeners(rect, node)

        group.appendChild(rect)

        // Let renderer handle content
        renderer.renderContent(node, group)
      }
      else {
        // Fallback rendering if no renderer found
        this.renderDefaultNode(node, group)
      }

      container.appendChild(group)
    })
  }

  private getNodeRenderer(node: VisualizerNode) {
    return this.currentConfig.nodeRenderers.find(renderer => renderer.canHandle(node))
  }

  private renderDefaultNode(node: VisualizerNode, container: SVGGElement): void {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.classList.add('node-rect')
    rect.setAttribute('x', String(node.x))
    rect.setAttribute('y', String(node.y))
    rect.setAttribute('width', '160')
    rect.setAttribute('height', '40')
    rect.setAttribute('rx', '6')
    rect.setAttribute('fill', '#f7fafc')
    rect.setAttribute('stroke', '#cbd5e0')
    rect.setAttribute('stroke-width', '1')

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.classList.add('node-text')
    text.setAttribute('x', String(node.x! + 80))
    text.setAttribute('y', String(node.y! + 25))
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'middle')
    text.textContent = this.truncateText(node.name, 15)

    container.appendChild(rect)
    container.appendChild(text)
  }

  private updateSvgDimensions(svg: SVGSVGElement, allNodes: VisualizerNode[]): void {
    // Create a large infinite canvas
    const canvasSize = 10000 // Large canvas for infinite feel
    const centerOffset = canvasSize / 2

    // Set a large viewBox for infinite canvas feeling
    svg.setAttribute('viewBox', `${-centerOffset} ${-centerOffset} ${canvasSize} ${canvasSize}`)
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')

    // If we have nodes, center the content initially
    if (allNodes.length > 0) {
      const validNodes = allNodes.filter(n => n.x !== undefined && n.y !== undefined)
      if (validNodes.length > 0) {
        const minX = Math.min(...validNodes.map(n => n.x || 0))
        const maxX = Math.max(...validNodes.map((n) => {
          const renderer = this.getNodeRenderer(n)
          const style = renderer?.getNodeStyle?.(n)
          return (n.x || 0) + (style?.width || 160)
        }))
        const minY = Math.min(...validNodes.map(n => n.y || 0))
        const maxY = Math.max(...validNodes.map((n) => {
          const renderer = this.getNodeRenderer(n)
          const style = renderer?.getNodeStyle?.(n)
          return (n.y || 0) + (style?.height || 40)
        }))

        // Calculate content center
        const contentCenterX = (minX + maxX) / 2
        const contentCenterY = (minY + maxY) / 2

        // Center the content on first render if zoom hasn't been modified
        if (this.zoomLevel === 1 && this.panX === 0 && this.panY === 0) {
          this.panX = -contentCenterX
          this.panY = -contentCenterY
        }
      }
    }
  }

  private renderError(svg: SVGSVGElement, message: string): void {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.setAttribute('x', '20')
    text.setAttribute('y', '40')
    text.setAttribute('fill', '#e53e3e')
    text.setAttribute('font-family', 'monospace')
    text.setAttribute('font-size', '14')
    text.textContent = message
    svg.appendChild(text)
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
  }

  // Node dragging methods
  private addNodeDragListeners(rect: SVGRectElement, node: VisualizerNode): void {
    rect.addEventListener('mousedown', (event) => {
      event.stopPropagation() // Prevent panning
      this.startNodeDrag(event, node)
    })
  }

  private startNodeDrag(event: MouseEvent, node: VisualizerNode): void {
    this.isDraggingNode = true
    this.draggedNode = node
    this.isPanning = false // Disable panning while dragging node

    const svg = this.svgRef.nativeElement
    const rect = svg.getBoundingClientRect()

    // Calculate mouse position in SVG coordinates
    const mouseX = (event.clientX - rect.left - this.panX) / this.zoomLevel
    const mouseY = (event.clientY - rect.top - this.panY) / this.zoomLevel

    this.dragOffset = {
      x: mouseX - (node.x || 0),
      y: mouseY - (node.y || 0),
    }

    // Add visual feedback for dragging
    const nodeGroup = this.nodeElements.get(node.id)
    if (nodeGroup) {
      nodeGroup.style.filter = 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4))'
      nodeGroup.style.opacity = '0.9'
    }

    // Add global listeners for mouse move and up
    document.addEventListener('mousemove', this.onNodeDrag)
    document.addEventListener('mouseup', this.onNodeDragEnd)

    event.preventDefault()
  }

  private onNodeDrag = (event: MouseEvent): void => {
    if (!this.isDraggingNode || !this.draggedNode)
      return

    const svg = this.svgRef.nativeElement
    const rect = svg.getBoundingClientRect()

    // Calculate new position in SVG coordinates
    const mouseX = (event.clientX - rect.left - this.panX) / this.zoomLevel
    const mouseY = (event.clientY - rect.top - this.panY) / this.zoomLevel

    const newX = mouseX - this.dragOffset.x
    const newY = mouseY - this.dragOffset.y

    // Check for collisions with other nodes and highlight them
    this.highlightCollisions(this.draggedNode, newX, newY)

    // Check for collisions with other nodes
    const validPosition = this.findValidPosition(this.draggedNode, newX, newY)

    // Update node position
    this.draggedNode.x = validPosition.x
    this.draggedNode.y = validPosition.y

    // Update visual representation
    this.updateNodePosition(this.draggedNode)

    // Update connected links
    this.updateLinks()
  }

  private onNodeDragEnd = (): void => {
    if (this.draggedNode) {
      // Remove visual feedback
      const nodeGroup = this.nodeElements.get(this.draggedNode.id)
      if (nodeGroup) {
        nodeGroup.style.filter = ''
        nodeGroup.style.opacity = '1'
      }
    }

    // Clear collision highlights
    this.clearCollisionHighlights()

    this.isDraggingNode = false
    this.draggedNode = null

    // Remove global listeners
    document.removeEventListener('mousemove', this.onNodeDrag)
    document.removeEventListener('mouseup', this.onNodeDragEnd)
  }

  private highlightCollisions(draggedNode: VisualizerNode, targetX: number, targetY: number): void {
    const allNodes = this.flattenNodes(this.nodes)
    const draggedRenderer = this.getNodeRenderer(draggedNode)
    const draggedStyle = draggedRenderer?.getNodeStyle?.(draggedNode) || { width: 160, height: 40 }
    const draggedWidth = draggedStyle.width || 160
    const draggedHeight = draggedStyle.height || 40
    const margin = 15

    // Clear previous highlights
    this.clearCollisionHighlights()

    for (const otherNode of allNodes) {
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
        const nodeGroup = this.nodeElements.get(otherNode.id)
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

  private clearCollisionHighlights(): void {
    this.nodeElements.forEach((group) => {
      const rect = group.querySelector('.node-rect.collision-highlight') as SVGRectElement
      if (rect) {
        rect.style.stroke = ''
        rect.style.strokeWidth = ''
        rect.classList.remove('collision-highlight')
      }
    })
  }

  // Resolve collisions in the initial layout
  private resolveInitialCollisions(allNodes: VisualizerNode[]): void {
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
              nodeB.y = nodeA.y + Math.random() * 100 - 50 // Add some randomness
            }
          }
        }
      }
    }

    if (iteration >= maxIterations) {
      console.warn('Maximum collision resolution iterations reached')
    }
  }

  // Collision detection and prevention
  private findValidPosition(draggedNode: VisualizerNode, targetX: number, targetY: number): { x: number, y: number } {
    const allNodes = this.flattenNodes(this.nodes)
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
    for (const otherNode of allNodes) {
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
    const allNodes = this.flattenNodes(this.nodes)
    const renderer = this.getNodeRenderer(node)
    const style = renderer?.getNodeStyle?.(node) || { width: 160, height: 40 }
    const width = style.width || 160
    const height = style.height || 40

    for (const otherNode of allNodes) {
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

  private updateNodePosition(node: VisualizerNode): void {
    const group = this.nodeElements.get(node.id)
    if (!group)
      return

    const rect = group.querySelector('.node-rect') as SVGRectElement
    const texts = group.querySelectorAll('.node-text')

    if (rect && node.x !== undefined && node.y !== undefined) {
      rect.setAttribute('x', String(node.x))
      rect.setAttribute('y', String(node.y))

      // Update text positions
      const width = Number.parseFloat(rect.getAttribute('width') || '160')
      const height = Number.parseFloat(rect.getAttribute('height') || '40')

      texts.forEach((text, index) => {
        const textElement = text as SVGTextElement
        textElement.setAttribute('x', String(node.x! + width / 2))
        // Adjust y position based on whether it's name or value text
        const yOffset = texts.length > 1 ? (index === 0 ? -5 : 12) : 0
        textElement.setAttribute('y', String(node.y! + height / 2 + yOffset))
      })
    }
  }

  private updateLinks(): void {
    const contentGroup = this.contentGroupRef.nativeElement
    const allNodes = this.flattenNodes(this.nodes)

    // Remove existing links
    const existingLinks = contentGroup.querySelectorAll('.link-line')
    existingLinks.forEach(link => link.remove())

    // Re-render links with updated positions
    this.renderLinks(contentGroup, allNodes)
  }

  // Zoom and Pan Event Handlers
  onWheel(event: WheelEvent): void {
    if (!this.currentConfig.enableZooming)
      return

    event.preventDefault()

    const delta = event.deltaY > 0 ? -0.1 : 0.1
    const rect = this.svgRef.nativeElement.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    this.zoomToPoint(mouseX, mouseY, delta)
    this.showZoomIndicator()
  }

  onMouseDown(event: MouseEvent): void {
    if (!this.currentConfig.enableZooming)
      return

    // Don't start panning if we're about to drag a node
    if ((event.target as Element)?.closest('.node-rect')) {
      return
    }

    if (event.button === 0) { // Left mouse button
      this.isPanning = true
      this.lastPanPoint = { x: event.clientX, y: event.clientY }
      this.lastPanTime = performance.now()
      this.panHistory = []
      this.panVelocity = { x: 0, y: 0 }

      // Stop any momentum animation
      if (this.momentumAnimationId) {
        cancelAnimationFrame(this.momentumAnimationId)
        this.momentumAnimationId = null
      }

      // Remove smooth transition during active panning
      if (this.contentGroupRef?.nativeElement) {
        this.contentGroupRef.nativeElement.classList.remove('smooth-pan')
      }

      this.svgRef.nativeElement.classList.add('panning')
      event.preventDefault()
    }
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.currentConfig.enableZooming)
      return

    // Node dragging is handled by onNodeDrag
    if (this.isDraggingNode) {
      return
    }

    if (this.isPanning) {
      const currentTime = performance.now()
      const deltaX = event.clientX - this.lastPanPoint.x
      const deltaY = event.clientY - this.lastPanPoint.y

      // Apply speed multiplier for faster panning
      const speedMultiplier = this.currentConfig.panSpeedMultiplier || 1.0
      const adjustedDeltaX = deltaX * speedMultiplier
      const adjustedDeltaY = deltaY * speedMultiplier

      this.panX += adjustedDeltaX
      this.panY += adjustedDeltaY

      // Track pan history for momentum calculation
      this.panHistory.push({
        x: adjustedDeltaX,
        y: adjustedDeltaY,
        time: currentTime,
      })

      // Keep only recent history (last 100ms)
      const cutoffTime = currentTime - 100
      this.panHistory = this.panHistory.filter(point => point.time > cutoffTime)

      this.lastPanPoint = { x: event.clientX, y: event.clientY }
      this.lastPanTime = currentTime
      this.updateTransform()
      event.preventDefault()
    }
  }

  onMouseUp(): void {
    if (!this.currentConfig.enableZooming)
      return

    if (this.isPanning) {
      this.isPanning = false
      this.svgRef.nativeElement.classList.remove('panning')

      // Calculate momentum from recent movement
      this.calculateMomentum()

      // Start momentum animation if there's enough velocity
      if (Math.abs(this.panVelocity.x) > this.minVelocity || Math.abs(this.panVelocity.y) > this.minVelocity) {
        this.startMomentumAnimation()
      }
    }
  }

  onMouseLeave(): void {
    if (!this.currentConfig.enableZooming)
      return

    if (this.isPanning) {
      this.isPanning = false
      this.svgRef.nativeElement.classList.remove('panning')

      // Don't apply momentum when mouse leaves the area
      this.panVelocity = { x: 0, y: 0 }
    }
  }

  // Zoom Control Methods
  zoomIn(): void {
    const svg = this.svgRef.nativeElement
    const rect = svg.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    this.zoomToPoint(centerX, centerY, 0.2)
    this.showZoomIndicator()
  }

  zoomOut(): void {
    const svg = this.svgRef.nativeElement
    const rect = svg.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    this.zoomToPoint(centerX, centerY, -0.2)
    this.showZoomIndicator()
  }

  resetZoom(): void {
    this.zoomLevel = 100
    this.panX = 0
    this.panY = 0
    this.updateTransform()
    this.showZoomIndicator()
  }

  private zoomToPoint(mouseX: number, mouseY: number, delta: number): void {
    const oldZoom = this.zoomLevel
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta))

    if (newZoom === oldZoom)
      return

    // Calculate the zoom point in world coordinates
    const worldX = (mouseX - this.panX) / oldZoom
    const worldY = (mouseY - this.panY) / oldZoom

    // Update zoom level
    this.zoomLevel = newZoom

    // Adjust pan to keep the zoom point stationary
    this.panX = mouseX - worldX * newZoom
    this.panY = mouseY - worldY * newZoom

    this.updateTransform()
  }

  private updateTransform(): void {
    if (this.contentGroupRef?.nativeElement) {
      const transform = `translate(${this.panX}, ${this.panY}) scale(${this.zoomLevel / 100})`
      this.contentGroupRef.nativeElement.setAttribute('transform', transform)
    }
  }

  private calculateMomentum(): void {
    if (this.panHistory.length < 2) {
      this.panVelocity = { x: 0, y: 0 }
      return
    }

    // Calculate average velocity from recent movements
    let totalDeltaX = 0
    let totalDeltaY = 0
    let totalTime = 0

    for (let i = 1; i < this.panHistory.length; i++) {
      const current = this.panHistory[i]
      const previous = this.panHistory[i - 1]
      const timeDelta = current.time - previous.time

      if (timeDelta > 0) {
        totalDeltaX += current.x
        totalDeltaY += current.y
        totalTime += timeDelta
      }
    }

    if (totalTime > 0) {
      // Scale velocity based on time
      const velocityScale = Math.min(100 / totalTime, 2.0)
      this.panVelocity.x = (totalDeltaX / this.panHistory.length) * velocityScale
      this.panVelocity.y = (totalDeltaY / this.panHistory.length) * velocityScale
    }
    else {
      this.panVelocity = { x: 0, y: 0 }
    }
  }

  private startMomentumAnimation(): void {
    if (this.momentumAnimationId) {
      cancelAnimationFrame(this.momentumAnimationId)
    }

    // Add smooth transition for momentum
    if (this.contentGroupRef?.nativeElement) {
      this.contentGroupRef.nativeElement.classList.add('smooth-pan')
    }

    const animate = () => {
      // Apply velocity decay
      this.panVelocity.x *= this.velocityDecay
      this.panVelocity.y *= this.velocityDecay

      // Update pan position
      this.panX += this.panVelocity.x
      this.panY += this.panVelocity.y

      this.updateTransform()

      // Continue animation if velocity is still significant
      if (Math.abs(this.panVelocity.x) > this.minVelocity || Math.abs(this.panVelocity.y) > this.minVelocity) {
        this.momentumAnimationId = requestAnimationFrame(animate)
      }
      else {
        // Remove smooth transition class when momentum ends
        if (this.contentGroupRef?.nativeElement) {
          this.contentGroupRef.nativeElement.classList.remove('smooth-pan')
        }
        this.momentumAnimationId = null
      }
    }

    this.momentumAnimationId = requestAnimationFrame(animate)
  }

  private showZoomIndicator(): void {
    if (!this.zoomIndicatorRef?.nativeElement)
      return

    const indicator = this.zoomIndicatorRef.nativeElement
    indicator.classList.add('show')

    // Clear any existing timeout
    if (this.zoomIndicatorTimeout) {
      clearTimeout(this.zoomIndicatorTimeout)
    }

    // Hide after a short delay
    this.zoomIndicatorTimeout = window.setTimeout(() => {
      indicator.classList.remove('show')
      this.zoomIndicatorTimeout = null
    }, 800)
  }
}
