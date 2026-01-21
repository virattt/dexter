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

type TritonHistoryEntry = {
  role: string;
  content: string;
};

type TritonInferenceResponse = {
  outputs?: Array<{
    name?: string;
    data?: string[];
  }>;
};

export class TritonChatModel extends BaseChatModel {
  modelName: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  topP: number;

  constructor(params: TritonChatModelParams) {
    super(params);
    this.modelName = params.modelName;
    this.baseUrl = params.baseUrl || 'http://127.0.0.1:8000';
    this.temperature = params.temperature ?? 0.7;
    this.maxTokens = params.maxTokens ?? 2048;
    this.topP = params.topP ?? 0.95;
  }

  _llmType(): string {
    return 'triton';
  }

  async _generate(
    messages: BaseMessage[],
    options?: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const history = this.convertToHistory(messages);
    const lastMessage = messages[messages.length - 1];
    const currentMessage = lastMessage?.content?.toString() ?? '';

    const requestPayload = {
      messages: history,
      message: currentMessage,
      max_new_tokens: this.maxTokens,
      temperature: this.temperature,
      top_p: this.topP,
      mode: 'qa',
    };

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
      throw new Error(`Triton inference failed: ${response.status} ${response.statusText}: ${errorText}`);
    }

    const result = (await response.json()) as TritonInferenceResponse;
    const text = this.extractTextFromResponse(result);

    const generation: ChatGeneration = {
      text,
      message: new AIMessage(text),
    };

    if (runManager) {
      await runManager.handleLLMEnd({ generations: [[generation]] });
    }

    return { generations: [generation] };
  }

  private convertToHistory(messages: BaseMessage[]): TritonHistoryEntry[] {
    const history: TritonHistoryEntry[] = [];

    for (let i = 0; i < messages.length - 1; i += 1) {
      const msg = messages[i];
      let role = 'user';

      if (msg instanceof AIMessage || msg._getType() === 'ai') {
        role = 'assistant';
      } else if (msg instanceof HumanMessage || msg._getType() === 'human') {
        role = 'user';
      } else if (msg instanceof SystemMessage || msg._getType() === 'system') {
        role = 'user';
      }

      history.push({
        role,
        content: msg.content.toString(),
      });
    }

    return history;
  }

  private extractTextFromResponse(result: TritonInferenceResponse): string {
    if (result.outputs && result.outputs.length > 0) {
      const output = result.outputs[0];
      if (output.name === 'response_json' && output.data && output.data.length > 0) {
        const responseJson = JSON.parse(output.data[0]) as { answer?: string; warnings?: string[] };
        if (responseJson.warnings && responseJson.warnings.length > 0) {
          responseJson.warnings.forEach((warning) => {
            console.warn('Triton warning:', warning);
          });
        }
        return this.fixUtf8Encoding(responseJson.answer || '');
      }
    }

    throw new Error('Could not extract answer from Triton response');
  }

  private fixUtf8Encoding(text: string): string {
    const fixes: Record<string, string> = {
      'âĶĮ': '\u250C',
      'âĶĢ': '\u2500',
      'âĶĲ': '\u2510',
      'âĶĤ': '\u2502',
      'âĶĶ': '\u251C',
      'âĶ¬': '\u252C',
      'âĶĺ': '\u2524',
      'âĶľ': '\u251C',
      'âĶ¼': '\u253C',
      'âĶ¤': '\u2524',
      'âĶ´': '\u2534',
      'âĶļ': '\u2514',
      'âĶ¸': '\u2518',
      'âĶģ': '\u2500',
      'âĢĻ': '\u2019',
      'âĢĩ': '\u2018',
      'âĢĵ': '\u2013',
      'âĢĶ': '\u2014',
      'âĨĴ': '\u2192',
      'âĨ ': '\u2190',
      'âĨģ': '\u2191',
      'âĨĪ': '\u2193',
    };

    let fixed = text;
    for (const [broken, correct] of Object.entries(fixes)) {
      fixed = fixed.replaceAll(broken, correct);
    }
    return fixed;
  }
}
