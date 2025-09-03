// Types and interfaces for the extensible JSON visualizer

export interface VisualizerNode {
  id: string
  name: string
  value?: string | number
  children?: VisualizerNode[]
  type: 'root' | 'object' | 'array' | 'leaf'
  level: number
  x?: number
  y?: number
  originalData?: any
  metadata?: Record<string, any>
  childrenHeight?: number // For layout calculations
}

export interface NodeStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  rx?: number
  ry?: number
  width?: number
  height?: number
  textColor?: string
  fontSize?: number
  fontWeight?: string
}

export interface LinkStyle {
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  opacity?: number
}

export interface NodeRenderer {
  /**
   * Determines if this renderer should handle the given node
   */
  canHandle: (node: VisualizerNode) => boolean

  /**
   * Renders the node content (text, additional elements)
   */
  renderContent: (node: VisualizerNode, container: SVGGElement) => void

  /**
   * Returns custom styles for the node
   */
  getNodeStyle: (node: VisualizerNode) => NodeStyle

  /**
   * Returns custom styles for links from this node
   */
  getLinkStyle?: (fromNode: VisualizerNode, toNode: VisualizerNode) => LinkStyle
}

export interface DataTransformer {
  /**
   * Transforms raw data into VisualizerNodes
   */
  transform: (data: any, level: number, parentKey: string, context: TransformContext) => VisualizerNode[]

  /**
   * Determines if this transformer should handle the given data
   */
  canHandle: (data: any, context: TransformContext) => boolean
}

export interface TransformContext {
  valueProvider?: (item: any) => string | number | undefined
  maxDepth?: number
  currentDepth?: number
  parentNode?: VisualizerNode
}

export interface ThemeConfig {
  node?: {
    fontSize?: string
    fontFamily?: string
    fill?: string
    stroke?: string
    textFill?: string
  }
  link?: {
    stroke?: string
    strokeWidth?: number
  }
  background?: string
}

export interface LayoutConfig {
  nodeSpacing?: {
    x: number
    y: number
  }
  padding?: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

export interface LayoutProvider {
  /**
   * Calculates positions for all nodes
   */
  calculateLayout: (nodes: VisualizerNode[], links: Array<{ source: string, target: string }>, config: LayoutConfig) => Array<{ nodeId: string, x: number, y: number }>
}

export interface VisualizerConfig {
  // Layout configuration
  layout?: LayoutConfig

  // Theme configuration
  theme?: ThemeConfig

  // Custom value extraction
  valueProvider?: (data: any) => any

  // Default styles
  defaultNodeStyle?: NodeStyle
  defaultLinkStyle?: LinkStyle

  // Behavior
  enablePanning?: boolean
  enableZooming?: boolean
  enableHover?: boolean
  enableDragging?: boolean
  panSpeedMultiplier?: number
  zoomSpeedMultiplier?: number
  maxDepth?: number

  // Custom renderers and transformers
  nodeRenderers: NodeRenderer[]
  dataTransformer: DataTransformer
  layoutProvider: LayoutProvider

  // Callbacks
  onNodeClick?: (node: VisualizerNode, event: MouseEvent) => void
  onNodeHover?: (node: VisualizerNode, event: MouseEvent) => void
  onNodeLeave?: (node: VisualizerNode, event: MouseEvent) => void
}
