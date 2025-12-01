import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Intro } from './components/Intro.js';
import { Input } from './components/Input.js';
import { Spinner, SpinnerResult } from './components/Spinner.js';
import { TaskList, TaskStart, TaskDone, ToolRun } from './components/TaskList.js';
import { AnswerBox, UserQuery } from './components/AnswerBox.js';
import { ModelSelector } from './components/ModelSelector.js';
import { Agent, AgentCallbacks } from './agent/agent.js';
import { getSetting, setSetting } from './utils/config.js';
import { ensureApiKeyForModel } from './utils/env.js';
import { DEFAULT_MODEL } from './model/llm.js';
import { colors } from './theme.js';
import type { Task } from './agent/schemas.js';

type AppState = 'idle' | 'running' | 'model_select';

// Discriminated union for type-safe log entries
type LogEntry =
  | { type: 'user_query'; data: string; id: string }
  | { type: 'task_list'; data: Task[]; id: string }
  | { type: 'task_start'; data: string; id: string }
  | { type: 'task_done'; data: string; id: string }
  | { type: 'tool_run'; data: { params: Record<string, unknown>; result: string }; id: string }
  | { type: 'spinner_result'; data: { message: string; success: boolean }; id: string }
  | { type: 'answer'; data: string; id: string }
  | { type: 'log'; data: string; id: string }
  | { type: 'model_changed'; data: string; id: string };

type AddLogFn = (entry: Omit<LogEntry, 'id'>) => void;

// Factory for creating agent callbacks
function createAgentCallbacks(
  addLog: AddLogFn,
  setSpinner: (msg: string | null) => void,
  setStream: (stream: AsyncGenerator<string> | null) => void
): AgentCallbacks {
  return {
    onUserQuery: (q) => addLog({ type: 'user_query', data: q }),
    onTaskList: (tasks) => addLog({ type: 'task_list', data: tasks }),
    onTaskStart: (desc) => addLog({ type: 'task_start', data: desc }),
    onTaskDone: (desc) => addLog({ type: 'task_done', data: desc }),
    onToolRun: (params, result) => addLog({ type: 'tool_run', data: { params, result } }),
    onLog: (msg) => addLog({ type: 'log', data: msg }),
    onSpinnerStart: (msg) => setSpinner(msg),
    onSpinnerStop: (msg, success) => {
      setSpinner(null);
      if (msg) {
        addLog({ type: 'spinner_result', data: { message: msg, success } });
      }
    },
    onAnswerStream: (stream) => setStream(stream),
  };
}

// Component registry for rendering log entries
function LogEntryRenderer({ entry }: { entry: LogEntry }) {
  switch (entry.type) {
    case 'user_query':
      return <UserQuery query={entry.data} />;
    case 'task_list':
      return <TaskList tasks={entry.data} />;
    case 'task_start':
      return <TaskStart description={entry.data} />;
    case 'task_done':
      return <TaskDone description={entry.data} />;
    case 'tool_run':
      return <ToolRun params={entry.data.params} result={entry.data.result} />;
    case 'spinner_result':
      return <SpinnerResult message={entry.data.message} success={entry.data.success} />;
    case 'log':
      return <Text dimColor>{entry.data}</Text>;
    case 'model_changed':
      return (
        <Text color={colors.success}>
          ✓ Model changed to <Text color={colors.primary}>{entry.data}</Text>
        </Text>
      );
    case 'answer':
      return <AnswerBox text={entry.data} />;
  }
}

export function CLI() {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>('idle');
  const [inputValue, setInputValue] = useState('');
  const [currentModel, setCurrentModel] = useState(() => getSetting('model', DEFAULT_MODEL));
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentSpinner, setCurrentSpinner] = useState<string | null>(null);
  const [answerStream, setAnswerStream] = useState<AsyncGenerator<string> | null>(null);
  const [apiKeyReady, setApiKeyReady] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      const ready = await ensureApiKeyForModel(currentModel);
      setApiKeyReady(ready);
      if (!ready) {
        console.error(`Cannot start without API key for ${currentModel}`);
      }
    };
    checkApiKey();
  }, [currentModel]);

  const addLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLogs((prev) => [...prev, { ...entry, id: `${Date.now()}-${Math.random()}` } as LogEntry]);
  }, []);

  const handleAnswerComplete = useCallback((answer: string) => {
    addLog({ type: 'answer', data: answer });
    setAnswerStream(null);
  }, [addLog]);

  const handleSubmit = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

      if (query.trim().toLowerCase() === 'exit' || query.trim().toLowerCase() === 'quit') {
        console.log('Goodbye!');
        exit();
        return;
      }

      if (query.trim() === '/model') {
        setState('model_select');
        return;
      }

      setState('running');
      setInputValue('');

      const callbacks = createAgentCallbacks(addLog, setCurrentSpinner, setAnswerStream);

      try {
        const agent = new Agent({ model: currentModel, callbacks });
        await agent.run(query);
      } catch (e) {
        if ((e as Error).message?.includes('interrupted')) {
          addLog({ type: 'log', data: 'Operation cancelled.' });
        } else {
          addLog({ type: 'log', data: `Error: ${e}` });
        }
      } finally {
        setState('idle');
        setCurrentSpinner(null);
      }
    },
    [currentModel, addLog, exit]
  );

  const handleModelSelect = useCallback(
    async (modelId: string | null) => {
      if (modelId && modelId !== currentModel) {
        const ready = await ensureApiKeyForModel(modelId);
        if (ready) {
          setCurrentModel(modelId);
          setSetting('model', modelId);
          addLog({ type: 'model_changed', data: modelId });
        } else {
          addLog({ type: 'log', data: `Cannot use model ${modelId} without API key.` });
        }
      }
      setState('idle');
    },
    [currentModel, addLog]
  );

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (state === 'running') {
        setState('idle');
        setCurrentSpinner(null);
        addLog({ type: 'log', data: 'Operation cancelled. You can ask a new question or press Ctrl+C again to quit.' });
      } else {
        console.log('\nGoodbye!');
        exit();
      }
    }
  });

  if (state === 'model_select') {
    return (
      <Box flexDirection="column">
        <ModelSelector currentModel={currentModel} onSelect={handleModelSelect} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Intro />

      {logs.map((entry) => (
        <LogEntryRenderer key={entry.id} entry={entry} />
      ))}

      {currentSpinner && (
        <Box marginTop={1}>
          <Spinner message={currentSpinner} />
        </Box>
      )}

      {answerStream && <AnswerBox stream={answerStream} onComplete={handleAnswerComplete} />}

      {state === 'idle' && apiKeyReady && (
        <Box marginTop={1}>
          <Input
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            placeholder="Ask a financial question..."
          />
        </Box>
      )}

      {!apiKeyReady && (
        <Box marginTop={1}>
          <Text color={colors.error}>API key not configured. Please restart and enter your API key.</Text>
        </Box>
      )}
    </Box>
  );
}
