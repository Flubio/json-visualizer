import type {
  DataTransformer,
  LayoutConfig,
  LayoutProvider,
  NodeRenderer,
  NodeStyle,
  TransformContext,
  VisualizerNode,
} from '../types/visualizer.types'

/**
 * Default node renderer for standard JSON nodes
 */
export class DefaultNodeRenderer implements NodeRenderer {
  canHandle = (_node: VisualizerNode): boolean => true

  renderContent = (node: VisualizerNode, container: SVGGElement): void => {
    const rect = container.querySelector('.node-rect')
    const nodeWidth = rect?.getAttribute('width') ? Number.parseFloat(rect.getAttribute('width')!) : 160
    const nodeHeight = rect?.getAttribute('height') ? Number.parseFloat(rect.getAttribute('height')!) : 40
    const x = rect?.getAttribute('x') ? Number.parseFloat(rect.getAttribute('x')!) : 0
    const y = rect?.getAttribute('y') ? Number.parseFloat(rect.getAttribute('y')!) : 0

    // Create text for name
    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    nameText.classList.add('node-text', 'node-name')
    nameText.setAttribute('x', String(x + nodeWidth / 2))
    nameText.setAttribute('y', String(y + nodeHeight / 2 - (node.value !== undefined ? 5 : 0)))
    nameText.setAttribute('text-anchor', 'middle')
    nameText.setAttribute('dominant-baseline', 'middle')
    nameText.textContent = this.truncateText(node.name, 20)

    container.appendChild(nameText)

    // Add value text if it exists
    if (node.value !== undefined) {
      const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      valueText.classList.add('node-text', 'node-value')
      valueText.setAttribute('x', String(x + nodeWidth / 2))
      valueText.setAttribute('y', String(y + nodeHeight / 2 + 12))
      valueText.setAttribute('text-anchor', 'middle')
      valueText.setAttribute('dominant-baseline', 'middle')
      valueText.textContent = this.truncateText(String(node.value), 15)

      container.appendChild(valueText)
    }
  }

  getNodeStyle = (node: VisualizerNode): NodeStyle => {
    const colors = {
      root: '#4a5568',
      object: '#2d3748',
      array: '#2c5282',
      leaf: '#2f855a',
    }

    const strokeColors = {
      root: '#718096',
      object: '#4299e1',
      array: '#3182ce',
      leaf: '#38a169',
    }

    return {
      fill: colors[node.type] || '#2d3748',
      stroke: strokeColors[node.type] || '#4299e1',
      strokeWidth: 2,
      rx: 8,
      textColor: 'white',
      fontSize: 12,
    }
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
  }
}

/**
 * Default data transformer for generic JSON data
 */
export class DefaultDataTransformer implements DataTransformer {
  private processedObjects = new WeakSet()

  canHandle = (_data: any, _context: TransformContext): boolean => true

  transform = (data: any, level: number, parentKey: string, context: TransformContext): VisualizerNode[] => {
    const nodes: VisualizerNode[] = []

    // Check depth limit
    if (context.maxDepth && level >= context.maxDepth) {
      return [{
        id: `${parentKey}_truncated`,
        name: `${parentKey} (truncated)`,
        type: 'leaf',
        level,
        originalData: data,
      }]
    }

    // Circular reference detection for objects
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (this.processedObjects.has(data)) {
        return [{
          id: `${parentKey}_circular`,
          name: `${parentKey} (circular)`,
          type: 'leaf',
          level,
          originalData: data,
        }]
      }
      this.processedObjects.add(data)
    }

    if (Array.isArray(data)) {
      // Handle arrays
      const arrayNode: VisualizerNode = {
        id: `${parentKey}_array`,
        name: `${parentKey} [${data.length}]`,
        type: 'array',
        level,
        children: [],
        originalData: data,
      }

      data.forEach((item, index) => {
        const childContext: TransformContext = { ...context, currentDepth: level + 1, parentNode: arrayNode }
        const childNodes = this.transform(item, level + 1, `[${index}]`, childContext)
        arrayNode.children!.push(...childNodes)
      })

      nodes.push(arrayNode)
    }
    else if (data && typeof data === 'object') {
      // Handle objects
      const objectNode: VisualizerNode = {
        id: `${parentKey}_object`,
        name: data.name || data.id || parentKey,
        type: level === 0 ? 'root' : 'object',
        level,
        children: [],
        originalData: data,
      }

      Object.entries(data).forEach(([key, value]) => {
        if (key === 'name' || key === 'id')
          return // Skip name/id as they're used for the node title

        const childContext: TransformContext = { ...context, currentDepth: level + 1, parentNode: objectNode }
        const childNodes = this.transform(value, level + 1, key, childContext)
        objectNode.children!.push(...childNodes)
      })

      nodes.push(objectNode)
    }
    else {
      // Handle primitive values
      let displayValue = String(data)

      // Try to get value from valueProvider if available
      if (context.valueProvider) {
        try {
          const providerValue = context.valueProvider(data)
          if (providerValue !== undefined) {
            displayValue = String(providerValue)
          }
        }
        catch (error) {
          console.warn('Error in valueProvider:', error)
        }
      }

      const leafNode: VisualizerNode = {
        id: `${parentKey}_leaf`,
        name: parentKey,
        value: displayValue,
        type: 'leaf',
        level,
        originalData: data,
      }

      nodes.push(leafNode)
    }

