import { removeVietnameseAccents } from '../constants/categories';
import { StorageData, Transaction } from '../types/finance';
import { PlusData } from '../types/plus';
import { diffDays } from './period';

export interface PendingLoan {
  txId: string;
  person: string;
  item: string;
  date: string;
  daysAgo: number;
  amount: number;
  sourceName: string;
}

const norm = (s?: string) => removeVietnameseAccents(s || '').replace(/\s+/g, ' ').trim();

const FILLER_RE = /(^|\s)(mua hộ|mua giúp|trả hộ|đặt hộ|cho vay|tạm ứng|ứng trước|cho)(?=\s|$)/giu;

const PERSON_RE = /\b(chị|chi|anh|em|cô|co|chú|chu|bác|bac|dì|di|cậu|cau|mợ|mo|mẹ|me|bố|bo|ông|ong|bà|ba|bạn|ban)\s+([A-ZÀ-Ỹa-zà-ỹđĐ][\wÀ-ỹđĐ]*)/iu;

/** Tách "người được mua hộ" và "tên món" từ đối tượng / ghi chú. */
export function splitLoanParty(tx: Pick<Transaction, 'counterparty' | 'note'>): { person: string; item: string } {
  const note = (tx.note || '').trim();
  if (tx.counterparty?.trim()) {
    const who = tx.counterparty.trim();
    const item = note.replace(new RegExp(who.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').replace(FILLER_RE, ' ').replace(/\s+/g, ' ').trim();
    return { person: who, item: item || note };
  }
  const m = note.match(PERSON_RE);
  if (m) {
    const person = `${m[1].charAt(0).toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2].charAt(0).toUpperCase()}${m[2].slice(1)}`;
    const item = note
      .replace(m[0], '')
      .replace(FILLER_RE, ' ')
      .replace(/^[\s,:;-]+|[\s,:;-]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { person, item };
  }
  return { person: 'Chưa ghi tên', item: note || 'Cho vay / Mua hộ' };
}

/**
 * Khoản "Cho vay / Mua hộ" chưa thu hồi:
 * - chưa được bấm "Đã nhận tiền" (plus.loanSettled), và
 * - chưa thấy bút toán Thu nợ đối ứng (cùng người hoặc cùng số tiền, ghi sau ngày chi).
 */
export function getPendingLoans(data: StorageData, plus: PlusData, todayStr: string): PendingLoan[] {
  const sourceName = (id?: string) =>
    data.cards.find(c => c.id === id)?.name || data.accts.find(a => a.id === id)?.name || '';
  const settledIds = new Set(Object.values(plus.loanSettled));
  const repayments = data.records.filter(
    t => t.type === 'in' && (t.cat === 'thu_no' || t.cat === 'thu_khac') && !settledIds.has(t.id)
  );
  const used = new Set<string>();

  return data.records
    .filter(t => t.type === 'out' && t.cat === 'cho_vay' && !plus.loanSettled[t.id])
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter(t => {
      const { person } = splitLoanParty(t);
      const who = norm(person);
      const match = repayments.find(
        r =>
          !used.has(r.id) &&
          r.date >= t.date &&
          ((who && who !== 'chua ghi ten' && (norm(r.counterparty) === who || norm(r.note).includes(who))) ||
            Math.abs(r.amount - t.amount) < 1000)
      );
      if (match) {
        used.add(match.id);
        return false;
      }
      return true;
    })
    .map(t => {
      const { person, item } = splitLoanParty(t);
      return {
        txId: t.id,
        person,
        item,
        date: t.date,
        daysAgo: Math.max(0, diffDays(t.date, todayStr)),
        amount: t.amount,
        sourceName: sourceName(t.accountId),
      };
    })
    .reverse();
}
