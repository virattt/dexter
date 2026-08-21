import { afterEach, describe, expect, test } from 'bun:test';
import { clearSkillCache, discoverSkills } from './registry.js';

const realBearerToken = process.env.X_BEARER_TOKEN;
const realXquikApiKey = process.env.XQUIK_API_KEY;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function hasXResearchSkill(): boolean {
  return discoverSkills().some((skill) => skill.name === 'x-research');
}

describe('built-in skill availability', () => {
  afterEach(() => {
    restoreEnv('X_BEARER_TOKEN', realBearerToken);
    restoreEnv('XQUIK_API_KEY', realXquikApiKey);
    clearSkillCache();
  });

  test('hides X research when no X provider is configured', () => {
    delete process.env.X_BEARER_TOKEN;
    delete process.env.XQUIK_API_KEY;
    clearSkillCache();

    expect(hasXResearchSkill()).toBe(false);
  });

  test('shows X research for either supported provider', () => {
    delete process.env.X_BEARER_TOKEN;
    process.env.XQUIK_API_KEY = 'test-xquik-key';
    clearSkillCache();
    expect(hasXResearchSkill()).toBe(true);

    process.env.X_BEARER_TOKEN = 'test-bearer-token';
    delete process.env.XQUIK_API_KEY;
    clearSkillCache();
    expect(hasXResearchSkill()).toBe(true);
  });
});
