import type { ElementRef } from '@angular/core'
import type { VisualizerConfig } from '../types/visualizer.types'

export interface PanState {
  panX: number
  panY: number
  zoomLevel: number
  isPanning: boolean
  lastPanPoint: { x: number, y: number }
  panHistory: Array<{ x: number, y: number, time: number }>
  panVelocity: { x: number, y: number }
  lastPanTime: number
  momentumAnimationId: number | null
  zoomIndicatorTimeout: number | null
}

export class ZoomPanHandler {
  private panState: PanState = {
    panX: 0,
    panY: 0,
    zoomLevel: 100,
    isPanning: false,
    lastPanPoint: { x: 0, y: 0 },
    panHistory: [],
    panVelocity: { x: 0, y: 0 },
    lastPanTime: 0,
    momentumAnimationId: null,
    zoomIndicatorTimeout: null,
  }

  private readonly minZoom = 10
  private readonly maxZoom = 1000
  private readonly velocityDecay = 0.92
  private readonly minVelocity = 0.1

  constructor(
    private config: VisualizerConfig,
    private svgRef: ElementRef<SVGSVGElement>,
    private contentGroupRef: ElementRef<SVGGElement>,
    private zoomIndicatorRef: ElementRef<HTMLDivElement>,
  ) { }

  onWheel(event: WheelEvent): void {
    if (!this.config.enableZooming)
      return

    event.preventDefault()

    const baseSpeed = 1.0
    const zoomSpeed = (this.config?.zoomSpeedMultiplier ?? 1.0) * baseSpeed
    const delta = event.deltaY > 0 ? -zoomSpeed : zoomSpeed

    // Convert client coordinates to SVG user coordinates and zoom there
    const p = this.clientToSvg(event.clientX, event.clientY)
    this.zoomToPoint(p.svgX, p.svgY, delta)
    this.showZoomIndicator()
  }

  onMouseDown(event: MouseEvent): void {
    if (!this.config.enablePanning)
      return

    // Don't start panning if we're about to drag a node
    if ((event.target as Element)?.closest('.node-rect')) {
      return
    }

    if (event.button === 0) { // Left mouse button
      this.panState.isPanning = true
      this.panState.lastPanPoint = { x: event.clientX, y: event.clientY }
      this.panState.lastPanTime = performance.now()
      this.panState.panHistory = []
      this.panState.panVelocity = { x: 0, y: 0 }

      // Stop any momentum animation
      if (this.panState.momentumAnimationId) {
        cancelAnimationFrame(this.panState.momentumAnimationId)
        this.panState.momentumAnimationId = null
      }

      // Remove smooth transition during active panning
      if (this.contentGroupRef?.nativeElement) {
        this.contentGroupRef.nativeElement.classList.remove('smooth-pan')
      }

      this.svgRef.nativeElement.classList.add('panning')
      event.preventDefault()
    }
  }

  onMouseMove(event: MouseEvent, isDraggingNode: boolean): void {
    if (!this.config.enablePanning)
      return

    // Node dragging is handled separately
    if (isDraggingNode) {
      return
    }

    if (this.panState.isPanning) {
      const currentTime = performance.now()
      const deltaX = event.clientX - this.panState.lastPanPoint.x
      const deltaY = event.clientY - this.panState.lastPanPoint.y

      // Apply speed multiplier for faster panning
      const speedMultiplier = this.config.panSpeedMultiplier || 1.0
      const adjustedDeltaX = deltaX * speedMultiplier
      const adjustedDeltaY = deltaY * speedMultiplier

      this.panState.panX += adjustedDeltaX
      this.panState.panY += adjustedDeltaY

      // Track pan history for momentum calculation
      this.panState.panHistory.push({
        x: adjustedDeltaX,
        y: adjustedDeltaY,
        time: currentTime,
      })

      // Keep only recent history (last 100ms)
      const cutoffTime = currentTime - 100
      this.panState.panHistory = this.panState.panHistory.filter(point => point.time > cutoffTime)

      this.panState.lastPanPoint = { x: event.clientX, y: event.clientY }
      this.panState.lastPanTime = currentTime
      this.updateTransform()
      event.preventDefault()
    }
  }

  onMouseUp(): void {
    if (!this.config.enablePanning)
      return

    if (this.panState.isPanning) {
      this.panState.isPanning = false
      this.svgRef.nativeElement.classList.remove('panning')

      // Calculate momentum from recent movement
      this.calculateMomentum()

      // Start momentum animation if there's enough velocity
      if (Math.abs(this.panState.panVelocity.x) > this.minVelocity || Math.abs(this.panState.panVelocity.y) > this.minVelocity) {
        this.startMomentumAnimation()
      }
    }
  }

  onMouseLeave(): void {
    if (!this.config.enablePanning)
      return

    if (this.panState.isPanning) {
      this.panState.isPanning = false
      this.svgRef.nativeElement.classList.remove('panning')

      // Don't apply momentum when mouse leaves the area
      this.panState.panVelocity = { x: 0, y: 0 }
    }
  }

  zoomIn(): void {
    const svg = this.svgRef.nativeElement
    const rect = svg.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const zoomSpeed = (this.config?.zoomSpeedMultiplier ?? 1.0) * 10 // percent
    this.zoomToPoint(centerX, centerY, zoomSpeed)
    this.showZoomIndicator()
  }

