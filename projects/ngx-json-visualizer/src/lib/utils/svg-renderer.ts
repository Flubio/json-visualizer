import type { ElementRef } from '@angular/core'
import type { NodeStyle, VisualizerConfig, VisualizerNode } from '../types/visualizer.types'
import { select } from 'd3-selection'

export class SVGRenderer {
  private nodeElements = new Map<string, SVGGElement>()
  private links: Array<{ source: string, target: string }> = []
  private linkSelection: any

  constructor(
    private config: VisualizerConfig,
    private svgRef: ElementRef<SVGSVGElement>,
    private contentGroupRef: ElementRef<SVGGElement>,
    private nodeDragHandler?: any, // Use any to avoid circular dependency
  ) {
    this.svgRef = svgRef
    this.contentGroupRef = contentGroupRef
  }

  renderVisualization(nodes: VisualizerNode[], links: Array<{ source: string, target: string }>, allNodes?: VisualizerNode[]): void {
    const svg = this.svgRef.nativeElement
    const contentGroup = this.contentGroupRef.nativeElement
    const flattenedNodes = allNodes || this.flattenNodes(nodes)

    this.links = links

    // Clear previous content
    svg.innerHTML = ''

    // Re-add content group
    svg.appendChild(contentGroup)
    contentGroup.innerHTML = ''

    // Create defs for arrowheads and styles
    this.setupSvgDefs(svg)

    // Render links first (so they appear behind nodes)
    this.renderLinks(contentGroup, flattenedNodes)

    // Render nodes using configured renderers
    this.renderNodes(contentGroup, flattenedNodes)

    // Update SVG dimensions
    this.updateSvgDimensions(svg, flattenedNodes)

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
        // Calculate connection points based on node style
        const sourceStyle = this.getNodeRenderer(sourceNode)?.getNodeStyle?.(sourceNode)
        const targetStyle = this.getNodeRenderer(targetNode)?.getNodeStyle?.(targetNode)

        const sourceWidth = sourceStyle?.width || 160
        const sourceHeight = sourceStyle?.height || 40
        const targetHeight = targetStyle?.height || 40

        const x1 = (sourceNode.x ?? 0) + sourceWidth
        const y1 = (sourceNode.y ?? 0) + sourceHeight / 2
        const x2 = targetNode.x ?? 0
        const y2 = (targetNode.y ?? 0) + targetHeight / 2

        // Create curved path instead of straight line
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.classList.add('link-line')

        // Add data attributes for debugging
        path.setAttribute('data-source', link.source)
        path.setAttribute('data-target', link.target)

        // Calculate control points for smooth curve
        const dx = Math.abs(x2 - x1)
        const controlOffset = Math.min(dx * 0.5, 100) // Limit curve intensity

        const pathData = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`
        path.setAttribute('d', pathData)
        path.setAttribute('fill', 'none')
        path.setAttribute('marker-end', 'url(#arrowhead)')

        // Apply theme styles
        const linkTheme = this.config.theme?.link
        if (linkTheme?.stroke)
          path.setAttribute('stroke', linkTheme.stroke)
        else
          path.setAttribute('stroke', '#a0aec0')

        if (linkTheme?.strokeWidth)
          path.setAttribute('stroke-width', String(linkTheme.strokeWidth))
        else
          path.setAttribute('stroke-width', '2')

        container.appendChild(path)
      }
      else {
        // Debug: log when links can't be rendered
        console.error('Cannot render link:', link, 'sourceNode:', !!sourceNode, 'targetNode:', !!targetNode)
      }
    })
  }

  private renderNodes(container: SVGElement, allNodes: VisualizerNode[]): void {
    // Clear node elements map
    this.nodeElements.clear()

    allNodes.forEach((node) => {
      if (node.x === undefined || node.y === undefined) {
        return
      }

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.setAttribute('data-node-id', node.id)
      group.style.cursor = this.config.enableDragging ? 'move' : 'default'
      // Position group using transform so renderer-internal coordinates remain relative
      group.setAttribute('transform', `translate(${node.x}, ${node.y})`)

      // Store reference to node element
      this.nodeElements.set(node.id, group)

      const renderer = this.getNodeRenderer(node)

      if (renderer) {
        // Get node style from renderer
        const nodeStyle = renderer.getNodeStyle?.(node) || this.getDefaultNodeStyle(node)

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

        // Create invisible larger hitbox for easier dragging
        const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        hitbox.classList.add('node-hitbox')
        const hitboxPadding = 10
        hitbox.setAttribute('x', String(-hitboxPadding))
        hitbox.setAttribute('y', String(-hitboxPadding))
        hitbox.setAttribute('width', String((nodeStyle.width || 160) + 2 * hitboxPadding))
        hitbox.setAttribute('height', String((nodeStyle.height || 40) + 2 * hitboxPadding))
        hitbox.setAttribute('fill', 'transparent')
        hitbox.setAttribute('cursor', this.config.enableDragging ? 'move' : 'default')

        // Add drag event listeners to the hitbox if drag handler is available
        if (this.nodeDragHandler) {
          this.nodeDragHandler.addNodeDragListeners(hitbox, node)
        }

        group.appendChild(rect)
        group.appendChild(hitbox) // Add hitbox first (behind visible elements)

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

  private getDefaultNodeStyle(node: VisualizerNode): NodeStyle {
    const colors = {
      root: { fill: '#4a5568', stroke: '#718096' },
      object: { fill: '#2d3748', stroke: '#4299e1' },
      array: { fill: '#2c5282', stroke: '#3182ce' },
      leaf: { fill: '#2f855a', stroke: '#38a169' },
    }

    const style = colors[node.type] || colors.leaf

    return {
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: 2,
      rx: 8,
      width: 160,
      height: 40,
      textColor: '#ffffff',
      fontSize: 12,
    }
  }

  private getNodeRenderer(node: VisualizerNode) {
    return this.config.nodeRenderers.find(renderer => renderer.canHandle(node))
  }

  private renderDefaultNode(node: VisualizerNode, container: SVGGElement): void {
    // Get style for this node type
    const style = this.getDefaultNodeStyle(node)

    // Render relative to the group's origin (0,0). The group is positioned via transform.
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.classList.add('node-rect')
    rect.setAttribute('x', '0')
    rect.setAttribute('y', '0')
    rect.setAttribute('width', String(style.width || 160))
    rect.setAttribute('height', String(style.height || 40))
    rect.setAttribute('rx', String(style.rx || 6))
    rect.setAttribute('fill', style.fill || '#f7fafc')
    rect.setAttribute('stroke', style.stroke || '#cbd5e0')
    rect.setAttribute('stroke-width', String(style.strokeWidth || 1))

    // Name text
    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    nameText.classList.add('node-text')
    nameText.setAttribute('x', String((style.width || 160) / 2))
    nameText.setAttribute('y', String((style.height || 40) / 2 - (node.value !== undefined ? 8 : 0)))
    nameText.setAttribute('text-anchor', 'middle')
    nameText.setAttribute('dominant-baseline', 'middle')
    nameText.setAttribute('fill', style.textColor || 'white')
    nameText.setAttribute('font-size', String(style.fontSize || 12))
    nameText.setAttribute('font-weight', 'bold')
    nameText.textContent = this.truncateText(node.name, 18)

    container.appendChild(rect)
    container.appendChild(nameText)

    // Value text if present
    if (node.value !== undefined) {
      const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      valueText.classList.add('node-value')
      valueText.setAttribute('x', String((style.width || 160) / 2))
      valueText.setAttribute('y', String((style.height || 40) / 2 + 10))
      valueText.setAttribute('text-anchor', 'middle')
      valueText.setAttribute('dominant-baseline', 'middle')
      valueText.setAttribute('fill', style.textColor || 'white')
      valueText.setAttribute('font-size', String((style.fontSize || 12) - 1))
      valueText.setAttribute('font-style', 'italic')
      valueText.textContent = this.truncateText(String(node.value), 20)
      container.appendChild(valueText)
    }
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

  updateLinks(nodes: VisualizerNode[], links: { source: string, target: string }[]): void {
    if (!this.svgRef?.nativeElement || !this.contentGroupRef?.nativeElement) {
      return
    }

    // Use passed nodes and links
    this.allNodes = nodes
    this.links = links

    console.error('updateLinks called, allNodes length:', this.allNodes.length, 'links length:', this.links.length)

    const nodeMap = new Map(this.allNodes.map(node => [node.id, node]))

    if (!this.linkSelection) {
      this.linkSelection = select(this.contentGroupRef.nativeElement).selectAll('.link-line')
    }

    this.linkSelection = this.linkSelection.data(this.links, (d: { source: string, target: string }) => `${d.source}-${d.target}`)

    // Exit
    this.linkSelection.exit().remove()

    // Enter
    const enterSelection = this.linkSelection.enter().append('path').attr('class', 'link-line').attr('fill', 'none').attr('marker-end', 'url(#arrowhead)')

    const linkTheme = this.config.theme?.link
    if (linkTheme) {
      enterSelection
        .attr('stroke', linkTheme.stroke)
        .attr('stroke-width', linkTheme.strokeWidth)
    }

    // Merge
    this.linkSelection = enterSelection.merge(this.linkSelection)

    // Update
    this.linkSelection.attr('d', (d: { source: string, target: string }) => {
      const sourceNode = nodeMap.get(d.source)
      const targetNode = nodeMap.get(d.target)

      if (sourceNode && targetNode && sourceNode.x !== undefined && sourceNode.y !== undefined && targetNode.x !== undefined && targetNode.y !== undefined) {
        // Determine node dimensions from style
        const sourceStyle = this.getNodeRenderer(sourceNode)?.getNodeStyle(sourceNode) || this.getDefaultNodeStyle(sourceNode)
        const targetStyle = this.getNodeRenderer(targetNode)?.getNodeStyle(targetNode) || this.getDefaultNodeStyle(targetNode)
        const sourceWidth = sourceStyle.width ?? 0
        const sourceHeight = sourceStyle.height ?? 0
        const targetWidth = targetStyle.width ?? 0

        const sourceX = sourceNode.x + sourceWidth / 2
        const sourceY = sourceNode.y + sourceHeight
        const targetX = targetNode.x + targetWidth / 2
        const targetY = targetNode.y
        return `M${sourceX},${sourceY} C${sourceX},${(sourceY + targetY) / 2} ${targetX},${(sourceY + targetY) / 2} ${targetX},${targetY}`
      }
      return ''
    })
  }

  clear(): void {
    if (this.contentGroupRef?.nativeElement) {
      this.contentGroupRef.nativeElement.innerHTML = ''
    }
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
