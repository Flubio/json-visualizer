import type {
  VisualizerConfig,
} from '../types/visualizer.types'
import {
  ContainerNodeRenderer,
  EntityNodeRenderer,
  HierarchicalDataTransformer,
} from './custom-renderers'
import {
  DefaultDataTransformer,
  DefaultLayoutProvider,
  DefaultNodeRenderer,
  TreeLayoutProvider,
} from './default-providers'

/**
 * Pre-configured setups for common visualization scenarios
 */

export function createDefaultConfig(): VisualizerConfig {
  return {
    nodeRenderers: [new DefaultNodeRenderer()],
    dataTransformer: new DefaultDataTransformer(),
    layoutProvider: new DefaultLayoutProvider(),
    enableZooming: true,
    theme: {
      node: {
        fontSize: '12px',
        fontFamily: 'monospace',
      },
      link: {
        stroke: '#a0aec0',
        strokeWidth: 1,
      },
    },
    layout: {
      nodeSpacing: { x: 220, y: 80 },
      padding: { top: 20, right: 20, bottom: 20, left: 20 },
    },
  }
}

export function createHierarchicalConfig(): VisualizerConfig {
  return {
    nodeRenderers: [
      new EntityNodeRenderer(),
      new ContainerNodeRenderer(),
      new DefaultNodeRenderer(), // Fallback
    ],
    dataTransformer: new HierarchicalDataTransformer(),
    layoutProvider: new DefaultLayoutProvider(),
    enableZooming: true,
    theme: {
      node: {
        fontSize: '12px',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      },
      link: {
        stroke: '#4299e1',
        strokeWidth: 2,
      },
    },
    layout: {
      nodeSpacing: { x: 250, y: 100 },
      padding: { top: 30, right: 30, bottom: 30, left: 30 },
    },
  }
}

/**
 * Custom theme configurations
 */
export const DARK_THEME = {
  node: {
    fontSize: '12px',
    fontFamily: 'monospace',
    fill: '#2d3748',
    stroke: '#4a5568',
    textFill: '#e2e8f0',
  },
  link: {
    stroke: '#718096',
    strokeWidth: 1,
  },
  background: '#1a202c',
}

export const LIGHT_THEME = {
  node: {
    fontSize: '12px',
    fontFamily: 'monospace',
    fill: '#ffffff',
    stroke: '#e2e8f0',
    textFill: '#2d3748',
  },
  link: {
    stroke: '#cbd5e0',
    strokeWidth: 1,
  },
  background: '#ffffff',
}

export const HIERARCHICAL_CONFIG: VisualizerConfig = {
  nodeRenderers: [
    new ContainerNodeRenderer(),
    new EntityNodeRenderer(),
    new DefaultNodeRenderer(),
  ],
  dataTransformer: new HierarchicalDataTransformer(),
  layoutProvider: new TreeLayoutProvider(),
  enableZooming: true,
  theme: DARK_THEME,
  layout: {
    nodeSpacing: { x: 280, y: 120 },
    padding: { top: 40, right: 40, bottom: 40, left: 40 },
  },
  valueProvider: (data: any) => {
    // Custom value extraction for entities
    if (data.measurements && Array.isArray(data.measurements)) {
      const latest = data.measurements[0]
      return latest?.value || latest?.data
    }
    return data.lastValue || data.currentValue || data.value
  },
}