  zoomOut(): void {
    const svg = this.svgRef.nativeElement
    const rect = svg.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const zoomSpeed = (this.config?.zoomSpeedMultiplier ?? 1.0) * 10 // percent
    this.zoomToPoint(centerX, centerY, -zoomSpeed)
    this.showZoomIndicator()
  }

  resetZoom(): void {
    this.panState.zoomLevel = 100
    this.panState.panX = 0
    this.panState.panY = 0
    this.updateTransform()
    this.showZoomIndicator()
  }

  private zoomToPoint(mouseX: number, mouseY: number, delta: number): void {
    // Treat zoomLevel as percent (100 => scale 1.0)
    const oldScale = this.panState.zoomLevel / 100
    const deltaScale = delta / 100
    const newScale = Math.max(this.minZoom / 100, Math.min(this.maxZoom / 100, oldScale + deltaScale))

    if (newScale === oldScale)
      return

    // World coordinates using old scale
    const worldX = (mouseX - this.panState.panX) / oldScale
    const worldY = (mouseY - this.panState.panY) / oldScale

    // Update zoom level (keep percent representation)
    this.panState.zoomLevel = newScale * 100

    // Adjust pan to keep the zoom point stationary under new scale
    this.panState.panX = mouseX - worldX * newScale
    this.panState.panY = mouseY - worldY * newScale

    this.updateTransform()
  }

  private updateTransform(): void {
    if (this.contentGroupRef?.nativeElement) {
      const transform = `translate(${this.panState.panX}, ${this.panState.panY}) scale(${this.panState.zoomLevel / 100})`
      this.contentGroupRef.nativeElement.setAttribute('transform', transform)
    }
  }

  private clientToSvg(clientX: number, clientY: number): { svgX: number, svgY: number } {
    const svg = this.svgRef.nativeElement
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const screenCTM = svg.getScreenCTM()
    if (!screenCTM) {
      return { svgX: clientX, svgY: clientY }
    }
    const inverse = screenCTM.inverse()
    const local = pt.matrixTransform(inverse)
    return { svgX: local.x, svgY: local.y }
  }

  private calculateMomentum(): void {
    if (this.panState.panHistory.length < 2) {
      this.panState.panVelocity = { x: 0, y: 0 }
      return
    }

    // Calculate average velocity from recent movements
    let totalDeltaX = 0
    let totalDeltaY = 0
    let totalTime = 0

    for (let i = 1; i < this.panState.panHistory.length; i++) {
      const current = this.panState.panHistory[i]
      const previous = this.panState.panHistory[i - 1]
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
      this.panState.panVelocity.x = (totalDeltaX / this.panState.panHistory.length) * velocityScale
      this.panState.panVelocity.y = (totalDeltaY / this.panState.panHistory.length) * velocityScale
    }
    else {
      this.panState.panVelocity = { x: 0, y: 0 }
    }
  }

  private startMomentumAnimation(): void {
    if (this.panState.momentumAnimationId) {
      cancelAnimationFrame(this.panState.momentumAnimationId)
    }

    // Add smooth transition for momentum
    if (this.contentGroupRef?.nativeElement) {
      this.contentGroupRef.nativeElement.classList.add('smooth-pan')
    }

    const animate = () => {
      // Apply velocity decay
      this.panState.panVelocity.x *= this.velocityDecay
      this.panState.panVelocity.y *= this.velocityDecay

      // Update pan position
      this.panState.panX += this.panState.panVelocity.x
      this.panState.panY += this.panState.panVelocity.y

      this.updateTransform()

      // Continue animation if velocity is still significant
      if (Math.abs(this.panState.panVelocity.x) > this.minVelocity || Math.abs(this.panState.panVelocity.y) > this.minVelocity) {
        this.panState.momentumAnimationId = requestAnimationFrame(animate)
      }
      else {
        // Remove smooth transition class when momentum ends
        if (this.contentGroupRef?.nativeElement) {
          this.contentGroupRef.nativeElement.classList.remove('smooth-pan')
        }
        this.panState.momentumAnimationId = null
      }
    }

    this.panState.momentumAnimationId = requestAnimationFrame(animate)
  }

  private showZoomIndicator(): void {
    if (!this.zoomIndicatorRef?.nativeElement)
      return

    const indicator = this.zoomIndicatorRef.nativeElement
    indicator.classList.add('show')

    // Clear any existing timeout
    if (this.panState.zoomIndicatorTimeout) {
      clearTimeout(this.panState.zoomIndicatorTimeout)
    }

    // Hide after a short delay
    this.panState.zoomIndicatorTimeout = window.setTimeout(() => {
      indicator.classList.remove('show')
      this.panState.zoomIndicatorTimeout = null
    }, 800)
  }

  getPanState(): PanState {
    return this.panState
  }

  isPanning(): boolean {
    return this.panState.isPanning
  }

  getZoomLevel(): number {
    return this.panState.zoomLevel
  }

  destroy(): void {
    // Clean up momentum animation
    if (this.panState.momentumAnimationId) {
      cancelAnimationFrame(this.panState.momentumAnimationId)
      this.panState.momentumAnimationId = null
    }

    // Clean up zoom indicator timeout
    if (this.panState.zoomIndicatorTimeout) {
      clearTimeout(this.panState.zoomIndicatorTimeout)
      this.panState.zoomIndicatorTimeout = null
    }
  }
}
