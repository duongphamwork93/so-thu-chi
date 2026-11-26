import { CategoryInfo } from '../constants/categories';
import { StorageData, Transaction } from '../types/finance';
import { classifyJar, JAR_META } from './jars';

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Xuất toàn bộ giao dịch ra CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt). */
export function exportTransactionsCSV(
  data: StorageData,
  categoryMap: Record<string, CategoryInfo>,
  records: Transaction[] = data.records,
  suffix = 'tat_ca'
) {
  const sourceName = (id?: string) => {
    if (!id) return '';
    return data.accts.find(a => a.id === id)?.name || data.cards.find(c => c.id === id)?.name || id;
  };
  const header = ['Ngày', 'Loại', 'Danh mục', 'Hũ', 'Số tiền', 'Ví / Thẻ', 'Ghi chú', 'Đối tượng', 'Chuyến đi / Sự kiện', 'Không tính báo cáo'];
  const rows = [...records]
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0))
    .map(r => [
      r.date,
      r.type === 'in' ? 'Thu' : 'Chi',
      categoryMap[r.cat]?.name || r.cat,
      r.type === 'out' ? (() => {
        const jar = classifyJar(r, categoryMap);
        return jar ? JAR_META[jar].code : 'Trung tính';
      })() : '',
      r.type === 'in' ? r.amount : -r.amount,
      sourceName(r.accountId),
      r.note || '',
      r.counterparty || '',
      r.tripName || '',
      r.excludeFromReport ? 'x' : '',
    ]);
  const csv = [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);
  download('﻿' + csv, `sothuchi_giao_dich_${suffix}_${stamp}.csv`, 'text/csv;charset=utf-8');
}