    return nodes
  }
}

/**
 * Default hierarchical layout provider
 */
export class DefaultLayoutProvider implements LayoutProvider {
  calculateLayout(
    nodes: VisualizerNode[],
    _links: Array<{ source: string, target: string }>,
    config: LayoutConfig,
  ): Array<{ nodeId: string, x: number, y: number }> {
    const spacing = config.nodeSpacing || { x: 200, y: 80 }
    const padding = config.padding || { top: 40, right: 40, bottom: 40, left: 40 }

    // Group nodes by level
    const nodesByLevel: { [level: number]: VisualizerNode[] } = {}

    const processNode = (node: VisualizerNode) => {
      if (!nodesByLevel[node.level]) {
        nodesByLevel[node.level] = []
      }
      nodesByLevel[node.level].push(node)

      if (node.children) {
        node.children.forEach(processNode)
      }
    }

    nodes.forEach(processNode)

    const positions: Array<{ nodeId: string, x: number, y: number }> = []

    // Calculate positions level by level
    Object.keys(nodesByLevel).forEach((levelStr) => {
      const level = Number.parseInt(levelStr)
      const nodesAtLevel = nodesByLevel[level]

      nodesAtLevel.forEach((node, index) => {
        positions.push({
          nodeId: node.id,
          x: padding.left + level * spacing.x,
          y: padding.top + index * spacing.y,
        })
      })
    })

    return positions
  }
}

/**
 * Tree-like layout provider that positions children under their parents
 */
export class TreeLayoutProvider implements LayoutProvider {
  private nodeHeight = 40
  private nodeSpacing = 20

  calculateLayout(
    nodes: VisualizerNode[],
    _links: Array<{ source: string, target: string }>,
    config: LayoutConfig,
  ): Array<{ nodeId: string, x: number, y: number }> {
    const spacing = config.nodeSpacing || { x: 200, y: 40 }
    const padding = config.padding || { top: 50, right: 50, bottom: 50, left: 50 }

    // Start with root nodes at the top level
    const rootNodes = nodes.filter(n => n.level === 0)

    const positions: Array<{ nodeId: string, x: number, y: number }> = []
    let currentY = padding.top

    rootNodes.forEach((rootNode) => {
      const subtreeHeight = this.calculateSubtreePositions(rootNode, padding.left, currentY, positions, spacing)
      currentY += subtreeHeight + this.nodeSpacing
    })

    return positions
  }

  private calculateSubtreePositions(
    node: VisualizerNode,
    x: number,
    startY: number,
    positions: Array<{ nodeId: string, x: number, y: number }>,
    spacing: { x: number, y: number },
  ): number {
    // Position this node
    positions.push({ nodeId: node.id, x, y: startY })

    if (!node.children || node.children.length === 0) {
      return this.nodeHeight
    }

    // Calculate positions for children
    let childY = startY + this.nodeHeight + this.nodeSpacing
    let totalHeight = this.nodeHeight + this.nodeSpacing

    node.children.forEach((child) => {
      const subtreeHeight = this.calculateSubtreePositions(
        child,
        x + spacing.x,
        childY,
        positions,
        spacing,
      )
      childY += subtreeHeight + this.nodeSpacing
      totalHeight += subtreeHeight + this.nodeSpacing
    })

    // Adjust this node's Y position to center it among its children
    if (node.children.length > 1) {
      const firstChildPos = positions.find(p => p.nodeId === node.children![0].id)
      const lastChildPos = positions.find(p => p.nodeId === node.children![node.children!.length - 1].id)
      if (firstChildPos && lastChildPos) {
        const centerY = firstChildPos.y + (lastChildPos.y - firstChildPos.y) / 2
        const nodePos = positions.find(p => p.nodeId === node.id)
        if (nodePos) {
          nodePos.y = centerY
        }
      }
    }

    return totalHeight - this.nodeSpacing // Remove the last spacing
  }
}
