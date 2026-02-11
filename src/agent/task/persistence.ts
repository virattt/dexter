import * as fs from 'fs/promises';
import * as path from 'path';
import type { TaskPlan } from './types.js';

/**
 * Persist and retrieve task plans from disk
 */
export class TaskStore {
  private readonly baseDir: string;

  constructor(baseDir: string = '.dexter/tasks') {
    this.baseDir = baseDir;
  }

  /**
   * Save a task plan to disk
   * Returns the plan ID
   */
  async save(plan: TaskPlan): Promise<string> {
    await this.ensureDir();

    const filename = this.getPlanFilename(plan);
    const filepath = path.join(this.baseDir, filename);

    await fs.writeFile(filepath, JSON.stringify(plan, null, 2), 'utf-8');

    return plan.id;
  }

  /**
   * Load a task plan by ID
   */
  async load(planId: string): Promise<TaskPlan> {
    const files = await fs.readdir(this.baseDir);
    const planFile = files.find(f => f.includes(planId));

    if (!planFile) {
      throw new Error(`Task plan ${planId} not found`);
    }

    const filepath = path.join(this.baseDir, planFile);
    const content = await fs.readFile(filepath, 'utf-8');

    return JSON.parse(content) as TaskPlan;
  }

  /**
   * List all task plans with summary info
   */
  async list(): Promise<Array<{ id: string; query: string; status: string; createdAt: number }>> {
    await this.ensureDir();

    const files = await fs.readdir(this.baseDir);
    const plans: Array<{ id: string; query: string; status: string; createdAt: number }> = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filepath = path.join(this.baseDir, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const plan = JSON.parse(content) as TaskPlan;

        const status = this.getPlanStatus(plan);

        plans.push({
          id: plan.id,
          query: plan.query,
          status,
          createdAt: plan.createdAt,
        });
      } catch {
        // Skip malformed files
        continue;
      }
    }

    // Sort by creation time, newest first
    return plans.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Delete a task plan
   */
  async delete(planId: string): Promise<void> {
    const files = await fs.readdir(this.baseDir);
    const planFile = files.find(f => f.includes(planId));

    if (planFile) {
      const filepath = path.join(this.baseDir, planFile);
      await fs.unlink(filepath);
    }
  }

  /**
   * Ensure the storage directory exists
   */
  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch {
      // Directory exists, ignore
    }
  }

  /**
   * Generate filename for a plan
   * Format: YYYY-MM-DD-HHMMSS_<planId>.json
   */
  private getPlanFilename(plan: TaskPlan): string {
    const date = new Date(plan.createdAt);
    const dateStr = date.toISOString().slice(0, 19).replace(/[T:]/g, '-');
    return `${dateStr}_${plan.id}.json`;
  }

  /**
   * Determine overall plan status from task statuses
   */
  private getPlanStatus(plan: TaskPlan): string {
    const tasks = plan.tasks;

    if (tasks.every(t => t.status === 'complete')) {
      return 'complete';
    }

    if (tasks.some(t => t.status === 'failed')) {
      return 'failed';
    }

    if (tasks.some(t => t.status === 'running')) {
      return 'running';
    }

    return 'pending';
  }
}
