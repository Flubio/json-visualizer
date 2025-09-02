import type {
  DataTransformer,
  NodeRenderer,
  NodeStyle,
  TransformContext,
  VisualizerNode,
} from '../types/visualizer.types'

/**
 * Custom renderer for entity nodes with special types and icons
 */
export class EntityNodeRenderer implements NodeRenderer {
  canHandle = (node: VisualizerNode): boolean => {
    const data = node.originalData
    return !!(data && (data.type || data.category || data.kind || this.hasEntityProperties(data)))
  }

  renderContent = (node: VisualizerNode, container: SVGGElement): void => {
    const rect = container.querySelector('.node-rect')
    const nodeWidth = rect?.getAttribute('width') ? Number.parseFloat(rect.getAttribute('width')!) : 160
    const nodeHeight = rect?.getAttribute('height') ? Number.parseFloat(rect.getAttribute('height')!) : 40
    const x = rect?.getAttribute('x') ? Number.parseFloat(rect.getAttribute('x')!) : 0
    const y = rect?.getAttribute('y') ? Number.parseFloat(rect.getAttribute('y')!) : 0

    const data = node.originalData
    const entityType = this.getEntityType(data)

    // Entity icon (simple circle)
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    icon.setAttribute('cx', String(x + 15))
    icon.setAttribute('cy', String(y + nodeHeight / 2))
    icon.setAttribute('r', '6')
    icon.setAttribute('fill', this.getEntityIconColor(entityType))
    icon.setAttribute('stroke', 'white')
    icon.setAttribute('stroke-width', '1')
    container.appendChild(icon)

    // Entity name
    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    nameText.classList.add('node-text', 'entity-name')
    nameText.setAttribute('x', String(x + 30))
    nameText.setAttribute('y', String(y + nodeHeight / 2 - 8))
    nameText.setAttribute('text-anchor', 'start')
    nameText.setAttribute('dominant-baseline', 'middle')
    nameText.textContent = this.truncateText(node.name, 15)
    container.appendChild(nameText)

    // Entity type
    const typeText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    typeText.classList.add('node-text', 'entity-type')
    typeText.setAttribute('x', String(x + 30))
    typeText.setAttribute('y', String(y + nodeHeight / 2 + 8))
    typeText.setAttribute('text-anchor', 'start')
    typeText.setAttribute('dominant-baseline', 'middle')
    typeText.setAttribute('font-size', '10')
    typeText.setAttribute('fill', '#a0aec0')
    typeText.textContent = entityType
    container.appendChild(typeText)

    // Value display
    if (node.value !== undefined) {
      const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      valueText.classList.add('node-text', 'entity-value')
      valueText.setAttribute('x', String(x + nodeWidth - 10))
      valueText.setAttribute('y', String(y + nodeHeight / 2))
      valueText.setAttribute('text-anchor', 'end')
      valueText.setAttribute('dominant-baseline', 'middle')
      valueText.setAttribute('font-weight', 'bold')
      valueText.setAttribute('fill', '#48bb78')
      valueText.textContent = String(node.value)
      container.appendChild(valueText)
    }
  }

  getNodeStyle = (node: VisualizerNode): NodeStyle => {
    const data = node.originalData
    const entityType = this.getEntityType(data)

    return {
      fill: '#1a202c',
      stroke: this.getEntityStrokeColor(entityType),
      strokeWidth: 2,
      rx: 12,
      width: 180, // Wider for entity info
      height: 50,
    }
  }

  private hasEntityProperties(data: any): boolean {
    const entityKeys = ['id', 'name', 'status', 'properties', 'attributes', 'metadata']
    return entityKeys.some(key => key in data)
  }

  private getEntityType(data: any): string {
    return data?.type || data?.category || data?.kind || 'entity'
  }

  private getEntityIconColor(entityType: string): string {
    const colorMap: { [key: string]: string } = {
      primary: '#e53e3e',
      secondary: '#3182ce',
      info: '#38a169',
      warning: '#d69e2e',
      success: '#38a169',
      error: '#e53e3e',
    }
    return colorMap[entityType] || '#718096'
  }

