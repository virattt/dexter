import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../theme.js';
import type { AgentEvent } from '../agent/types.js';

/**
 * Format tool name from snake_case to Title Case
 * e.g., get_financial_metrics_snapshot -> Get Financial Metrics Snapshot
 */
function formatToolName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Truncate string at word boundary (before exceeding maxLength)
 */
function truncateAtWord(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  
  // Find last space before maxLength
  const lastSpace = str.lastIndexOf(' ', maxLength);
  
  // If there's a space in a reasonable position (at least 50% of maxLength), use it
  if (lastSpace > maxLength * 0.5) {
    return str.slice(0, lastSpace) + '...';
  }
  
  // No good word boundary - truncate at maxLength
  return str.slice(0, maxLength) + '...';
}

/**
 * Format tool arguments for display - truncate long values at word boundaries
 */
function formatArgs(args: Record<string, unknown>): string {
  // For tools with a single 'query' arg, show it in a clean format
  if (Object.keys(args).length === 1 && 'query' in args) {
    const query = String(args.query);
    return `"${truncateAtWord(query, 60)}"`;
  }
  
  // For other tools, format key=value pairs with truncation
  return Object.entries(args)
    .map(([key, value]) => {
      const strValue = String(value);
      return `${key}=${truncateAtWord(strValue, 60)}`;
    })
    .join(', ');
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Truncate result for display
 */
function truncateResult(result: string, maxLength: number = 100): string {
  if (result.length <= maxLength) {
    return result;
  }
  return result.slice(0, maxLength) + '...';
}

/**
 * Truncate URL to hostname + path for display
 */
function truncateUrl(url: string, maxLen = 45): string {
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + parsed.pathname;
    return display.length <= maxLen ? display : display.slice(0, maxLen) + '...';
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen) + '...' : url;
  }
}

/**
 * Format browser step for consolidated display.
 * Returns null for actions that should not be shown (act steps like click, type).
 */
function formatBrowserStep(args: Record<string, unknown>): string | null {
  const action = args.action as string;
  const url = args.url as string | undefined;

  switch (action) {
    case 'open':
      return `Opening ${truncateUrl(url || '')}`;
    case 'navigate':
      return `Navigating to ${truncateUrl(url || '')}`;
    case 'snapshot':
      return 'Reading page structure';
    case 'read':
      return 'Extracting page text';
    case 'close':
      return 'Closing browser';
    case 'act':
      return null; // Don't show act steps (click, type, etc.)
    default:
      return null;
  }
}

interface ThinkingViewProps {
  message: string;
}

export function ThinkingView({ message }: ThinkingViewProps) {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) return null;

  const displayMessage = trimmedMessage.length > 200 
    ? trimmedMessage.slice(0, 200) + '...' 
    : trimmedMessage;
  
  return (
    <Box>
      <Text>⏺ </Text>
      <Text color={colors.white}>{displayMessage}</Text>
    </Box>
  );
}

interface ToolStartViewProps {
  tool: string;
  args: Record<string, unknown>;
  isActive?: boolean;
  progressMessage?: string;
}

export function ToolStartView({ tool, args, isActive = false, progressMessage }: ToolStartViewProps) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text>⏺ </Text>
        <Text>{formatToolName(tool)}</Text>
        <Text color={colors.muted}>({formatArgs(args)})</Text>
      </Box>
      {isActive && (
        <Box marginLeft={2}>
          <Text color={colors.muted}>⎿  </Text>
          <Text color={colors.muted}>
            <Spinner type="dots" />
          </Text>
          <Text> {progressMessage || 'Searching...'}</Text>
        </Box>
      )}
    </Box>
  );
}

interface ToolEndViewProps {
  tool: string;
  args: Record<string, unknown>;
  result: string;
  duration: number;
}

