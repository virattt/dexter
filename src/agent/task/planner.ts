import { StructuredToolInterface } from '@langchain/core/tools';
import { callLlm, getFastModel } from '../../model/llm.js';
import type { Task, TaskPlan, TaskPlanValidation } from './types.js';
import { extractTextContent } from '../../utils/ai-message.js';

/**
 * System prompt for task planning
 */
const TASK_PLANNING_PROMPT = `You are a task planning assistant for a financial research AI agent.

OBJECTIVE: Break down complex queries into focused, executable subtasks.

═══════════════════════════════════════════════════════════════════
CORE PRINCIPLES
═══════════════════════════════════════════════════════════════════

1. DECOMPOSE for reliability and clarity
   - Each task = ONE clear objective
   - If one task fails, others still succeed
   - Enables future parallel execution

2. WHEN TO DECOMPOSE:
   ✓ Multiple DIFFERENT metrics (P/E + revenue + margins)
   ✓ Multiple companies (AAPL + MSFT)
   ✓ Sequential calculations (fetch → calculate → compare)
   ✓ Temporal analysis (multi-year data + trend analysis)

3. WHEN NOT TO DECOMPOSE:
   ✗ Single metric, single company (just use 1 task)
   ✗ Query answerable with 1 focused tool call

═══════════════════════════════════════════════════════════════════
EXAMPLES
═══════════════════════════════════════════════════════════════════

EXAMPLE 1: Multi-Metric Query (DECOMPOSE)
Query: "Get AAPL P/E ratio, revenue, and profit margins"

✅ GOOD (4 tasks - decomposed by metric):
{
  "tasks": [
    {
      "id": "task_001",
      "description": "Fetch AAPL valuation metrics (P/E ratio)",
      "toolCalls": [{"tool": "financial_metrics", "args": {"query": "AAPL P/E ratio valuation"}}],
      "dependencies": []
    },
    {
      "id": "task_002",
      "description": "Fetch AAPL revenue data",
      "toolCalls": [{"tool": "financial_metrics", "args": {"query": "AAPL revenue"}}],
      "dependencies": []
    },
    {
      "id": "task_003",
      "description": "Fetch AAPL profitability metrics (profit margins)",
      "toolCalls": [{"tool": "financial_metrics", "args": {"query": "AAPL profit margins net margin operating margin"}}],
      "dependencies": []
    },
    {
      "id": "task_004",
      "description": "Synthesize AAPL financial analysis from all metrics",
      "toolCalls": [],
      "dependencies": ["task_001", "task_002", "task_003"]
    }
  ]
}

❌ BAD (1 task - not decomposed):
{
  "tasks": [
    {
      "id": "task_001",
      "description": "Fetch all AAPL metrics",
      "toolCalls": [{"tool": "financial_metrics", "args": {"query": "AAPL P/E revenue margins"}}],
      "dependencies": []
    }
  ]
}

---

EXAMPLE 2: Multi-Company Query (DECOMPOSE)
Query: "Compare AAPL and MSFT revenue"

✅ GOOD (3 tasks):
{
  "tasks": [
    {
      "id": "task_001",
      "description": "Fetch AAPL revenue",
      "toolCalls": [{"tool": "financial_metrics", "args": {"query": "AAPL revenue"}}],
      "dependencies": []
    },
    {
      "id": "task_002",
      "description": "Fetch MSFT revenue",
      "toolCalls": [{"tool": "financial_metrics", "args": {"query": "MSFT revenue"}}],
      "dependencies": []
    },
    {
      "id": "task_003",
      "description": "Compare AAPL and MSFT revenue",
      "toolCalls": [],
      "dependencies": ["task_001", "task_002"]
    }
  ]
}

---

EXAMPLE 3: Calculation Query (DECOMPOSE)
Query: "Calculate AAPL YoY revenue growth"

✅ GOOD (3 tasks):
{
  "tasks": [
    {
      "id": "task_001",
      "description": "Fetch AAPL current year revenue",
      "toolCalls": [{"tool": "financial_metrics", "args": {"query": "AAPL revenue current year"}}],
      "dependencies": []
    },
    {
      "id": "task_002",
      "description": "Fetch AAPL previous year revenue",
      "toolCalls": [{"tool": "financial_metrics", "args": {"query": "AAPL revenue previous year"}}],
      "dependencies": []
    },
    {
      "id": "task_003",
      "description": "Calculate YoY revenue growth rate",
      "toolCalls": [],
      "dependencies": ["task_001", "task_002"]
    }
  ]
}

---

EXAMPLE 4: Single Metric Query (DO NOT DECOMPOSE)
Query: "What is AAPL's stock price?"

✅ GOOD (1 task):
{
  "tasks": [
    {
      "id": "task_001",
      "description": "Fetch AAPL current stock price",
      "toolCalls": [{"tool": "financial_metrics", "args": {"query": "AAPL stock price"}}],
      "dependencies": []
    }
  ]
}

═══════════════════════════════════════════════════════════════════
TASK CREATION RULES
═══════════════════════════════════════════════════════════════════

- Each task has EXACTLY one clear objective
- Tool calls should be SPECIFIC, not generic
- Dependencies must form a valid DAG (no cycles)
- Tasks that can run independently should have NO dependencies
- Final synthesis task (if needed) should have empty toolCalls and depend on data tasks`;

