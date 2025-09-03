import type { VisualizerConfig, VisualizerNode } from '../types/visualizer.types'

export class DataTransformationHandler {
  private nodeIdCounter = 0

  constructor(private config: VisualizerConfig) { }

  transformData(data: any): { nodes: VisualizerNode[], links: Array<{ source: string, target: string }> } {
    this.nodeIdCounter = 0
    const links: Array<{ source: string, target: string }> = []

    // Create root node using the simpler approach from reference
    const rootNode = this.createRootNode(data)
    this.buildTree(rootNode)

    // Generate links for the tree structure
    this.generateLinks([rootNode], links)

    return { nodes: [rootNode], links }
  }

  private createRootNode(data: any): VisualizerNode {
    return {
      id: this.generateId(),
      name: 'root',
      type: 'root',
      level: 0,
      children: [],
      originalData: data,
      x: 0,
      y: 0,
    }
  }

  private generateId(): string {
    return `node_${++this.nodeIdCounter}`
  }

  private buildTree(parent: VisualizerNode): void {
    const data = parent.originalData

    if (this.isObject(data)) {
      // Handle object properties - each property becomes a child node
      Object.keys(data).forEach((key) => {
        const value = data[key]
        const childNode = this.createChildNode(key, value, parent)
        parent.children = parent.children || []
        parent.children.push(childNode)

        // Recursively build tree for non-primitive values
        if (!this.isPrimitive(value)) {
          this.buildTree(childNode)
        }
      })
    }
    else if (this.isArray(data)) {
      // Handle array items - each item becomes a child node
      data.forEach((item: any, index: number) => {
        const childNode = this.createChildNode(`[${index}]`, item, parent)
        parent.children = parent.children || []
        parent.children.push(childNode)

        // Recursively build tree for non-primitive array items
        if (!this.isPrimitive(item)) {
          this.buildTree(childNode)
        }
      })
    }
  }

  private createChildNode(key: string, value: any, parent: VisualizerNode): VisualizerNode {
    let type: 'object' | 'array' | 'leaf' = 'leaf'
    let displayValue: string | number | undefined
    let displayName = key

    if (this.isObject(value)) {
      type = 'object'
      // For objects, show a summary of their properties
      const propCount = Object.keys(value).length
      displayName = `${key}`
      displayValue = `{${propCount} props}`
    }
    else if (this.isArray(value)) {
      type = 'array'
      // For arrays, show the length
      displayName = `${key}`
      displayValue = `[${value.length} items]`
    }
    else {
      // For primitive values, show the actual value with proper type indication
      displayValue = this.formatPrimitiveValue(value)
      displayName = key
    }

    return {
      id: this.generateId(),
      name: displayName,
      value: displayValue,
      type,
      level: parent.level + 1,
      children: [],
      originalData: value,
      x: 0,
      y: 0,
    }
  }

  private formatPrimitiveValue(value: any): string {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'string') {
      // Truncate long strings and add quotes
      const truncated = value.length > 20 ? `${value.substring(0, 20)}...` : value
      return `"${truncated}"`
    }
    if (typeof value === 'boolean') return value.toString()
    if (typeof value === 'number') return value.toString()
    return String(value)
  }

  private isObject(value: any): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }

  private isArray(value: any): boolean {
    return Array.isArray(value)
  }

  private isPrimitive(value: any): boolean {
    return value !== Object(value)
  }

  private generateLinks(nodes: VisualizerNode[], links: Array<{ source: string, target: string }>): void {
    nodes.forEach((node) => {
      if (node.children) {
        node.children.forEach((child) => {
          links.push({
            source: node.id,
            target: child.id,
          })
        })
        // Recursively process children
        this.generateLinks(node.children, links)
      }
    })
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
}
