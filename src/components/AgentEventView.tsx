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

interface ThinkingViewProps {
  message: string;
}

export function ThinkingView({ message }: ThinkingViewProps) {
  // Truncate long thinking messages
  const displayMessage = message.length > 200 
    ? message.slice(0, 200) + '...' 
    : message;
  
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
}

export function ToolStartView({ tool, args, isActive = false }: ToolStartViewProps) {
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
          <Text> Searching...</Text>
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

interface AgentEventViewProps {
  event: AgentEvent;
  isActive?: boolean;
}

/**
 * Renders a single agent event in Claude Code style
 */
export function AgentEventView({ event, isActive = false }: AgentEventViewProps) {
  switch (event.type) {
    case 'thinking':
      return <ThinkingView message={event.message} />;
    
    case 'tool_start':
      return <ToolStartView tool={event.tool} args={event.args} isActive={isActive} />;
    
    case 'tool_end':
      return <ToolEndView tool={event.tool} args={event.args} result={event.result} duration={event.duration} />;
    
    case 'tool_error':
      return <ToolErrorView tool={event.tool} error={event.error} />;
    
    case 'answer_start':
    case 'done':
      // These are handled separately by the parent component
      return null;
    
    default:
      return null;
  }
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
}

interface EventListViewProps {
  events: DisplayEvent[];
  activeToolId?: string;
}

/**
 * Renders a list of agent events
 */
export function EventListView({ events, activeToolId }: EventListViewProps) {
  return (
    <Box flexDirection="column" gap={0} marginTop={1}>
      {events.map((displayEvent) => {
        const { id, event, completed, endEvent } = displayEvent;
        
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
            />
          </Box>
        );
      })}
    </Box>
  );
}
