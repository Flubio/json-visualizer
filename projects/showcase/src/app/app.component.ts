import type { OnChanges, OnInit } from '@angular/core'
import type { VisualizerConfig } from 'ngx-json-visualizer'
import { Component, signal } from '@angular/core'
import { createDefaultConfig, JsonVisualizerComponent } from 'ngx-json-visualizer'
import { TreeLayoutProvider } from '../../../ngx-json-visualizer/src/public-api'

@Component({
  selector: 'app-root',
  imports: [JsonVisualizerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnChanges {
  title = 'showcase'

  visualizerConfig: VisualizerConfig = createDefaultConfig()

  draggingEnabled = signal(true)

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
}
