import React, { useEffect, useMemo } from 'react';
import Ti from '../components/Ti';
import Hero from '../components/Hero';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import { useInsights } from '../lib/data';
import type { Insight, InsightSeverity } from '../lib/types';

interface Props {
  refreshKey?: number;
}

const groups: Array<{ severity: InsightSeverity; roman: string; title: string; card: string; text: string; icon: string }> = [
  { severity: 'danger', roman: 'I', title: 'Atenção urgente', card: 'danger-card', text: 'text-red', icon: 'alert-octagon' },
  { severity: 'warning', roman: 'II', title: 'Pontos de atenção', card: 'warn-card', text: 'text-amber', icon: 'alert-triangle' },
  { severity: 'info', roman: 'III', title: 'Para você saber', card: '', text: 'text-slate', icon: 'info-circle' },
  { severity: 'success', roman: 'IV', title: 'Conquistas', card: 'alert', text: 'text-green', icon: 'sparkles' },
];

export default function InsightsPage({ refreshKey = 0 }: Props) {
  const { data, loading, refresh } = useInsights();

  useEffect(() => {
    if (!refreshKey) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const grouped = useMemo(() => {
    const map = new Map<InsightSeverity, Insight[]>();
    for (const g of groups) map.set(g.severity, []);
    for (const i of data ?? []) {
      const list = map.get(i.severity) ?? [];
      list.push(i);
      map.set(i.severity, list);
    }
    return map;
  }, [data]);

  let counter = 0;

  return (
    <div className="content flex flex-col gap-4" style={{ padding: '26px 28px' }}>
      <Hero
        eyebrow="IV — Análise"
        title={
          <>
            Insights,<br />
            <em>o que os números dizem.</em>
          </>
        }
        note="Observações automáticas a partir do seu comportamento financeiro. Sem alarme, sem pieguice."
      />

      {loading ? (
        <SkeletonCard height={140} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="Nenhum insight ainda"
          description="Os insights surgem automaticamente conforme você lança transações. Volte aqui em alguns dias."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => {
            const list = grouped.get(group.severity) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={group.severity}>
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="font-serif text-[22px] text-text-4 num-mono leading-none">{group.roman}</span>
                  <h2 className="font-serif text-[18px] text-text-1" style={{ letterSpacing: '-0.02em' }}>
                    {group.title}
                  </h2>
                  <Ti name={group.icon} className={group.text} size={14} />
                </div>

                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  {list.map((it) => {
                    counter += 1;
                    return (
                      <article key={it.id} className={`g ${group.card}`}>
                        <div className="flex items-start gap-4">
                          <span className="font-serif text-[20px] text-text-4 num-mono leading-none mt-1">
                            {String(counter).padStart(2, '0')}
                          </span>
                          <div className="flex-1">
                            <h3
                              className="font-serif text-[15px] text-text-1 leading-snug"
                              style={{ letterSpacing: '-0.02em' }}
                            >
                              {it.title}
                            </h3>
                            <p className="text-[12px] text-text-2 leading-relaxed mt-2">{it.description}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
