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

export const ITEMS_8K_MAP: Record<string, string> = {
  'Item-1.01': 'Entry into a Material Definitive Agreement',
  'Item-1.02': 'Termination of a Material Definitive Agreement',
  'Item-1.03': 'Bankruptcy or Receivership',
  'Item-1.04': 'Mine Safety - Reporting of Shutdowns and Patterns of Violations',
  'Item-2.01': 'Completion of Acquisition or Disposition of Assets',
  'Item-2.02': 'Results of Operations and Financial Condition',
  'Item-2.03':
    'Creation of a Direct Financial Obligation or an Obligation under an Off-Balance Sheet Arrangement',
  'Item-2.04': 'Triggering Events That Accelerate or Increase a Direct Financial Obligation',
  'Item-2.05': 'Costs Associated with Exit or Disposal Activities',
  'Item-2.06': 'Material Impairments',
  'Item-3.01': 'Notice of Delisting or Failure to Satisfy a Continued Listing Rule or Standard',
  'Item-3.02': 'Unregistered Sales of Equity Securities',
  'Item-3.03': 'Material Modification to Rights of Security Holders',
  'Item-4.01': "Changes in Registrant's Certifying Accountant",
  'Item-4.02': 'Non-Reliance on Previously Issued Financial Statements or a Related Audit Report',
  'Item-5.01': 'Changes in Control of Registrant',
  'Item-5.02':
    'Departure of Directors or Certain Officers; Election of Directors; Appointment of Certain Officers',
  'Item-5.03': 'Amendments to Articles of Incorporation or Bylaws; Change in Fiscal Year',
  'Item-5.04': "Temporary Suspension of Trading Under Registrant's Employee Benefit Plans",
  'Item-5.05':
    "Amendment to Registrant's Code of Ethics, or Waiver of a Provision of the Code of Ethics",
  'Item-5.06': 'Change in Shell Company Status',
  'Item-5.07': 'Submission of Matters to a Vote of Security Holders',
  'Item-5.08': 'Shareholder Director Nominations',
  'Item-6.01': 'ABS Informational and Computational Material',
  'Item-6.02': 'Change of Servicer or Trustee',
  'Item-6.03': 'Change in Credit Enhancement or Other External Support',
  'Item-6.04': 'Failure to Make a Required Distribution',
  'Item-6.05': 'Securities Act Updating Disclosure',
  'Item-7.01': 'Regulation FD Disclosure',
  'Item-8.01': 'Other Events',
  'Item-9.01': 'Financial Statements and Exhibits',
};

export const ITEMS_10K = Object.keys(ITEMS_10K_MAP);
export const ITEMS_10Q = Object.keys(ITEMS_10Q_MAP);
export const ITEMS_8K = Object.keys(ITEMS_8K_MAP);

export function formatItemsDescription(itemsMap: Record<string, string>): string {
  return Object.entries(itemsMap)
    .map(([item, description]) => `  - ${item}: ${description}`)
    .join('\n');
}

