import { BaseChatModel, BaseChatModelParams } from '@langchain/core/language_models/chat_models';
import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatResult, ChatGeneration } from '@langchain/core/outputs';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';

interface TritonChatModelParams extends BaseChatModelParams {
  modelName: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export class TritonChatModel extends BaseChatModel {
  modelName: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  topP: number;

  constructor(params: TritonChatModelParams) {
    super(params);
    this.modelName = params.modelName;
    this.baseUrl = params.baseUrl || 'http://localhost:8000';
    this.temperature = params.temperature || 0.7;
    this.maxTokens = params.maxTokens || 2048;
    this.topP = params.topP || 0.95;
  }

  _llmType(): string {
    return 'triton';
  }

  async _generate(
    messages: BaseMessage[],
    options?: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    void runManager;
    // Convert LangChain messages to the format expected by your Python backend
    const history = this.convertToHistory(messages);

    // Get the last user message as the current query
    const lastMessage = messages[messages.length - 1];
    const currentMessage = lastMessage.content.toString();

    // Build the request payload for your custom Python backend
    const requestPayload = {
      messages: history,
      message: currentMessage,
      max_new_tokens: this.maxTokens,
      temperature: this.temperature,
      top_p: this.topP,
      mode: 'qa', // or 'summarize' depending on use case
    };

    try {
      // Your model expects a JSON string in the 'request_json' input
      const tritonPayload = {
        inputs: [
          {
            name: 'request_json',
            shape: [1],
            datatype: 'BYTES',
            data: [JSON.stringify(requestPayload)],
          },
        ],
      };

      console.log('Sending to Triton:', JSON.stringify(tritonPayload, null, 2));

      const response = await fetch(`${this.baseUrl}/v2/models/${this.modelName}/infer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tritonPayload),
        signal: options?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Triton inference failed: ${response.status} ${response.statusText}: ${errorText}`
        );
      }

      const result = await response.json();
      console.log('Received from Triton:', JSON.stringify(result, null, 2));

      const text = this.extractTextFromResponse(result);

      const generation: ChatGeneration = {
        text,
        message: new AIMessage(text),
      };

      return {
        generations: [generation],
      };
    } catch (error) {
      throw new Error(`Triton inference error: ${error}`);
    }
  }

  private convertToHistory(messages: BaseMessage[]): Array<{ role: string; content: string }> {
    // Convert all messages except the last one to history
    const history = [];

    // Skip the last message as it will be sent as 'message' field
    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i];
      let role = 'user';

      if (msg instanceof AIMessage || msg._getType() === 'ai') {
        role = 'assistant';
      } else if (msg instanceof HumanMessage || msg._getType() === 'human') {
        role = 'user';
      } else if (msg instanceof SystemMessage || msg._getType() === 'system') {
        // Your backend folds system messages into user messages
        role = 'user';
      }

      history.push({
        role: role,
        content: msg.content.toString(),
      });
    }

    return history;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractTextFromResponse(result: any): string {
    // Your model returns: outputs[0].data[0] = JSON string with {"answer": "...", "warnings": [...]}
    if (result.outputs && result.outputs.length > 0) {
      const output = result.outputs[0];
      if (output.name === 'response_json' && output.data && output.data.length > 0) {
        const responseJson = JSON.parse(output.data[0]);

        if (responseJson.warnings && responseJson.warnings.length > 0) {
          console.warn('Triton warnings:', responseJson.warnings);
        }

        let answer = responseJson.answer || '';

        // Fix common UTF-8 encoding issues
        answer = this.fixUtf8Encoding(answer);

        return answer;
      }
    }

    console.error('Unexpected Triton response format:', JSON.stringify(result, null, 2));
    throw new Error('Could not extract answer from Triton response');
  }

  private fixUtf8Encoding(text: string): string {
    // Fix common UTF-8 mojibake patterns - comprehensive list
    const fixes: Record<string, string> = {
      // Box drawing characters
      'âĶĮ': '\u250C', // ┌
      'âĶĢ': '\u2500', // ─
      'âĶĲ': '\u2510', // ┐
      'âĶĤ': '\u2502', // │
      'âĶĶ': '\u251C', // ├
      'âĶ¬': '\u252C', // ┬
      'âĶĺ': '\u2524', // ┤
      'âĶľ': '\u251C', // ├
      'âĶ¼': '\u253C', // ┼
      'âĶ¤': '\u2524', // ┤
      'âĶ´': '\u2534', // ┴
      'âĶļ': '\u2514', // └
      'âĶ¸': '\u2518', // ┘
      'âĶģ': '\u2500', // ─
      // Special characters
      'âĢĻ': '\u2019', // '
      'âĢĩ': '\u2018', // '
      'âĢĵ': '\u2013', // –
      'âĢĶ': '\u2014', // —
      'âĨĴ': '\u2192', // →
      'âĨ ': '\u2190', // ←
      'âĨģ': '\u2191', // ↑
      'âĨĪ': '\u2193', // ↓
    };

    let fixed = text;

    // Apply all fixes
    for (const [broken, correct] of Object.entries(fixes)) {
      fixed = fixed.replaceAll(broken, correct);
    }

    return fixed;
  }
}
