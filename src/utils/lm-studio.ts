/**
 * LM Studio OpenAI-compatible API utilities.
 */

interface LmStudioModel {
  id?: string;
}

interface LmStudioModelsResponse {
  data?: LmStudioModel[];
}

/**
 * 解析 LM Studio 的模型列表接口地址。
 */
function getLmStudioBaseUrl(): string {
  return process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234/v1';
}

/**
 * 返回环境变量中配置的 LM Studio 默认模型。
 */
function getConfiguredLmStudioModel(): string | null {
  const model = process.env.LM_STUDIO_MODEL?.trim();
  return model || null;
}

/**
 * 从 LM Studio 拉取可用模型；当服务不可达时回退到环境变量中的默认模型。
 */
export async function getLmStudioModels(): Promise<string[]> {
  const configuredModel = getConfiguredLmStudioModel();

  try {
    const response = await fetch(`${getLmStudioBaseUrl()}/models`);

    if (!response.ok) {
      return configuredModel ? [configuredModel] : [];
    }

    const data = (await response.json()) as LmStudioModelsResponse;
    const models = (data.data ?? [])
      .map((model) => model.id?.trim())
      .filter((model): model is string => Boolean(model));

    if (models.length > 0) {
      return models;
    }

    return configuredModel ? [configuredModel] : [];
  } catch {
    return configuredModel ? [configuredModel] : [];
  }
}