/**
 * Task planner - decomposes queries into structured task plans
 */
export class TaskPlanner {
  /**
   * Create a task plan from a user query.
   * Uses LLM to analyze query and decompose into tasks.
   */
  static async createPlan(
    query: string,
    tools: StructuredToolInterface[],
    model: string,
    modelProvider: string
  ): Promise<TaskPlan> {
    // Use fast model for planning to minimize latency
    const fastModelName = getFastModel(modelProvider, model);
    
    // Ensure model has provider prefix for correct routing in callLlm
    // callLlm uses resolveProvider which checks modelName.startsWith(prefix)
    // For Ollama, 'llama3.2:latest' needs to become 'ollama:llama3.2:latest'
    const providerPrefix = modelProvider === 'ollama' ? 'ollama:' : '';
    const planningModel = providerPrefix && !fastModelName.startsWith(providerPrefix)
      ? `${providerPrefix}${fastModelName}`
      : fastModelName;
    
    // Build tool descriptions
    const toolDescriptions = tools.map(t => ({
      name: t.name,
      description: t.description,
    }));

    const prompt = `${TASK_PLANNING_PROMPT}

Available tools:
${JSON.stringify(toolDescriptions, null, 2)}

User query: "${query}"

Create a task plan:`;

    const { response } = await callLlm(prompt, {
      model: planningModel,
      systemPrompt: 'You are a helpful task planning assistant. Output valid JSON only.',
      tools: undefined, // No tool calling for planning
    });

    const responseText = typeof response === 'string' ? response : extractTextContent(response);
    
    // Extract JSON from response (handle code blocks)
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                      responseText.match(/```\n([\s\S]*?)\n```/) ||
                      [null, responseText];
    
    const jsonStr = jsonMatch[1] || responseText;
    
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('❌ Failed to parse LLM response as JSON');
      if (process.env.DEBUG_LLM_PARSER === 'true') {
        console.error('LLM response (DEBUG_LLM_PARSER enabled):');
        console.error('---');
        console.error(responseText);
        console.error('---');
      }
      throw new Error(`Invalid JSON from LLM: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
      throw new Error('LLM response missing "tasks" array');
    }


    // Build task plan with proper status
    const tasks: Task[] = parsed.tasks.map((t: Partial<Task>) => ({
      id: t.id!,
      description: t.description!,
      status: 'pending' as const,
      toolCalls: t.toolCalls || [],
      dependencies: t.dependencies || [],
    }));

    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return {
      id: planId,
      query,
      tasks,
      createdAt: Date.now(),
    };
  }

  /**
   * Validate a task plan for correctness
   */
  static validatePlan(plan: TaskPlan): TaskPlanValidation {
    const errors: string[] = [];
    const taskIds = new Set(plan.tasks.map(t => t.id));

    // Check for duplicate IDs
    if (taskIds.size !== plan.tasks.length) {
      errors.push('Duplicate task IDs found');
    }

    // Check dependencies reference valid tasks
    for (const task of plan.tasks) {
      for (const depId of task.dependencies) {
        if (!taskIds.has(depId)) {
          errors.push(`Task ${task.id} depends on non-existent task ${depId}`);
        }
      }
    }

    // Check for circular dependencies (simple cycle detection)
    const hasCycle = this.detectCycles(plan.tasks);
    if (hasCycle) {
      errors.push('Circular dependencies detected');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Detect cycles in task dependency graph using DFS
   */
  private static detectCycles(tasks: Task[]): boolean {
    const graph = new Map<string, string[]>();
    for (const task of tasks) {
      graph.set(task.id, task.dependencies);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (taskId: string): boolean => {
      visited.add(taskId);
      recStack.add(taskId);

      const deps = graph.get(taskId) || [];
      for (const depId of deps) {
        if (!visited.has(depId)) {
          if (dfs(depId)) return true;
        } else if (recStack.has(depId)) {
          return true; // Cycle detected
        }
      }

      recStack.delete(taskId);
      return false;
    };

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        if (dfs(task.id)) return true;
      }
    }

    return false;
  }
}