  private getEntityStrokeColor(entityType: string): string {
    const colorMap: { [key: string]: string } = {
      primary: '#fc8181',
      secondary: '#63b3ed',
      info: '#68d391',
      warning: '#f6e05e',
      success: '#68d391',
      error: '#fc8181',
    }
    return colorMap[entityType] || '#cbd5e0'
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
  }
}

/**
 * Custom renderer for container/group nodes
 */
export class ContainerNodeRenderer implements NodeRenderer {
  canHandle = (node: VisualizerNode): boolean => {
    const data = node.originalData
    return !!(data && (
      data.children
      || data.items
      || data.members
      || node.children?.length
      || this.hasContainerProperties(data)
    ))
  }

  renderContent = (node: VisualizerNode, container: SVGGElement): void => {
    const rect = container.querySelector('.node-rect')
    const nodeHeight = rect?.getAttribute('height') ? Number.parseFloat(rect.getAttribute('height')!) : 40
    const x = rect?.getAttribute('x') ? Number.parseFloat(rect.getAttribute('x')!) : 0
    const y = rect?.getAttribute('y') ? Number.parseFloat(rect.getAttribute('y')!) : 0

    // Container icon (folder-like shape)
    const iconGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    const folder = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    folder.setAttribute('x', String(x + 10))
    folder.setAttribute('y', String(y + nodeHeight / 2 - 8))
    folder.setAttribute('width', '12')
    folder.setAttribute('height', '16')
    folder.setAttribute('fill', '#4299e1')
    folder.setAttribute('stroke', 'white')
    folder.setAttribute('stroke-width', '1')
    folder.setAttribute('rx', '2')
    iconGroup.appendChild(folder)

    // Small indicator dots
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        dot.setAttribute('cx', String(x + 13 + j * 3))
        dot.setAttribute('cy', String(y + nodeHeight / 2 - 4 + i * 4))
        dot.setAttribute('r', '1')
        dot.setAttribute('fill', 'white')
        iconGroup.appendChild(dot)
      }
    }

    container.appendChild(iconGroup)

    // Container name
    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    nameText.classList.add('node-text', 'container-name')
    nameText.setAttribute('x', String(x + 30))
    nameText.setAttribute('y', String(y + nodeHeight / 2 - 5))
    nameText.setAttribute('text-anchor', 'start')
    nameText.setAttribute('dominant-baseline', 'middle')
    nameText.setAttribute('font-weight', 'bold')
    nameText.textContent = this.truncateText(node.name, 15)
    container.appendChild(nameText)

    // Child count
    const childCount = node.children?.length || this.getItemCount(node.originalData)
    if (childCount > 0) {
      const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      countText.classList.add('node-text', 'child-count')
      countText.setAttribute('x', String(x + 30))
      countText.setAttribute('y', String(y + nodeHeight / 2 + 8))
      countText.setAttribute('text-anchor', 'start')
      countText.setAttribute('dominant-baseline', 'middle')
      countText.setAttribute('font-size', '10')
      countText.setAttribute('fill', '#a0aec0')
      countText.textContent = `${childCount} items`
      container.appendChild(countText)
    }
  }

  getNodeStyle = (_node: VisualizerNode): NodeStyle => ({
    fill: '#2d3748',
    stroke: '#4299e1',
    strokeWidth: 3,
    rx: 12,
    width: 200, // Wider for container info
    height: 60,
  })

  private hasContainerProperties(data: any): boolean {
    const containerKeys = ['children', 'items', 'members', 'elements', 'collection']
    return containerKeys.some(key => key in data && Array.isArray(data[key]))
  }

  private getItemCount(data: any): number {
    const containerKeys = ['children', 'items', 'members', 'elements', 'collection']
    for (const key of containerKeys) {
      if (data[key] && Array.isArray(data[key])) {
        return data[key].length
      }
    }
    return 0
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
  }
}

