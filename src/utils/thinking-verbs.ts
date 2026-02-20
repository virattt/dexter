export const THINKING_VERBS = [
  'Analyzing', 'Assessing', 'Brainstorming', 'Brewing',
  'Calculating', 'Calibrating', 'Catalyzing', 'Cerebrating',
  'Churning', 'Cogitating', 'Constructing', 'Crafting',
  'Crunching', 'Deliberating', 'Distilling', 'Drafting',
  'Engineering', 'Evaluating', 'Experimenting', 'Finessing',
  'Formulating', 'Forging', 'Hatching', 'Hypothesizing',
  'Ideating', 'Inventing', 'Marinating', 'Modeling',
  'Mulling', 'Musing', 'Observing', 'Percolating',
  'Pondering', 'Processing', 'Puzzling', 'Reviewing',
  'Riffing', 'Ruminating', 'Sculpting', 'Simmering',
  'Sketching', 'Synthesizing', 'Tinkering', 'Triangulating',
  'Verifying', 'Whittling', 'Wrangling',
] as const;

export function getRandomThinkingVerb(): string {
  return THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
}