export function ToolEndView({ tool, args, result, duration }: ToolEndViewProps) {
  // Parse result to get a summary
  let summary = 'Received data';
  
  // Special handling for skill tool
  if (tool === 'skill') {
    const skillName = args.skill as string;
    summary = `Loaded ${skillName} skill`;
  } else {
    try {
      const parsed = JSON.parse(result);
      if (parsed.data) {
        if (Array.isArray(parsed.data)) {
          summary = `Received ${parsed.data.length} items`;
        } else if (typeof parsed.data === 'object') {
          const keys = Object.keys(parsed.data).filter(k => !k.startsWith('_')); // Exclude _errors
          
          // Tool-specific summaries
          if (tool === 'financial_search') {
            summary = keys.length === 1 
              ? `Called 1 data source` 
              : `Called ${keys.length} data sources`;
          } else if (tool === 'web_search') {
            summary = `Did 1 search`;
          } else {
            summary = `Received ${keys.length} fields`;
          }
        }
      }
    } catch {
      // Not JSON, use truncated result
      summary = truncateResult(result, 50);
    }
  }
  
  return (
    <Box flexDirection="column">
      <Box>
        <Text>⏺ </Text>
        <Text>{formatToolName(tool)}</Text>
        <Text color={colors.muted}>({formatArgs(args)})</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.muted}>⎿  </Text>
        <Text>{summary}</Text>
        <Text color={colors.muted}> in {formatDuration(duration)}</Text>
      </Box>
    </Box>
  );
}

interface ToolErrorViewProps {
  tool: string;
  error: string;
}

export function ToolErrorView({ tool, error }: ToolErrorViewProps) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text>⏺ </Text>
        <Text>{formatToolName(tool)}</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.muted}>⎿  </Text>
        <Text color={colors.error}>Error: {truncateResult(error, 80)}</Text>
      </Box>
    </Box>
  );
}

interface ToolLimitViewProps {
  tool: string;
  warning?: string;
}

export function ToolLimitView({ tool, warning }: ToolLimitViewProps) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text>⏺ </Text>
        <Text>{formatToolName(tool)}</Text>
        <Text color={colors.warning}> [NOTE]</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.muted}>⎿  </Text>
        <Text color={colors.warning}>
          {truncateResult(warning || 'Approaching suggested limit', 100)}
        </Text>
      </Box>
    </Box>
  );
}

interface ContextClearedViewProps {
  clearedCount: number;
  keptCount: number;
}

export function ContextClearedView({ clearedCount, keptCount }: ContextClearedViewProps) {
  return (
    <Box>
      <Text>⏺ </Text>
      <Text color={colors.muted}>Context threshold reached - cleared {clearedCount} old tool result{clearedCount !== 1 ? 's' : ''}, kept {keptCount} most recent</Text>
    </Box>
  );
}

/**
 * Accumulated event for display
 * Combines tool_start and tool_end into a single view
 */
export interface DisplayEvent {
  id: string;
  event: AgentEvent;
  completed?: boolean;
  endEvent?: AgentEvent;
  progressMessage?: string;
}

/**
 * Find the current displayable browser step from a list of browser events.
 * Skips 'act' actions and returns the most recent displayable step.
 */
function findCurrentBrowserStep(events: DisplayEvent[], activeStepId?: string): string | null {
  // If there's an active step, try to show it
  if (activeStepId) {
    const activeEvent = events.find(e => e.id === activeStepId);
    if (activeEvent?.event.type === 'tool_start') {
      const step = formatBrowserStep(activeEvent.event.args);
      if (step) return step;
    }
  }
  
  // Otherwise, find the most recent displayable step (working backwards)
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.event.type === 'tool_start') {
      const step = formatBrowserStep(event.event.args);
      if (step) return step;
    }
  }
  
  return null;
}

interface BrowserSessionViewProps {
  events: DisplayEvent[];
  activeStepId?: string;
}

/**
 * Renders a consolidated browser session showing the current step.
 */
function BrowserSessionView({ events, activeStepId }: BrowserSessionViewProps) {
  // Find current displayable step (skip 'act' actions)
  const currentStep = findCurrentBrowserStep(events, activeStepId);

  return (
    <Box flexDirection="column">
      <Box>
        <Text>⏺ </Text>
        <Text>Browser</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.muted}>⎿  </Text>
        {activeStepId && (
          <Text color={colors.muted}><Spinner type="dots" /></Text>
        )}
        {currentStep && <Text>{activeStepId ? ' ' : ''}{currentStep}</Text>}
      </Box>
    </Box>
  );
}

