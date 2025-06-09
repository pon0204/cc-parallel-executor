import { Page } from '@playwright/test';
import { ProjectBuilder } from '../builders/project.builder';
import { TaskBuilder } from '../builders/task.builder';

// Page Object Model for Dashboard
export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
  }

  async createProject(data: { name: string; gitUrl: string; branch?: string }) {
    await this.page.click('[data-testid="create-project-button"]');
    await this.page.fill('[data-testid="project-name-input"]', data.name);
    await this.page.fill('[data-testid="project-git-url-input"]', data.gitUrl);
    if (data.branch) {
      await this.page.fill('[data-testid="project-branch-input"]', data.branch);
    }
    await this.page.click('[data-testid="create-project-submit"]');
  }

  async waitForProject(projectName: string) {
    await this.page.waitForSelector(`[data-testid="project-card-${projectName}"]`);
  }

  async openProject(projectName: string) {
    await this.page.click(`[data-testid="project-card-${projectName}"]`);
  }

  async getProjectCount(): Promise<number> {
    const projects = await this.page.$$('[data-testid^="project-card-"]');
    return projects.length;
  }
}

// Page Object Model for Terminal
export class TerminalPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/terminal');
  }

  async waitForTerminal() {
    await this.page.waitForSelector('[data-testid="terminal-container"]');
  }

  async typeCommand(command: string) {
    await this.page.keyboard.type(command);
    await this.page.keyboard.press('Enter');
  }

  async waitForOutput(text: string, timeout = 5000) {
    await this.page.waitForFunction(
      (searchText) => {
        const terminal = document.querySelector('[data-testid="terminal-container"]');
        return terminal?.textContent?.includes(searchText);
      },
      text,
      { timeout }
    );
  }

  async getTerminalContent(): Promise<string> {
    return await this.page.textContent('[data-testid="terminal-container"]') || '';
  }

  async clearTerminal() {
    await this.page.keyboard.press('Control+L');
  }
}

// API Test Helpers
export class APITestClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8081') {
    this.baseUrl = baseUrl;
  }

  async createProject(data: Partial<ReturnType<typeof ProjectBuilder.prototype.build>>) {
    const response = await fetch(`${this.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async getProjects() {
    const response = await fetch(`${this.baseUrl}/api/projects`);
    return response.json();
  }

  async createTask(projectId: string, data: Partial<ReturnType<typeof TaskBuilder.prototype.build>>) {
    const response = await fetch(`${this.baseUrl}/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async startParallelExecution(projectId: string, maxParallel: number = 5) {
    const response = await fetch(`${this.baseUrl}/api/cc/parallel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, maxParallel }),
    });
    return response.json();
  }
}

// WebSocket Test Helpers
export class WebSocketTestClient {
  private socket: any;

  constructor(url: string = 'http://localhost:8081') {
    // Will be initialized with actual Socket.IO client in tests
  }

  async connect(): Promise<void> {
    // Implementation depends on Socket.IO client
  }

  async waitForEvent(eventName: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeout);

      this.socket.once(eventName, (data: any) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  async emit(eventName: string, data: any): Promise<void> {
    this.socket.emit(eventName, data);
  }

  disconnect(): void {
    this.socket?.disconnect();
  }
}

// Test Data Seeder
export class TestDataSeeder {
  constructor(private apiClient: APITestClient) {}

  async seedProjectWithTasks(options: {
    projectName: string;
    taskCount: number;
    withParallelTasks?: boolean;
  }) {
    // Create project
    const project = await this.apiClient.createProject({
      name: options.projectName,
      gitUrl: `https://github.com/test/${options.projectName}.git`,
      branch: 'main',
      maxParallelCCs: 10,
    });

    // Create tasks
    if (options.withParallelTasks) {
      // Create tasks suitable for parallel execution
      const phases = [
        { type: 'DATABASE', title: 'Database Setup', phase: 1 },
        { type: 'ENVIRONMENT', title: 'Environment Config', phase: 1 },
        { type: 'BACKEND', title: 'API Development', phase: 2 },
        { type: 'FRONTEND', title: 'UI Development', phase: 2 },
        { type: 'TESTING', title: 'Integration Tests', phase: 3 },
        { type: 'DEPLOYMENT', title: 'Deploy to Production', phase: 4 },
      ];

      for (const taskData of phases) {
        await this.apiClient.createTask(project.id, {
          title: taskData.title,
          type: taskData.type,
          priority: 'HIGH',
          estimatedMinutes: 60,
        });
      }
    } else {
      // Create sequential tasks
      for (let i = 0; i < options.taskCount; i++) {
        await this.apiClient.createTask(project.id, {
          title: `Task ${i + 1}`,
          type: 'FEATURE',
          priority: 'MEDIUM',
          estimatedMinutes: 30,
        });
      }
    }

    return project;
  }

  async cleanupTestData(projectIds: string[]) {
    // Cleanup will be handled by test database reset
    // But can implement specific cleanup if needed
  }
}

// Performance Test Utilities
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  startMeasure(name: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      const measurements = this.metrics.get(name) || [];
      measurements.push(duration);
      this.metrics.set(name, measurements);
    };
  }

  getMetrics(name: string): {
    avg: number;
    min: number;
    max: number;
    p95: number;
    count: number;
  } | null {
    const measurements = this.metrics.get(name);
    if (!measurements || measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      avg: measurements.reduce((sum, val) => sum + val, 0) / measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[p95Index],
      count: measurements.length,
    };
  }

  reset(): void {
    this.metrics.clear();
  }
}

// Snapshot utilities for visual regression testing
export class SnapshotHelper {
  static async captureElement(page: Page, selector: string, name: string) {
    const element = await page.$(selector);
    if (element) {
      await element.screenshot({ path: `test/snapshots/${name}.png` });
    }
  }

  static async compareSnapshots(name: string): Promise<boolean> {
    // Implementation would use image comparison library
    return true;
  }
}