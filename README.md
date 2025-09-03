# JSON Visualizer Component

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

Angular component for rendering hierarchical JSON data as interactive SVG tree diagrams with zoom/pan controls.

## Quick Start

```typescript
import { JsonVisualizerComponent } from './json-visualizer.component'
import { createDefaultConfig } from './providers/preset-configs'

@Component({
  template: `
    <app-json-visualizer
      [data]="data"
      [config]="config"
      [width]="800"
      [height]="600">
    </app-json-visualizer>
  `
})
export class ExampleComponent {
  data = { root: { items: [{ name: 'item1', value: 123 }] } }
  config = createDefaultConfig()
}
```

## API

### Inputs
- `data: any` - JSON data to visualize
- `config: VisualizerConfig` - Configuration object
- `width: number = 800` - Component width
- `height: number = 600` - Component height

### Core Types

```typescript
interface VisualizerConfig {
  nodeRenderers: NodeRenderer[]
  dataTransformer: DataTransformer
  layoutProvider: LayoutProvider
  enableZooming?: boolean
  theme?: ThemeConfig
  layout?: LayoutConfig
  onNodeClick?: (node: VisualizerNode, event: MouseEvent) => void
}

interface VisualizerNode {
  id: string
  name: string
  value?: string | number
  children?: VisualizerNode[]
  type: 'root' | 'object' | 'array' | 'leaf'
  level: number
  x?: number
  y?: number
  originalData?: any
}
```

## Preset Configurations

```typescript
import {
  API_VISUALIZER_CONFIG,
  createDefaultConfig,
  createDeviceConfig,
  TENANT_DEVICE_CONFIG
} from './providers/preset-configs'

// Basic JSON visualization
const config = createDefaultConfig()

// IoT device hierarchies
const deviceConfig = createDeviceConfig()

// API endpoint trees
const apiConfig = API_VISUALIZER_CONFIG

// Multi-tenant device management
const tenantConfig = TENANT_DEVICE_CONFIG
```

## Custom Renderers

```typescript
class CustomNodeRenderer implements NodeRenderer {
  canHandle = (node: VisualizerNode): boolean => {
    return node.originalData?.type === 'custom'
  }

  renderContent = (node: VisualizerNode, container: SVGGElement): void => {
    // Custom SVG rendering logic
  }

  getNodeStyle = (node: VisualizerNode): NodeStyle => ({
    fill: '#ffffff',
    stroke: '#000000',
    width: 160,
    height: 40
  })
}

const config: VisualizerConfig = {
  nodeRenderers: [new CustomNodeRenderer(), new DefaultNodeRenderer()],
  // ... other config
}
```

## Layout Configuration

```typescript
const config = {
  layout: {
    nodeSpacing: { x: 220, y: 80 },
    padding: { top: 20, right: 20, bottom: 20, left: 20 }
  },
  enableZooming: true,
  maxDepth: 10
}
```

## Theming

```typescript
import { DARK_THEME, LIGHT_THEME } from './providers/preset-configs'

const config = {
  theme: DARK_THEME,
  // or custom theme
  theme: {
    node: { fill: '#ffffff', stroke: '#000000' },
    link: { stroke: '#cccccc', strokeWidth: 1 }
  }
}
```

## Event Handling

```typescript
const config = {
  onNodeClick: (node, event) => {
    console.log('Clicked:', node.name)
  },
  onNodeHover: (node, event) => {
    // Show tooltip
  }
}
```

## Node Interaction Features

### Draggable Nodes
Nodes can be individually dragged to reposition them within the canvas:
- Click and drag any node to move it freely
- Visual feedback with shadows and opacity changes during drag
- Automatic collision detection prevents overlapping

### Collision Detection
- **Hitboxes**: Each node has a collision boundary that prevents overlap
- **Visual Feedback**: Conflicting nodes are highlighted with red borders during drag
- **Smart Positioning**: Automatically finds the closest valid position when collision occurs
- **Snap to Grid**: Positions are snapped to a 10px grid for clean alignment

### Enhanced Interaction
- **Pan and Zoom**: Canvas-level pan and zoom (mouse wheel)
- **Individual Node Dragging**: Move nodes independently without affecting canvas
- **Minimum Spacing**: Configurable margin between nodes (default: 15px)

### Usage Example with Enhanced Features
```typescript
@Component({
  template: `
    <app-json-visualizer
      [data]="complexData"
      [config]="enhancedConfig"
      [width]="1000"
      [height]="800">
    </app-json-visualizer>
  `
})
export class InteractiveExampleComponent {
  complexData = {
    root: {
      devices: [
        { id: 'device1', name: 'Sensor A', type: 'temperature', value: 25.3 },
        { id: 'device2', name: 'Sensor B', type: 'humidity', value: 65.8 }
      ]
    }
  }

  enhancedConfig = createDefaultConfig()
  // Dragging and collision detection are enabled by default
}
```

## Browser Requirements

- Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- SVG support required
