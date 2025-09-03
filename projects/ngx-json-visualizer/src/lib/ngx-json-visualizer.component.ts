import type { ElementRef, OnChanges, OnDestroy, OnInit } from '@angular/core'
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

      <!-- Smooth Zoom Indicator -->
      <div #zoomIndicator class="zoom-indicator">
        {{ (getZoomLevel()) | number:'1.0-0' }}%
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

  private nodes: VisualizerNode[] = []
  private links: Array<{ source: string, target: string }> = []
  currentConfig!: VisualizerConfig

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

  ngOnChanges(): void {
    this.currentConfig = this.config || createDefaultConfig()
    if (this.zoomPanHandler) {
      this.initializeUtilityHandlers()
    }
    this.render()
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
    if (!this.data)
      return

    try {
      // Transform data using data transformation handler
      const result = this.dataTransformationHandler.transformData(this.data)
      this.nodes = result.nodes
      this.links = result.links

      // Flatten nodes for processing
      const allNodes = this.flattenNodes(this.nodes)

      // Calculate layout using layout calculator
      const positions = this.layoutCalculator.calculateLayout(allNodes, this.links)
      this.layoutCalculator.applyPositionsToNodes(this.nodes, positions)

      // Update utility handlers with current nodes
      this.collisionDetector.setAllNodes(allNodes)
      this.svgRenderer.setAllNodes(allNodes)
      this.svgRenderer.setLinks(this.links)

      // Resolve initial collisions
      this.collisionDetector.resolveInitialCollisions(allNodes)

      // Render visualization using SVG renderer
      this.svgRenderer.renderVisualization(this.nodes, this.links)

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
    this.zoomPanHandler?.zoomOut()
  }

  resetZoom(): void {
    this.zoomPanHandler?.resetZoom()
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
