import type { ElementRef, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core'
import type { VisualizerConfig, VisualizerNode } from './types/visualizer.types'
import { CommonModule } from '@angular/common'
import { Component, Input, ViewChild } from '@angular/core'
import { createDefaultConfig } from './providers/preset-configs'
import { CollisionDetector } from './utils/collision-detector'
import { DataTransformationHandler } from './utils/data-transformation-handler'
import { LayoutCalculator } from './utils/layout-calculator'
import { NodeDragHandler } from './utils/node-drag-handler'
import { SVGRenderer } from './utils/svg-renderer'
import { ZoomPanHandler } from './utils/zoom-pan-handler'

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
        <span class="zoom-level">{{ (getZoomLevel()) | number:'1.0-0' }}%</span>
        <button class="zoom-btn" (click)="zoomOut()" title="Zoom Out">-</button>
        <button class="zoom-btn" (click)="resetZoom()" title="Reset Zoom">⌂</button>
      </div>

      <!-- Debug Panel Toggle -->
      <div class="debug-toggle" *ngIf="enableDebug">
        <button class="debug-btn" (click)="toggleDebug()"
                [class.active]="debugVisible"
                title="Toggle Debug Panel">
          🐛
        </button>
      </div>

      <!-- Debug Panel -->
      <div class="debug-panel" *ngIf="enableDebug && debugVisible">
        <div class="debug-header">
          <span class="debug-title">Debug Info</span>
          <button class="debug-close" (click)="toggleDebug()" title="Close Debug Panel">×</button>
        </div>
        <div class="debug-content">
          <div class="debug-item">
            <span class="debug-label">Zoom:</span>
            <span class="debug-value">{{ (getZoomLevel()) | number:'1.1-1' }}%</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Pan X:</span>
            <span class="debug-value">{{ getPanX() | number:'1.1-1' }}</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Pan Y:</span>
            <span class="debug-value">{{ getPanY() | number:'1.1-1' }}</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Nodes:</span>
            <span class="debug-value">{{ getNodeCount() }}</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Links:</span>
            <span class="debug-value">{{ getLinkCount() }}</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">SVG Size:</span>
            <span class="debug-value">{{ width }}×{{ height }}</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Dragging:</span>
            <span class="debug-value">{{ isDragging() ? 'Yes' : 'No' }}</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Drag Enabled:</span>
            <span class="debug-value">{{ isDraggingEnabled() ? 'Yes' : 'No' }}</span>
          </div>
          <div class="debug-item">
            <span class="debug-label">Config:</span>
            <span class="debug-value">{{ currentConfig ? 'Loaded' : 'Default' }}</span>
          </div>
        </div>
      </div>

      <!-- Smooth Zoom Indicator -->
      <div #zoomIndicator class="zoom-indicator">
        {{ (getZoomLevel()) }}%
      </div>
    </div>
  `,
  styleUrl: './ngx-json-visualizer.component.css',
})
export class JsonVisualizerComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('svgContainer', { static: true }) svgRef!: ElementRef<SVGSVGElement>
  @ViewChild('contentGroup', { static: true }) contentGroupRef!: ElementRef<SVGGElement>
  @ViewChild('zoomIndicator', { static: true }) zoomIndicatorRef!: ElementRef<HTMLDivElement>
  @Input() data: any = null
  @Input() config: VisualizerConfig | null = null
  @Input() width = 800
  @Input() height = 600
  @Input() enableDebug = false

  private nodes: VisualizerNode[] = []
  private links: Array<{ source: string, target: string }> = []
  private allNodes: VisualizerNode[] = [] // Store all nodes as an instance variable
  currentConfig!: VisualizerConfig
  debugVisible = false

  // Utility handlers
  private zoomPanHandler!: ZoomPanHandler
  private nodeDragHandler!: NodeDragHandler
  private collisionDetector!: CollisionDetector
  private svgRenderer!: SVGRenderer
  private layoutCalculator!: LayoutCalculator
  private dataTransformationHandler!: DataTransformationHandler

  ngOnInit(): void {
    this.currentConfig = this.config || createDefaultConfig()
    this.initializeUtilityHandlers()
    this.render()
  }

  ngOnChanges(changes: SimpleChanges): void {
    let shouldReRender = false
    let shouldReInitialize = false

    // Update config if it changed
    if (Object.prototype.hasOwnProperty.call(changes, 'config')) {
      this.currentConfig = this.config || createDefaultConfig()
      shouldReInitialize = true
      shouldReRender = true
    }

    // Check if data changed
    if (Object.prototype.hasOwnProperty.call(changes, 'data')) {
      shouldReRender = true
    }

    // Re-initialize handlers only if config changed
    if (shouldReInitialize) {
      this.initializeUtilityHandlers()
    }

    // Re-render if anything changed
    if (shouldReRender) {
      this.render()
    }
  }

  ngOnDestroy(): void {
    // Clean up utility handlers
    this.zoomPanHandler?.destroy()

    // Clean up any active drag listeners
    document.removeEventListener('mousemove', this.onNodeDrag)
    document.removeEventListener('mouseup', this.onNodeDragEnd)
  }

  private initializeUtilityHandlers(): void {
    // Initialize zoom and pan handler
    this.zoomPanHandler = new ZoomPanHandler(
      this.currentConfig,
      this.svgRef,
      this.contentGroupRef,
      this.zoomIndicatorRef,
    )

    // Initialize collision detector
    this.collisionDetector = new CollisionDetector(
      this.currentConfig,
      (node: VisualizerNode) => this.getNodeRenderer(node),
    )

    // Initialize SVG renderer
    this.svgRenderer = new SVGRenderer(
      this.currentConfig,
      this.svgRef,
      this.contentGroupRef,
    )

    // Initialize node drag handler
    this.nodeDragHandler = new NodeDragHandler(
      this.currentConfig,
      this.collisionDetector,
      this.svgRenderer,
      this.zoomPanHandler.getPanState(),
    )

    // Update SVG renderer with drag handler reference
    this.svgRenderer = new SVGRenderer(
      this.currentConfig,
      this.svgRef,
      this.contentGroupRef,
      this.nodeDragHandler,
    )

    // Initialize layout calculator
    this.layoutCalculator = new LayoutCalculator(this.currentConfig)

    // Initialize data transformation handler
    this.dataTransformationHandler = new DataTransformationHandler(this.currentConfig)
  }

  private render(): void {
    if (!this.data) {
      return
    }

    try {
      // Transform data using data transformation handler
      const result = this.dataTransformationHandler.transformData(this.data)
      this.nodes = result.nodes
      this.links = result.links

      // Flatten nodes for processing - store as instance variable to maintain reference
      this.allNodes = this.flattenNodes(this.nodes)

      // Calculate layout using layout calculator
      const positions = this.layoutCalculator.calculateLayout(this.allNodes, this.links)
      this.layoutCalculator.applyPositionsToNodes(this.nodes, positions)

      // Update utility handlers with current nodes and links
      this.collisionDetector.setAllNodes(this.allNodes)
      this.svgRenderer.setAllNodes(this.allNodes)
      this.svgRenderer.setLinks(this.links)
      this.nodeDragHandler.setAllNodes(this.allNodes)
      this.nodeDragHandler.setLinks(this.links)
      this.nodeDragHandler.setLayoutCalculator(this.layoutCalculator)

      // Render visualization using SVG renderer
      this.svgRenderer.renderVisualization(this.nodes, this.links, this.allNodes)

      // Update node drag handler with pan state
      const panState = this.zoomPanHandler.getPanState()
      this.nodeDragHandler.updatePanState(panState.panX, panState.panY, panState.zoomLevel)

      // Center content initially if needed
      const newPanState = this.layoutCalculator.centerContentInitially(this.nodes, panState)

      if (newPanState.panX !== panState.panX || newPanState.panY !== panState.panY) {
        panState.panX = newPanState.panX
        panState.panY = newPanState.panY
        this.updateTransform()
      }
    }
    catch (error) {
      console.error('Error rendering visualization:', error)
      this.svgRenderer.renderError('Failed to render visualization')
    }
  }

  // Public methods for template
  getZoomLevel(): number {
    return this.zoomPanHandler?.getZoomLevel() || 100
  }

  resetZoom(): void {
    if (this.zoomPanHandler) {
      this.zoomPanHandler.resetZoom()
      this.svgRenderer.updateLinks(this.allNodes, this.links)
    }
  }

  toggleDebug(): void {
    this.debugVisible = !this.debugVisible
  }

  getPanX(): number {
    return this.zoomPanHandler?.getPanState().panX || 0
  }

  getPanY(): number {
    return this.zoomPanHandler?.getPanState().panY || 0
  }

  getNodeCount(): number {
    return this.flattenNodes(this.nodes).length
  }

  getLinkCount(): number {
    return this.links.length
  }

  isDragging(): boolean {
    return this.nodeDragHandler?.isDragging() || false
  }

  isDraggingEnabled(): boolean {
    return this.nodeDragHandler?.isDraggingEnabled() ?? true
  }

  // Event handlers - delegate to utility handlers
  onWheel(event: WheelEvent): void {
    this.zoomPanHandler?.onWheel(event)
  }

  onMouseDown(event: MouseEvent): void {
    this.zoomPanHandler?.onMouseDown(event)
  }

  onMouseMove(event: MouseEvent): void {
    this.zoomPanHandler?.onMouseMove(event, this.nodeDragHandler?.isDragging() || false)
  }

  onMouseUp(): void {
    this.zoomPanHandler?.onMouseUp()
  }

  onMouseLeave(): void {
    this.zoomPanHandler?.onMouseLeave()
  }

  // Zoom control methods
  zoomIn(): void {
    this.zoomPanHandler?.zoomIn()
  }

  zoomOut(): void {
    if (this.zoomPanHandler) {
      this.zoomPanHandler.zoomOut()
      this.svgRenderer.updateLinks(this.allNodes, this.links)
    }
  }

  // Helper methods
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

  private getNodeRenderer(node: VisualizerNode) {
    return this.currentConfig.nodeRenderers.find(renderer => renderer.canHandle(node))
  }

  private updateTransform(): void {
    const panState = this.zoomPanHandler.getPanState()
    if (this.contentGroupRef?.nativeElement) {
      const transform = `translate(${panState.panX}, ${panState.panY}) scale(${panState.zoomLevel / 100})`
      this.contentGroupRef.nativeElement.setAttribute('transform', transform)
    }
  }

  // Legacy methods for backward compatibility (to be removed)
  private onNodeDrag = (_event: MouseEvent): void => {
    // This is handled by NodeDragHandler now
  }

  private onNodeDragEnd = (): void => {
    // This is handled by NodeDragHandler now
  }
}
