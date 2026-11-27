import React from 'react';
import { AlertTriangle, CalendarCheck, HandCoins, HeartPulse, Layers, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AuditSnapshot } from '../../utils/financialAudit';
import { formatVND, formatVNDShort } from '../../utils/formatters';

export interface AuditAIResult {
  healthScore?: number;
  healthStatus?: string;
  headline?: string;
  liquidity?: { level?: string; verdict?: string };
  jars?: { verdict?: string; items?: Array<{ code: string; comment: string }> };
  issues?: { loansComment?: string; leaksComment?: string; otherFindings?: string[] };
  actionPlan?: Array<{ title: string; detail: string; amount?: number; deadline?: string }>;
}

const LEVEL_STYLE = {
  safe: { box: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', label: 'An toàn', Icon: ShieldCheck },
  warning: { box: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', label: 'Sát ngưỡng', Icon: AlertTriangle },
  danger: { box: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300', label: 'Nguy hiểm', Icon: ShieldAlert },
} as const;

const Card: React.FC<{ step: number; title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ step, title, icon, children }) => (
  <section className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
    <h4 className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
      <span className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-black shrink-0">
        {step}
      </span>
      <span className="flex items-center gap-1.5 min-w-0">
        {icon}
        <span className="leading-snug">{title}</span>
      </span>
    </h4>
    {children}
  </section>
);

const AiNote: React.FC<{ text?: string; pending: boolean }> = ({ text, pending }) =>
  text ? (
    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed p-3 rounded-2xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/60">
      <strong className="text-violet-700 dark:text-violet-300">Cố vấn AI: </strong>
      {text}
    </p>
  ) : pending ? null : (
    <p className="text-[11px] text-slate-400 italic">Bấm "Bắt đầu kiểm toán" để AI nhận xét phần này.</p>
  );

export const AuditReport: React.FC<{ snap: AuditSnapshot; ai: AuditAIResult | null; isLoading: boolean }> = ({ snap, ai, isLoading }) => {
  const level = (ai?.liquidity?.level as keyof typeof LEVEL_STYLE) || snap.liquidity.level;
  const lv = LEVEL_STYLE[level] || LEVEL_STYLE[snap.liquidity.level];
  const jarComment = (code: string) => ai?.jars?.items?.find(i => i.code?.toUpperCase() === code)?.comment;
  const score = typeof ai?.healthScore === 'number' ? Math.round(ai.healthScore) : null;
  const scoreColor = score === null ? '#94A3B8' : score >= 75 ? '#059669' : score >= 50 ? '#F59E0B' : '#E11D48';

  return (
    <div className="space-y-3">
      {/* 1. Điểm sức khoẻ & Chỉ số sống còn */}
      <Card step={1} title="Điểm Sức Khỏe & Chỉ Số Sống Còn" icon={<HeartPulse size={16} className="text-rose-500 shrink-0" />}>
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full border-4 flex items-center justify-center font-black text-xl shrink-0"
            style={{ borderColor: scoreColor, color: scoreColor }}
          >
            {score ?? '–'}
          </div>
          <div className="min-w-0">
            <p className="text-base font-black text-slate-900 dark:text-white">
              {ai?.healthStatus || (isLoading ? 'Đang chấm điểm…' : 'Chưa chấm điểm')}
            </p>
            {ai?.headline && <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-snug">{ai.headline}</p>}
          </div>
        </div>

        <div className={`p-3 rounded-2xl border ${lv.box} space-y-2`}>
          <p className={`text-xs font-bold flex items-center gap-1.5 ${lv.text}`}>
            <lv.Icon size={15} /> Thanh khoản: {lv.label}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex sm:flex-col justify-between gap-1">
              <span className="text-slate-500">Tiền mặt các ví</span>
              <strong className="money-mask tabular-nums text-slate-900 dark:text-white">{formatVND(snap.liquidity.cashTotal)}</strong>
            </div>
            <div className="flex sm:flex-col justify-between gap-1">
              <span className="text-slate-500">Sao kê thẻ phải trả (35 ngày)</span>
              <strong className="money-mask tabular-nums text-rose-600 dark:text-rose-400">{formatVND(snap.liquidity.dueSoonTotal)}</strong>
            </div>
            <div className="flex sm:flex-col justify-between gap-1">
              <span className="text-slate-500">Tiền mặt thực khả dụng</span>
              <strong
                className={`money-mask tabular-nums ${snap.liquidity.realSpendable < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-300'}`}
              >
                {formatVND(snap.liquidity.realSpendable)}
              </strong>
            </div>
          </div>
          {snap.cards.length > 0 && (
            <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
              {snap.cards.map(c => (
                <li key={c.name} className="flex justify-between gap-2">
                  <span className="truncate">
                    💳 {c.name}
                    {c.statementDue > 0 && ` · hạn ${c.dueDate.slice(8, 10)}/${c.dueDate.slice(5, 7)}`}
                  </span>
                  <span className="money-mask tabular-nums shrink-0">
                    {c.statementDue > 0 ? `phải trả ${formatVND(c.statementDue)}` : `dư nợ ${formatVND(c.currentBalance)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {snap.buffer?.active && (
          <div
            className={`p-3 rounded-2xl border text-xs ${
              snap.buffer.shortfall > 0
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <p className="font-bold">
              Vùng đệm chờ lương giữa tháng (đến {snap.buffer.bufferEnd.slice(8, 10)}/{snap.buffer.bufferEnd.slice(5, 7)}):{' '}
              {snap.buffer.shortfall > 0 ? (
                <span className="money-mask">thiếu {formatVND(snap.buffer.shortfall)}</span>
              ) : (
                <span className="money-mask">đủ, dư {formatVND(snap.buffer.surplus)}</span>
              )}
            </p>
            <p className="text-[11px] opacity-90 money-mask">
              {snap.buffer.accountName} có {formatVND(snap.buffer.accountBalance)} / cần {formatVND(snap.buffer.required)}
            </p>
          </div>
        )}
        <AiNote text={ai?.liquidity?.verdict} pending={isLoading} />
      </Card>

      {/* 2. Soi chi tiêu 6 hũ */}
      <Card step={2} title="Soi Chi Tiêu 6 Hũ (Theo Lương Định Mức)" icon={<Layers size={16} className="text-emerald-600 shrink-0" />}>
        <p className="text-[11px] text-slate-500">
          Trần theo <span className="money-mask font-semibold">{formatVNDShort(snap.monthlyIncome)}</span>/tháng · đã qua{' '}
          {snap.period.elapsedPct}% thời gian kỳ ({snap.period.label})
        </p>
        <div className="space-y-2">
          {snap.jars.map(j => {
            const over = j.remaining < 0;
            const near = !over && j.usedPct >= 80;
            const isWorst = snap.worstJar?.key === j.key && j.spent > 0;
            return (
              <div
                key={j.key}
                className={`p-2.5 rounded-2xl border ${isWorst ? 'border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20' : 'border-slate-200/70 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black text-white shrink-0" style={{ backgroundColor: j.color }}>
                      {j.code}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">{j.label}</span>
                    {isWorst && <span className="text-[10px] font-bold text-rose-600">· lẹm nhiều nhất</span>}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      over
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        : near
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {over ? 'Vượt trần' : near ? 'Sắp chạm trần' : 'An toàn'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-2 mt-1 text-[11px] tabular-nums">
                  <span className="text-slate-500">
                    Đã chi <span className="money-mask font-semibold text-slate-700 dark:text-slate-200">{formatVND(j.spent)}</span> /{' '}
                    <span className="money-mask">{formatVND(j.budget)}</span>
                  </span>
                  <strong className={`money-mask ${over ? 'text-rose-600' : 'text-green-600 dark:text-green-400'}`}>
                    {over ? `Vượt ${formatVND(-j.remaining)}` : `Còn ${formatVND(j.remaining)}`}
                  </strong>
                </div>
                {jarComment(j.code) && <p className="text-[11px] text-violet-700 dark:text-violet-300 mt-1">{jarComment(j.code)}</p>}
              </div>
            );
          })}
        </div>
        {snap.totals.neutral > 0 && (
          <p className="text-[11px] text-slate-500">
            Đã tách riêng <strong className="money-mask">{formatVND(snap.totals.neutral)}</strong> giao dịch Trung tính (Cho vay / Mua hộ) — không tính vào 6 hũ.
          </p>
        )}
        <AiNote text={ai?.jars?.verdict} pending={isLoading} />
      </Card>

      {/* 3. Bắt bệnh giao dịch & khoản treo */}
      <Card step={3} title="Bắt Bệnh Giao Dịch & Khoản Treo" icon={<Search size={16} className="text-amber-500 shrink-0" />}>
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <HandCoins size={14} className="text-amber-500" /> Khoản cho vay / mua hộ chưa thu ({snap.pendingLoans.length})
          </p>
          {snap.pendingLoans.length === 0 ? (
            <p className="text-[11px] text-slate-400">Không có khoản treo nào.</p>
          ) : (
            <ul className="space-y-1">
              {snap.pendingLoans.map((l, i) => (
                <li key={i} className="flex justify-between gap-2 text-xs p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30">
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-800 dark:text-slate-100 leading-snug">{l.title}</span>
                    {l.source === 'tx' && <span className="text-[10px] text-slate-500">{l.daysAgo} ngày trước</span>}
                  </span>
                  <strong className="money-mask tabular-nums shrink-0 text-amber-700 dark:text-amber-300">{formatVND(l.amount)}</strong>
                </li>
              ))}
            </ul>
          )}
          <AiNote text={ai?.issues?.loansComment} pending={isLoading} />
        </div>

        <div className="space-y-1.5 pt-1">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">💧 Rò rỉ từ giao dịch lắt nhắt (≤ 500k)</p>
          {snap.leaks.length === 0 ? (
            <p className="text-[11px] text-slate-400">Chưa thấy nhóm chi nhỏ nào lặp lại ≥ 3 lần trong kỳ.</p>
          ) : (
            <ul className="space-y-1">
              {snap.leaks.map(l => (
                <li key={l.label} className="flex justify-between gap-2 text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-800 dark:text-slate-100">{l.label}</span>
                    <span className="text-[10px] text-slate-500">
                      {l.count} lần · TB <span className="money-mask">{formatVND(l.avg)}</span>/lần
                    </span>
                  </span>
                  <strong className="money-mask tabular-nums shrink-0 text-rose-600 dark:text-rose-400">{formatVND(l.total)}</strong>
                </li>
              ))}
            </ul>
          )}
          <AiNote text={ai?.issues?.leaksComment} pending={isLoading} />
        </div>

        {ai?.issues?.otherFindings && ai.issues.otherFindings.length > 0 && (
          <ul className="list-disc pl-5 text-xs text-slate-700 dark:text-slate-300 space-y-1">
            {ai.issues.otherFindings.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        )}
      </Card>

      {/* 4. Kế hoạch 7 ngày */}
      <Card step={4} title="Kế Hoạch Hành Động 7 Ngày Tới" icon={<CalendarCheck size={16} className="text-violet-600 shrink-0" />}>
        {ai?.actionPlan && ai.actionPlan.length > 0 ? (
          <ol className="space-y-2">
            {ai.actionPlan.slice(0, 3).map((a, i) => (
              <li key={i} className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold flex items-center justify-center text-xs shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{a.title}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{a.detail}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {a.amount ? (
                      <span className="money-mask px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                        {formatVND(a.amount)}
                      </span>
                    ) : null}
                    {a.deadline && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                        Hạn {a.deadline}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[11px] text-slate-400 italic">
            {isLoading ? 'AI đang lập kế hoạch…' : 'Bấm "Bắt đầu kiểm toán" để AI lập 3 việc cần làm trong 7 ngày tới.'}
          </p>
        )}
      </Card>
    </div>
  );
};
