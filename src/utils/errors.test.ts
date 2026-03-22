import { describe, expect, test } from 'bun:test';
import { formatUserFacingError } from './errors.js';

describe('formatUserFacingError', () => {
  test('returns Azure-specific auth guidance for Azure provider', () => {
    const message = formatUserFacingError('401 unauthorized', 'Azure Foundry');

    expect(message).toContain('credentials are invalid or expired');
    expect(message).toContain('az login');
    expect(message).toContain('AZURE_OPENAI_SCOPE');
  });

  test('returns API key guidance for non-Azure providers', () => {
    const message = formatUserFacingError('401 unauthorized', 'OpenAI');

    expect(message).toContain('API key is invalid or expired');
  });
});
