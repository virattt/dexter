export const THINKING_VERBS = [
  'Alchemizing', 'Ambling', 'Baking', 'Boogieing',
  'Brainstorming', 'Brewing', 'Buffering', 'Buzzing',
  'Cerebrating', 'Chugging', 'Chugging along', 'Churning',
  'Clauding', 'Cogitating', 'Concocting', 'Conjuring',
  'Cooking', 'Crafting', 'Cruising', 'Daydreaming',
  'Defragmenting', 'Deliberating', 'Dillydallying', 'Divining',
  'Enchanting', 'Fermenting', 'Fiddling', 'Finagling',
  'Finessing', 'Forging', 'Futzing', 'Gallivanting',
  'Gliding', 'Grooving', 'Hatching', 'Hemming and hawing',
  'Humming', 'Hustling', 'Ideating', 'Incanting',
  'Invoking', 'Juggling', 'Kneading', 'Manifesting',
  'Marinating', 'Moseying', 'Mulling', 'Musing',
  'Noodling', 'Percolating', 'Plotting', 'Pondering',
  'Pottering', 'Prancing', 'Purring', 'Puttering',
  'Puzzling', 'Reticulating', 'Revving', 'Riffing',
  'Ruminating', 'Sashaying', 'Sautéing', 'Scampering',
  'Scheming', 'Scribbling', 'Sculpting', 'Seasoning',
  'Shimmying', 'Simmering', 'Sketching', 'Sorcering',
  'Spellcasting', 'Stewing', 'Summoning', 'Swooshing',
  'Thrumming', 'Tinkering', 'Transmuting', 'Trotting',
  'Vibing', 'Waddling', 'Warming up', 'Whipping up',
  'Whirring', 'Whittling', 'Wizarding', 'Woolgathering',
  'Wrangling', 'Zipping', 'Zooming',
] as const;

export function getRandomThinkingVerb(): string {
  return THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
}
