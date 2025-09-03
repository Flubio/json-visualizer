import type { ElementRef } from '@angular/core'
import type { VisualizerConfig, VisualizerNode } from '../types/visualizer.types'

export class SVGRenderer {
  private nodeElements = new Map<string, SVGGElement>()
  private links: Array<{ source: string, target: string }> = []

  constructor(
    private config: VisualizerConfig,
    private svgRef: ElementRef<SVGSVGElement>,
    private contentGroupRef: ElementRef<SVGGElement>,
    private nodeDragHandler?: any, // Use any to avoid circular dependency
  ) { }

  renderVisualization(nodes: VisualizerNode[], links: Array<{ source: string, target: string }>): void {
    const svg = this.svgRef.nativeElement
    const contentGroup = this.contentGroupRef.nativeElement
    const allNodes = this.flattenNodes(nodes)

    this.links = links

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

    // Update node drag handler with node elements
    if (this.nodeDragHandler) {
      this.nodeDragHandler.setNodeElements(this.nodeElements)
    }
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
    polygon.setAttribute('fill', this.config.theme?.link?.stroke || '#a0aec0')

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
        const linkTheme = this.config.theme?.link
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
      // Position group using transform so renderer-internal coordinates remain relative
      group.setAttribute('transform', `translate(${node.x}, ${node.y})`)

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
        // Use local coordinates inside the group
        rect.setAttribute('x', '0')
        rect.setAttribute('y', '0')
        rect.setAttribute('width', String(nodeStyle.width || 160))
        rect.setAttribute('height', String(nodeStyle.height || 40))
        rect.setAttribute('rx', String(nodeStyle.rx || 6))
        rect.setAttribute('fill', nodeStyle.fill || '#f7fafc')
        rect.setAttribute('stroke', nodeStyle.stroke || '#cbd5e0')
        rect.setAttribute('stroke-width', String(nodeStyle.strokeWidth || 1))

        // Add drag event listeners to the rectangle if drag handler is available
        if (this.nodeDragHandler) {
          this.nodeDragHandler.addNodeDragListeners(rect, node)
        }

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
    return this.config.nodeRenderers.find(renderer => renderer.canHandle(node))
  }

  private renderDefaultNode(node: VisualizerNode, container: SVGGElement): void {
    // Render relative to the group's origin (0,0). The group is positioned via transform.
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.classList.add('node-rect')
    rect.setAttribute('x', '0')
    rect.setAttribute('y', '0')
    rect.setAttribute('width', '160')
    rect.setAttribute('height', '40')
    rect.setAttribute('rx', '6')
    rect.setAttribute('fill', '#f7fafc')
    rect.setAttribute('stroke', '#cbd5e0')
    rect.setAttribute('stroke-width', '1')

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.classList.add('node-text')
    text.setAttribute('x', String(160 / 2))
    text.setAttribute('y', String(40 / 2 + 5))
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'middle')
    text.textContent = this.truncateText(node.name, 15)

    container.appendChild(rect)
    container.appendChild(text)
  }

  private updateSvgDimensions(svg: SVGSVGElement, _allNodes: VisualizerNode[]): void {
    // Create a large infinite canvas
    const canvasSize = 10000 // Large canvas for infinite feel
    const centerOffset = canvasSize / 2

    // Set a large viewBox for infinite canvas feeling
    svg.setAttribute('viewBox', `${-centerOffset} ${-centerOffset} ${canvasSize} ${canvasSize}`)
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
  }

  updateLinks(): void {
    const contentGroup = this.contentGroupRef.nativeElement

    // Remove existing links
    const existingLinks = contentGroup.querySelectorAll('.link-line')
    existingLinks.forEach(link => link.remove())

    // Re-render links with updated positions
    this.renderLinks(contentGroup, this.allNodes)
  }

  renderError(message: string): void {
    const svg = this.svgRef.nativeElement
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

  getNodeElements(): Map<string, SVGGElement> {
    return this.nodeElements
  }

  // This method needs to be updated to work with all nodes
  setAllNodes(nodes: VisualizerNode[]): void {
    this.allNodes = nodes
  }

  setLinks(links: Array<{ source: string, target: string }>): void {
    this.links = links
  }

  private allNodes: VisualizerNode[] = []
}
