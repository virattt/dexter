import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
} from '@aws-sdk/client-bedrock';
import { Model } from './model';

const client = new BedrockClient({});

/**
 * Fetches all available models from the Bedrock API
 */
export async function getBedrockModels(): Promise<Model[]> {
  try {
    const modelCommand = new ListFoundationModelsCommand({});
    const modelResponse = await client.send(modelCommand);

    const foundationModels =
      modelResponse.modelSummaries
        ?.filter(
          (model) =>
            model.inferenceTypesSupported?.includes('ON_DEMAND') &&
            model.modelLifecycle?.status === 'ACTIVE',
        )
        .map(
          (model) =>
            ({
              id: model.modelId,
              displayName: model.modelName,
            }) as Model,
        ) || [];

    const profileCommand = new ListInferenceProfilesCommand({});
    const profileResponse = await client.send(profileCommand);

    const inferenceProfiles =
      profileResponse.inferenceProfileSummaries
        ?.filter((profile) => profile.status === 'ACTIVE')
        ?.map(
          (profile) =>
            ({
              id: profile.inferenceProfileId,
              displayName: profile.inferenceProfileName,
            }) as Model,
        ) || [];
    return [...inferenceProfiles, ...foundationModels].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  } catch {
    return [];
  }
}