/**
 * Data transformer for hierarchical data structures with nested collections
 */
export class HierarchicalDataTransformer implements DataTransformer {
  canHandle = (data: any, _context: TransformContext): boolean => {
    return Array.isArray(data) && data.length > 0
      && data.some(item => item && typeof item === 'object' && this.hasNestedStructure(item))
  }

  transform = (data: any, level: number, parentKey: string, context: TransformContext): VisualizerNode[] => {
    if (!Array.isArray(data))
      return []

    return data.map((item, index) => {
      const containerNode: VisualizerNode = {
        id: `container_${item.id || index}`,
        name: item.name || item.title || item.label || `Container ${index + 1}`,
        type: level === 0 ? 'root' : 'object',
        level,
        children: [],
        originalData: item,
        metadata: {
          isContainer: true,
          hasNestedData: this.hasNestedStructure(item),
        },
      }

      // Transform nested collections
      const nestedCollections = this.findNestedCollections(item)
      nestedCollections.forEach(({ collection, key }) => {
        collection.forEach((nestedItem: any, nestedIndex: number) => {
          const nestedNode = this.transformNestedItem(nestedItem, level + 1, nestedIndex, context, containerNode, key)
          if (nestedNode) {
            containerNode.children!.push(nestedNode)
          }
        })
      })

      return containerNode
    })
  }

  private hasNestedStructure(item: any): boolean {
    const nestedKeys = ['children', 'items', 'members', 'elements', 'collection', 'data']
    return nestedKeys.some(key => item[key] && Array.isArray(item[key]) && item[key].length > 0)
  }

  private findNestedCollections(item: any): Array<{ collection: any[], key: string }> {
    const nestedKeys = ['children', 'items', 'members', 'elements', 'collection', 'data']
    const collections: Array<{ collection: any[], key: string }> = []

    nestedKeys.forEach((key) => {
      if (item[key] && Array.isArray(item[key])) {
        collections.push({ collection: item[key], key })
      }
    })

    return collections
  }

  private transformNestedItem(item: any, level: number, index: number, context: TransformContext, parent: VisualizerNode, collectionKey: string): VisualizerNode {
    const itemNode: VisualizerNode = {
      id: `${collectionKey}_${item.id || index}`,
      name: item.name || item.title || item.label || `${collectionKey} ${index + 1}`,
      type: 'object',
      level,
      children: [],
      originalData: item,
      metadata: {
        isNestedItem: true,
        collectionType: collectionKey,
        parentContainer: parent.originalData,
      },
    }

    // Transform nested children if they exist
    if (this.hasNestedStructure(item)) {
      const nestedCollections = this.findNestedCollections(item)
      nestedCollections.forEach(({ collection, key }) => {
        collection.forEach((child: any, childIndex: number) => {
          let childNode: VisualizerNode

          if (this.isLeafItem(child)) {
            // This is a leaf item
            childNode = {
              id: `leaf_${child.id || childIndex}`,
              name: child.name || child.title || child.label || `Item ${childIndex + 1}`,
              type: 'leaf',
              level: level + 1,
              originalData: child,
              metadata: {
                isLeafItem: true,
                itemType: child.type || child.category || 'item',
              },
            }

            // Add value using valueProvider
            if (context.valueProvider) {
              try {
                const value = context.valueProvider(child)
                if (value !== undefined) {
                  childNode.value = value
                }
              }
              catch (error) {
                console.warn('Error in valueProvider:', error)
              }
            }
          }
          else {
            // This might be another nested container
            childNode = this.transformNestedItem(child, level + 1, childIndex, context, itemNode, key)
          }

          itemNode.children!.push(childNode)
        })
      })
    }

    return itemNode
  }

  private isLeafItem(item: any): boolean {
    // Consider it a leaf if it doesn't have nested collections or has specific leaf indicators
    return !this.hasNestedStructure(item)
      || item.type === 'leaf'
      || item.isLeaf
      || item.terminal
  }
}
