import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFinance, recurringDueDate } from '../context/FinanceContext';
import { usePlus } from '../context/PlusContext';
import { removeVietnameseAccents } from '../constants/categories';
import { formatVND, getTodayDateString } from '../utils/formatters';
import { showToast } from '../utils/toast';

const findByName = <T extends { id: string; name: string }>(list: T[], kw: string) =>
  list.find(x => removeVietnameseAccents(x.name).includes(kw));

/**
 * Chạy nền (không có giao diện):
 * 1) Tạo sẵn 2 mẫu định kỳ một lần duy nhất.
 * 2) Mỗi khi mở app / quay lại app / sang ngày mới → tự ghi sổ các khoản định kỳ đến hạn.
 */
export const RecurringEngine: React.FC = () => {
  const { user, authReady } = useAuth();
  const { data, syncStatus, addRecurring, postRecurring } = useFinance();
  const { plus, updatePlus } = usePlus();
  const lastRunDayRef = useRef<string>('');
  const postRef = useRef(postRecurring);
  postRef.current = postRecurring;

  const ready = authReady && (!user || syncStatus === 'synced');

  // 1) Mẫu khởi tạo
  useEffect(() => {
    if (!ready || plus.recurringSeeded) return;
    const todayStr = getTodayDateString();
    const monthKey = todayStr.slice(0, 7);
    const hasName = (kw: string) => data.recs.some(r => removeVietnameseAccents(r.name).includes(kw));
    const samples = [
      { kw: 'claude', name: 'Claude Pro', amount: 600_000, day: 19, card: 'vib', cat: 'hoc_hanh' },
      { kw: 'youtube', name: 'YouTube Premium', amount: 79_000, day: 25, card: 'tech', cat: 'giai_tri' },
    ];
    samples.forEach(sm => {
      if (hasName(sm.kw)) return;
      const card = findByName(data.cards, sm.card) || data.cards[0];
      addRecurring({
        type: 'out',
        name: sm.name,
        amount: sm.amount,
        cat: sm.cat,
        cycle: 'monthly',
        dayOfMonth: sm.day,
        accountId: card?.id || data.accts[0]?.id,
        autoRecord: true,
        // Ngày trừ tháng này đã qua lúc tạo mẫu → bắt đầu tự ghi từ tháng sau để tránh trùng khoản
        // bạn có thể đã tự ghi tay (vẫn bấm "Ghi ngay" được nếu muốn ghi cho tháng này).
        lastRecorded: recurringDueDate(sm.day, monthKey) <= todayStr ? monthKey : undefined,
      });
    });
    updatePlus({ recurringSeeded: true });
  }, [ready, plus.recurringSeeded]);

  // 2) Tự động ghi sổ
  useEffect(() => {
    if (!ready) return;
    const run = () => {
      const today = getTodayDateString();
      if (lastRunDayRef.current === today) return;
      lastRunDayRef.current = today;
      const posted = postRef.current();
      if (posted.length === 1) {
        const p = posted[0];
        showToast('info', `Đã tự động ghi nhận: ${p.name} ${formatVND(p.amount)}`, p.sourceName ? `Vào ${p.sourceName}` : undefined);
      } else if (posted.length > 1) {
        showToast(
          'info',
          `Đã tự động ghi nhận ${posted.length} khoản định kỳ`,
          posted.map(p => `${p.name} ${formatVND(p.amount)}`).join(' · ')
        );
      }
    };
    // Đợi một nhịp để mẫu vừa tạo / dữ liệu đám mây kịp cập nhật
    const t = setTimeout(run, 600);
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [ready]);

  // Khi danh sách khoản định kỳ thay đổi (thêm/sửa/bật lại), kiểm tra lại ngay trong ngày
  useEffect(() => {
    lastRunDayRef.current = '';
  }, [data.recs]);

  return null;
};
