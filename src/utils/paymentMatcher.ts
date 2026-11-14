import { AutoPaymentRule, StorageData, TransactionType } from '../types/finance';

export function normalizePaymentText(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidPaymentTargetId(accountId: string | undefined, data: StorageData): boolean {
  if (!accountId) return false;
  return (
    (data.accts || []).some(a => a.id === accountId) ||
    (data.cards || []).some(c => c.id === accountId)
  );
}

export function getPaymentTargetLabel(accountId: string | undefined, data: StorageData): string {
  if (!accountId) return '';
  const acc = (data.accts || []).find(a => a.id === accountId);
  if (acc) return `🏦 ${acc.name}`;
  const card = (data.cards || []).find(c => c.id === accountId);
  if (card) return `💳 ${card.name}`;
  return '';
}

export function findMatchingPaymentRule(
  text: string | undefined,
  data: StorageData
): { rule: AutoPaymentRule; matchedToken: string } | null {
  const normText = normalizePaymentText(text);
  if (!normText) return null;

  const rules = data.settings?.autoPaymentRules || [];
  for (const rule of rules) {
    if (!rule?.keyword || !isValidPaymentTargetId(rule.accountId, data)) continue;
    const tokens = rule.keyword
      .split(/[,;|]+/)
      .map(t => normalizePaymentText(t))
      .filter(Boolean);

    for (const token of tokens) {
      if (normText.includes(token)) {
        return { rule, matchedToken: token };
      }
    }
  }
  return null;
}

export interface ResolvedPaymentAccount {
  accountId: string;
  reason: 'rule' | 'default' | 'fallback' | 'none';
  matchedKeyword?: string;
}

export function resolveDefaultPaymentAccountId(params: {
  type: TransactionType;
  text?: string;
  data: StorageData;
}): ResolvedPaymentAccount {
  const { type, text, data } = params;

  if (type === 'out') {
    // 1. Keyword rule match (e.g. Grab, Grap, Shopee, Siêu thị...)
    const matched = findMatchingPaymentRule(text, data);
    if (matched) {
      return {
        accountId: matched.rule.accountId,
        reason: 'rule',
        matchedKeyword: matched.matchedToken,
      };
    }

    // 2. Primary default payment card / account
    const defaultId = data.settings?.defaultPaymentAccountId;
    if (defaultId && isValidPaymentTargetId(defaultId, data)) {
      return {
        accountId: defaultId,
        reason: 'default',
      };
    }

    // 3. Standard fallback
    const fallbackId = data.accts?.[0]?.id || data.cards?.[0]?.id || '';
    return {
      accountId: fallbackId,
      reason: fallbackId ? 'fallback' : 'none',
    };
  }

  // For income ('in'), prefer default account ONLY if it is a bank/wallet/cash account (never credit card)
  const defaultId = data.settings?.defaultPaymentAccountId;
  if (defaultId && (data.accts || []).some(a => a.id === defaultId)) {
    return {
      accountId: defaultId,
      reason: 'default',
    };
  }

  const firstAcc = data.accts?.[0]?.id || '';
  return {
    accountId: firstAcc,
    reason: firstAcc ? 'fallback' : 'none',
  };
}