interface AgentEventViewProps {
  event: AgentEvent;
  isActive?: boolean;
  progressMessage?: string;
}

/**
 * Renders a single agent event in Claude Code style
 */
export function AgentEventView({ event, isActive = false, progressMessage }: AgentEventViewProps) {
  switch (event.type) {
    case 'thinking':
      return <ThinkingView message={event.message} />;
    
    case 'tool_start':
      return <ToolStartView tool={event.tool} args={event.args} isActive={isActive} progressMessage={progressMessage} />;
    
    case 'tool_end':
      return <ToolEndView tool={event.tool} args={event.args} result={event.result} duration={event.duration} />;
    
    case 'tool_error':
      return <ToolErrorView tool={event.tool} error={event.error} />;
    
    case 'tool_limit':
      return <ToolLimitView tool={event.tool} warning={event.warning} />;
    
    case 'context_cleared':
      return <ContextClearedView clearedCount={event.clearedCount} keptCount={event.keptCount} />;
    
    case 'answer_start':
    case 'done':
      // These are handled separately by the parent component
      return null;
    
    default:
      return null;
  }
}

// Event grouping types for consolidated display
type EventGroup = 
  | { type: 'browser_session'; id: string; events: DisplayEvent[]; activeStepId?: string }
  | { type: 'single'; displayEvent: DisplayEvent };

/**
 * Groups consecutive browser events into sessions for consolidated display.
 * Non-browser events are kept as single events.
 */
function groupBrowserEvents(events: DisplayEvent[], activeToolId?: string): EventGroup[] {
  const groups: EventGroup[] = [];
  let browserGroup: DisplayEvent[] = [];

  const flushBrowserGroup = () => {
    if (browserGroup.length > 0) {
      const isActive = browserGroup.some(e => e.id === activeToolId);
      groups.push({
        type: 'browser_session',
        id: `browser-${browserGroup[0].id}`,
        events: browserGroup,
        activeStepId: isActive ? activeToolId : undefined,
      });
      browserGroup = [];
    }
  };

  for (const event of events) {
    if (event.event.type === 'tool_start' && event.event.tool === 'browser') {
      browserGroup.push(event);
    } else {
      flushBrowserGroup();
      groups.push({ type: 'single', displayEvent: event });
    }
  }
  flushBrowserGroup();

  return groups;
}

interface EventListViewProps {
  events: DisplayEvent[];
  activeToolId?: string;
}

/**
 * Renders a list of agent events with browser events consolidated into sessions
 */
export function EventListView({ events, activeToolId }: EventListViewProps) {
  const groupedEvents = groupBrowserEvents(events, activeToolId);

  return (
    <Box flexDirection="column" gap={0} marginTop={1}>
      {groupedEvents.map((group) => {
        // Render browser sessions with consolidated view
        if (group.type === 'browser_session') {
          return (
            <Box key={group.id} marginBottom={1}>
              <BrowserSessionView
                events={group.events}
                activeStepId={group.activeStepId}
              />
            </Box>
          );
        }

        // Render single events as before
        const { id, event, completed, endEvent, progressMessage } = group.displayEvent;
        
        // For tool events, show the end state if completed
        if (event.type === 'tool_start' && completed && endEvent?.type === 'tool_end') {
          return (
            <Box key={id} marginBottom={1}>
              <ToolEndView 
                tool={endEvent.tool} 
                args={event.args} 
                result={endEvent.result} 
                duration={endEvent.duration} 
              />
            </Box>
          );
        }
        
        if (event.type === 'tool_start' && completed && endEvent?.type === 'tool_error') {
          return (
            <Box key={id} marginBottom={1}>
              <ToolErrorView tool={endEvent.tool} error={endEvent.error} />
            </Box>
          );
        }
        
        return (
          <Box key={id} marginBottom={1}>
            <AgentEventView 
              event={event} 
              isActive={!completed && id === activeToolId}
              progressMessage={progressMessage}
            />
          </Box>
        );
      })}
    </Box>
  );
}
