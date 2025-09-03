# JSON Visualizer Component

Angular component for rendering hierarchical JSON data as interactive SVG tree diagrams with zoom/pan controls.

## Installation

### npm
```bash
npm install ngx-json-visualizer
```

### yarn
```bash
yarn add ngx-json-visualizer
```

### pnpm
```bash
pnpm add ngx-json-visualizer
```

### bun
```bash
bun add ngx-json-visualizer
```

## Setup

Import the component in your Angular module or standalone component:

```typescript
// For standalone components (Angular 14+)
import { JsonVisualizerComponent } from 'ngx-json-visualizer'

@Component({
  standalone: true,
  imports: [JsonVisualizerComponent],
  template: `
    <ngx-json-visualizer
      [data]="data"
      [config]="config"
      [width]="800"
      [height]="600">
    </ngx-json-visualizer>
  `
})
export class ExampleComponent {
  // component code
}
```

```typescript
// For NgModule-based apps
import { NgxJsonVisualizerModule } from 'ngx-json-visualizer'

@NgModule({
  imports: [NgxJsonVisualizerModule],
  // ...
})
export class AppModule { }
```

## Quick Start

```typescript
import { Component } from '@angular/core'
import { createDefaultConfig, JsonVisualizerComponent } from 'ngx-json-visualizer'

@Component({
  standalone: true,
  imports: [JsonVisualizerComponent],
  template: `
    <ngx-json-visualizer
      [data]="data"
      [config]="config"
      [width]="800"
      [height]="600">
    </ngx-json-visualizer>
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
import { NodeRenderer, VisualizerConfig, VisualizerNode } from 'ngx-json-visualizer'

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
} from 'ngx-json-visualizer'

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
import { NodeRenderer, NodeStyle, VisualizerNode } from 'ngx-json-visualizer'

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
import { VisualizerConfig } from 'ngx-json-visualizer'

const config: VisualizerConfig = {
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
import { DARK_THEME, LIGHT_THEME, VisualizerConfig } from 'ngx-json-visualizer'

const config: VisualizerConfig = {
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
import { VisualizerConfig } from 'ngx-json-visualizer'

const config: VisualizerConfig = {
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
import { Component } from '@angular/core'
import { createDefaultConfig, JsonVisualizerComponent } from 'ngx-json-visualizer'

@Component({
  standalone: true,
  imports: [JsonVisualizerComponent],
  template: `
    <ngx-json-visualizer
      [data]="complexData"
      [config]="enhancedConfig"
      [width]="1000"
      [height]="800">
    </ngx-json-visualizer>
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
