import type { VisualizerConfig, VisualizerNode } from '../types/visualizer.types'

export class DataTransformationHandler {
  constructor(private config: VisualizerConfig) { }

  transformData(data: any): { nodes: VisualizerNode[], links: Array<{ source: string, target: string }> } {
    const links: Array<{ source: string, target: string }> = []

    const context = {
      // Remove maxDepth to enable infinite depth traversal
      maxDepth: undefined,
      valueProvider: this.config.valueProvider,
    }

    // Clear any circular reference tracking from previous transforms
    if ('processedObjects' in this.config.dataTransformer) {
      (this.config.dataTransformer as any).processedObjects = new WeakSet()
    }

    // Use the configured data transformer
    const transformedNodes = this.config.dataTransformer.transform(
      data,
      0,
      'root',
      context,
    )

    this.generateLinks(transformedNodes, links)

    return { nodes: transformedNodes, links }
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
