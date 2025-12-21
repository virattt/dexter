import { callLlm } from '../../model/llm.js';
import { UnderstandingSchema } from '../schemas.js';
import { getUnderstandSystemPrompt, buildUnderstandUserPrompt } from '../prompts.js';
import type { UnderstandInput, Understanding } from '../state.js';
import type { MessageHistory } from '../../utils/message-history.js';

// ============================================================================
// Understand Phase
// ============================================================================

export interface UnderstandPhaseOptions {
  model: string;
}

/**
 * The Understand phase extracts intent and entities from the user's query.
 * This is a one-time phase that runs at the start of execution.
 */
export class UnderstandPhase {
  private readonly model: string;

  constructor(options: UnderstandPhaseOptions) {
    this.model = options.model;
  }

  /**
   * Runs the understand phase to extract intent and entities.
   */
  async run(input: UnderstandInput): Promise<Understanding> {
    // Build conversation context if available
    let conversationContext: string | undefined;
    if (input.conversationHistory && input.conversationHistory.hasMessages()) {
      const relevantMessages = await input.conversationHistory.selectRelevantMessages(input.query);
      if (relevantMessages.length > 0) {
        conversationContext = input.conversationHistory.formatForPlanning(relevantMessages);
      }
    }

    // Build the prompt
    const systemPrompt = getUnderstandSystemPrompt();
    const userPrompt = buildUnderstandUserPrompt(input.query, conversationContext);

    // Call LLM with structured output
    const response = await callLlm(userPrompt, {
      systemPrompt,
      model: this.model,
      outputSchema: UnderstandingSchema,
    });

    const result = response as { intent: string; entities: Array<{ type: string; value: string }> };

    // Map to our Understanding type
    return {
      intent: result.intent,
      entities: result.entities.map(e => ({
        type: e.type as Understanding['entities'][0]['type'],
        value: e.value,
      })),
    };
  }
}
