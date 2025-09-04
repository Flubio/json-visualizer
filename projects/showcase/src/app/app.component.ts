import type { OnChanges, OnDestroy, OnInit } from '@angular/core'
import type { VisualizerConfig } from 'ngx-json-visualizer'
import { CommonModule, JsonPipe } from '@angular/common'
import { Component, signal } from '@angular/core'
import { createDefaultConfig, JsonVisualizerComponent } from 'ngx-json-visualizer'
import { TreeLayoutProvider } from '../../../ngx-json-visualizer/src/public-api'

@Component({
  selector: 'app-root',
  imports: [CommonModule, JsonVisualizerComponent, JsonPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnChanges, OnDestroy {
  title = 'showcase'

  visualizerConfig: VisualizerConfig = createDefaultConfig()

  draggingEnabled = signal(true)

  isProcessing = signal(false)
  private debounceTimer: number | null = null
  private readonly DEBOUNCE_DELAY = 500 // 500ms delay
  private readonly MAX_JSON_SIZE = 1024 * 1024 // 1MB limit
  private readonly WARN_JSON_SIZE = 100 * 1024 // 100KB warning

  data = signal<any>({
    name: 'John Doe',
    age: 30,
    address: {
      street: '123 Main St',
      city: 'Anytown',
      country: 'USA',
    },
    hobbies: ['reading', 'traveling', 'swimming'],
    education: {
      highSchool: {
        name: 'Anytown High School',
        yearGraduated: 2008,
      },
      university: {
        name: 'State University',
        degree: 'Bachelor of Science in Computer Science',
        yearGraduated: 2012,
      },
    },
    workExperience: [
      {
        company: 'Tech Corp',
        position: 'Software Engineer',
        years: 5,
      },
      {
        company: 'Web Solutions',
        position: 'Frontend Developer',
        years: 3,
      },
    ],
    isActive: true,
    metadata: null,
  })

  ngOnInit(): void {
    this.updateConfig()
  }

  ngOnChanges(): void {
    this.updateConfig()
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
  }

  private updateConfig(): void {
    // Create a compatible config that maintains the original visualizer's look and feel
    this.visualizerConfig = {
      ...createDefaultConfig(),
      enableZooming: true,
      enablePanning: true,
      panSpeedMultiplier: 15,
      enableDragging: this.draggingEnabled(),
      layoutProvider: new TreeLayoutProvider(),
      zoomSpeedMultiplier: 50,
      layout: {
        nodeSpacing: { x: 250, y: 100 },
        padding: { top: 80, right: 80, bottom: 80, left: 80 },
      },
      theme: {
        ...createDefaultConfig().theme,
        // Override with dark theme colors to match original visualizer
        node: {
          fontSize: '14px',
          fontFamily: 'Segoe UI, Arial, sans-serif',
          fill: '#2453b1ff',
          stroke: '#374663ff',
        },
        link: {
          stroke: '#9aa8baff',
          strokeWidth: 1,
        },
      },
    }
  }

  toggleDragging(event: Event): void {
    const target = event.target as HTMLInputElement
    this.draggingEnabled.set(target.checked)
    this.updateConfig()
  }

  onDataChange(event: Event): void {
    const target = event.target as HTMLDivElement
    const jsonText = target.textContent || '{}'

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // Check size limit
    if (jsonText.length > this.MAX_JSON_SIZE) {
      console.warn(`JSON size (${jsonText.length} characters) exceeds limit (${this.MAX_JSON_SIZE}). Skipping processing.`)
      return
    }

    // Warn about large JSONs
    if (jsonText.length > this.WARN_JSON_SIZE) {
      console.warn(`Large JSON detected (${Math.round(jsonText.length / 1024)}KB). Processing may take a moment.`)
    }

    // Set processing state
    this.isProcessing.set(true)

    // Debounce the parsing
    this.debounceTimer = window.setTimeout(() => {
      try {
        const newData = JSON.parse(jsonText)
        console.warn('Updating data signal with new JSON')
        // Create a deep copy to ensure change detection
        this.data.set(JSON.parse(JSON.stringify(newData)))
        console.warn('Data signal updated successfully')
      }
      catch (error) {
        console.warn('Invalid JSON in editor:', error)
        // Keep the previous data if parsing fails
      }
      finally {
        this.isProcessing.set(false)
      }
    }, this.DEBOUNCE_DELAY)
  }
}
