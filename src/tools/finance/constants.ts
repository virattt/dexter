/**
 * Constants for SEC filing items and other tool-related data.
 */

export const ITEMS_10K_MAP: Record<string, string> = {
  'Item-1': 'Business',
  'Item-1A': 'Risk Factors',
  'Item-1B': 'Unresolved Staff Comments',
  'Item-2': 'Properties',
  'Item-3': 'Legal Proceedings',
  'Item-4': 'Mine Safety Disclosures',
  'Item-5':
    "Market for Registrant's Common Equity, Related Stockholder Matters and Issuer Purchases of Equity Securities",
  'Item-6': '[Reserved]',
  'Item-7': "Management's Discussion and Analysis of Financial Condition and Results of Operations",
  'Item-7A': 'Quantitative and Qualitative Disclosures About Market Risk',
  'Item-8': 'Financial Statements and Supplementary Data',
  'Item-9': 'Changes in and Disagreements With Accountants on Accounting and Financial Disclosure',
  'Item-9A': 'Controls and Procedures',
  'Item-9B': 'Other Information',
  'Item-10': 'Directors, Executive Officers and Corporate Governance',
  'Item-11': 'Executive Compensation',
  'Item-12':
    'Security Ownership of Certain Beneficial Owners and Management and Related Stockholder Matters',
  'Item-13': 'Certain Relationships and Related Transactions, and Director Independence',
  'Item-14': 'Principal Accounting Fees and Services',
  'Item-15': 'Exhibits, Financial Statement Schedules',
  'Item-16': 'Form 10-K Summary',
};

export const ITEMS_10Q_MAP: Record<string, string> = {
  'Item-1': 'Financial Statements',
  'Item-2': "Management's Discussion and Analysis of Financial Condition and Results of Operations",
  'Item-3': 'Quantitative and Qualitative Disclosures About Market Risk',
  'Item-4': 'Controls and Procedures',
};

export function formatItemsDescription(itemsMap: Record<string, string>): string {
  return Object.entries(itemsMap)
    .map(([item, description]) => `  - ${item}: ${description}`)
    .join('\n');
}

