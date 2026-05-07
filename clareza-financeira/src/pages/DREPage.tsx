import React, { useEffect, useMemo, useState } from 'react';
import Ti from '../components/Ti';
import Hero from '../components/Hero';
import { SkeletonCard } from '../components/Skeleton';
import { useMonthlyStatement, useMonthTransactions, currentMonth, useCategories } from '../lib/data';
import type { Category, Transaction } from '../lib/types';

interface Props {
  refreshKey?: number;
}

const FIXED_KEYWORDS = [
  'moradia', 'aluguel', 'energia', 'luz', 'água', 'internet', 'plano', 'saúde', 'educação', 'assinatura',
];

function isFixed(name: string) {
  const lower = name.toLowerCase();
  return FIXED_KEYWORDS.some((k) => lower.includes(k));
}

const monthOptions = (() => {
  const out: { id: string; year: number; month: number; label: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const label = d
      .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      .replace('.', '');
    out.push({
      id: `${y}-${String(m).padStart(2, '0')}`,
      year: y,
      month: m,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    });
  }
  return out;
})();

const fmt = (v: number) => {
  const abs = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${abs})` : abs;
};
const pct = (v: number, base: number) => {
  if (!base) return '—';
  return ((v / base) * 100).toFixed(1).replace('.', ',') + '%';
};

interface CategoryNode {
  key: string; // category id or 'uncategorized'
  name: string;
  color: string | null;
  icon: string | null;
  total: number;
  children: CategoryNode[];
}

interface DreSection {
  id: string;
  label: string;
  tone: 'income' | 'expense' | 'neutral';
  prefix: '+' | '−';
  total: number;
  nodes: CategoryNode[];
}

function buildHierarchy(
  txs: Transaction[],
  filter: (t: Transaction) => boolean,
  categoriesById: Map<string, Category>
): { nodes: CategoryNode[]; total: number } {
  const roots = new Map<string, CategoryNode>();
  const ensureRoot = (key: string, name: string, color: string | null, icon: string | null) => {
    let n = roots.get(key);
    if (!n) {
      n = { key, name, color, icon, total: 0, children: [] };
      roots.set(key, n);
    }
    return n;
  };

  let total = 0;
  for (const t of txs) {
    if (!filter(t)) continue;
    const amt = Number(t.amount);
    total += amt;

    const cat = t.category;
    if (!cat) {
      const root = ensureRoot('uncategorized', 'Sem categoria', null, null);
      root.total += amt;
      continue;
    }

    const parent = cat.parent_id ? categoriesById.get(cat.parent_id) : null;

    if (parent) {
      const p = ensureRoot(parent.id, parent.name, parent.color ?? null, parent.icon ?? null);
      p.total += amt;
      let child = p.children.find((c) => c.key === cat.id);
      if (!child) {
        child = { key: cat.id, name: cat.name, color: cat.color ?? null, icon: cat.icon ?? null, total: 0, children: [] };
        p.children.push(child);
      }
      child.total += amt;
    } else {
      const root = ensureRoot(cat.id, cat.name, cat.color ?? null, cat.icon ?? null);
      root.total += amt;
    }
  }

  const arr = Array.from(roots.values()).sort((a, b) => b.total - a.total);
  arr.forEach((n) => n.children.sort((a, b) => b.total - a.total));
  return { nodes: arr, total };
}

export default function DREPage({ refreshKey = 0 }: Props) {
  const cur = currentMonth();
  const [periodId, setPeriodId] = useState(`${cur.year}-${String(cur.month).padStart(2, '0')}`);
  const period = monthOptions.find((m) => m.id === periodId) ?? monthOptions[0];

  const stmt = useMonthlyStatement(period.year, period.month);
  const monthTx = useMonthTransactions(period.year, period.month);
  const categories = useCategories();
  const categoriesById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories.data ?? []) m.set(c.id, c);
    return m;
  }, [categories.data]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    income: true,
    fixed: true,
    variable: true,
    debt: true,
    invest: false,
  });
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!refreshKey) return;
    stmt.refresh();
    monthTx.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const dre = useMemo(() => {
    const txs = (monthTx.data ?? []).filter((t) => t.status !== 'canceled' && t.status !== 'planned');

    const incomes = buildHierarchy(txs, (t) => t.type === 'income', categoriesById);
    const fixed = buildHierarchy(
      txs,
      (t) => {
        if (t.type !== 'expense') return false;
        const cat = t.category;
        const parentName = cat?.parent_id ? categoriesById.get(cat.parent_id)?.name ?? '' : '';
        const name = parentName || cat?.name || '';
        return isFixed(name);
      },
      categoriesById
    );
    const variable = buildHierarchy(
      txs,
      (t) => {
        if (t.type !== 'expense') return false;
        const cat = t.category;
        const parentName = cat?.parent_id ? categoriesById.get(cat.parent_id)?.name ?? '' : '';
        const name = parentName || cat?.name || '';
        return !isFixed(name);
      },
      categoriesById
    );
    const debt = buildHierarchy(txs, (t) => t.type === 'debt_payment', categoriesById);
    const invest = buildHierarchy(txs, (t) => t.type === 'investment', categoriesById);

    const receitaLiquida = incomes.total;
    const resultadoOperacional = receitaLiquida - fixed.total;
    const resultadoAntesDividas = resultadoOperacional - variable.total;
    const resultadoLiquido = resultadoAntesDividas - debt.total - invest.total;

    const sections: DreSection[] = [
      { id: 'income', label: '(+) Receitas', tone: 'income', prefix: '+', total: incomes.total, nodes: incomes.nodes },
      { id: 'fixed', label: '(−) Despesas fixas', tone: 'expense', prefix: '−', total: fixed.total, nodes: fixed.nodes },
      { id: 'variable', label: '(−) Despesas variáveis', tone: 'expense', prefix: '−', total: variable.total, nodes: variable.nodes },
      { id: 'debt', label: '(−) Serviço da dívida', tone: 'expense', prefix: '−', total: debt.total, nodes: debt.nodes },
    ];
    if (invest.total > 0 || invest.nodes.length > 0) {
      sections.push({ id: 'invest', label: '(−) Investimentos', tone: 'expense', prefix: '−', total: invest.total, nodes: invest.nodes });
    }

    return {
      sections,
      receitaLiquida,
      resultadoOperacional,
      resultadoAntesDividas,
      resultadoLiquido,
    };
  }, [monthTx.data, categoriesById]);

  const margemBruta = 100; // sem deduções modeladas, igual a 100%
  const margemOperacional = dre.receitaLiquida > 0 ? (dre.resultadoOperacional / dre.receitaLiquida) * 100 : 0;
  const margemLiquida = dre.receitaLiquida > 0 ? (dre.resultadoLiquido / dre.receitaLiquida) * 100 : 0;

  const toggleSection = (id: string) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleCategory = (id: string) =>
    setOpenCategories((prev) => ({ ...prev, [id]: !prev[id] }));

  const expandAll = () => {
    const sec: Record<string, boolean> = {};
    const cat: Record<string, boolean> = {};
    for (const s of dre.sections) {
      sec[s.id] = true;
      for (const n of s.nodes) {
        if (n.children.length > 0) cat[n.key] = true;
      }
    }
    setOpenSections(sec);
    setOpenCategories(cat);
  };
  const collapseAll = () => {
    setOpenSections({});
    setOpenCategories({});
  };

  const loading = monthTx.loading;

  return (
    <div className="content flex flex-col gap-4" style={{ padding: '26px 28px' }}>
      <Hero
        eyebrow="I — Visão · Demonstração do resultado"
        title={
          <>
            DRE pessoal,<br />
            <em>{period.label}.</em>
          </>
        }
        note="Receita, despesas, dívidas e resultado — agrupados por categoria. Clique para abrir cada bloco e ver subcategorias."
        badges={
          <>
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="tb-pill cursor-pointer appearance-none"
              style={{ paddingRight: 28 }}
            >
              {monthOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button className="tb-pill" onClick={expandAll} title="Abrir todos">
              <Ti name="layout-rows" />
              Expandir
            </button>
            <button className="tb-pill" onClick={collapseAll} title="Fechar todos">
              <Ti name="layout-collage" />
              Recolher
            </button>
            <button
              className="tb-pill"
              onClick={() => {
                expandAll();
                setTimeout(() => window.print(), 200);
              }}
              title="Imprimir / salvar como PDF"
            >
              <Ti name="printer" />
              PDF
            </button>
          </>
        }
      />

      <section className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <Margin label="Margem bruta" value={margemBruta} hint="Receita líquida ÷ bruta" />
        <Margin label="Margem operacional" value={margemOperacional} hint="Após despesas fixas" />
        <Margin
          label="Margem líquida"
          value={margemLiquida}
          hint="Resultado final ÷ receita líquida"
          tone={dre.resultadoLiquido >= 0 ? 'pos' : 'neg'}
        />
      </section>

      {loading ? (
        <SkeletonCard height={400} />
      ) : (
        <article className="g" style={{ padding: '8px 24px 18px' }}>
          <header
            className="flex items-end justify-between"
            style={{ padding: '14px 0 14px', borderBottom: '0.5px solid var(--border)' }}
          >
            <div>
              <div className="g-label" style={{ marginBottom: 6, color: 'var(--green)' }}>
                Demonstração do resultado
              </div>
              <h2 className="font-serif text-[24px] text-text-1" style={{ letterSpacing: '-0.025em' }}>
                {period.label}
              </h2>
              <div className="text-[10px] text-text-4 mt-0.5 uppercase" style={{ letterSpacing: '0.12em' }}>
                Pessoa física · em reais
              </div>
            </div>
            <div className="hidden sm:flex gap-10 g-label pb-1">
              <span>Valor</span>
              <span>% rec. líq.</span>
            </div>
          </header>

          <div className="pt-2">
            {dre.sections.map((section, idx) => {
              const open = !!openSections[section.id];
              const signedTotal = section.tone === 'income' ? section.total : -section.total;
              const colorTone =
                section.tone === 'income' ? 'text-green' : section.tone === 'expense' ? 'text-red' : 'text-text-3';

              return (
                <div key={section.id} className="mt-3 first:mt-0">
                  {/* Section header (clickable) */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full grid grid-cols-12 items-center py-2.5 hover:bg-bg/40 transition-colors rounded-md"
                    style={{
                      borderTop: idx === 0 ? 'none' : '0.5px solid var(--border-lt)',
                      paddingLeft: 4,
                      paddingRight: 8,
                    }}
                  >
                    <div className="col-span-7 flex items-center gap-2">
                      <Ti
                        name={open ? 'chevron-down' : 'chevron-right'}
                        size={13}
                        className="text-text-3"
                      />
                      <span
                        className={`text-[10.5px] uppercase font-semibold ${colorTone}`}
                        style={{ letterSpacing: '0.12em' }}
                      >
                        {section.label}
                      </span>
                      <span className="text-[10px] text-text-4 ml-1">
                        {section.nodes.length} {section.nodes.length === 1 ? 'categoria' : 'categorias'}
                      </span>
                    </div>
                    <span
                      className={`col-span-3 text-right font-serif text-[15px] ${
                        signedTotal < 0 ? 'text-red' : 'text-text-1'
                      }`}
                      style={{ letterSpacing: '-0.02em' }}
                    >
                      {fmt(signedTotal)}
                    </span>
                    <span className="col-span-2 text-right num-mono text-[10.5px] text-text-3 pr-1">
                      {pct(signedTotal, dre.receitaLiquida)}
                    </span>
                  </button>

                  {/* Section body */}
                  {open && (
                    <div className="pl-2">
                      {section.nodes.length === 0 ? (
                        <div className="text-[12px] text-text-4 py-2 pl-6">
                          Nenhuma movimentação nessa categoria.
                        </div>
                      ) : (
                        section.nodes.map((node) => {
                          const sign = section.tone === 'income' ? 1 : -1;
                          const nodeOpen = !!openCategories[node.key];
                          const hasChildren = node.children.length > 0;
                          const color = node.color ?? '#9CA3AF';
                          return (
                            <div key={node.key} className="ml-2">
                              <button
                                onClick={() => hasChildren && toggleCategory(node.key)}
                                className={`w-full grid grid-cols-12 items-center py-1.5 rounded transition-colors ${
                                  hasChildren ? 'hover:bg-bg/50 cursor-pointer' : 'cursor-default'
                                }`}
                                style={{ paddingLeft: 12 }}
                              >
                                <div className="col-span-7 flex items-center gap-2 min-w-0">
                                  {hasChildren ? (
                                    <Ti
                                      name={nodeOpen ? 'chevron-down' : 'chevron-right'}
                                      size={12}
                                      className="text-text-3 flex-shrink-0"
                                    />
                                  ) : (
                                    <span className="w-3 flex-shrink-0" />
                                  )}
                                  <span
                                    className="h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ background: `${color}26` }}
                                  >
                                    <span
                                      className="h-1.5 w-1.5 rounded-full"
                                      style={{ background: color }}
                                    />
                                  </span>
                                  <span className="text-[12.5px] text-text-2 truncate">{node.name}</span>
                                  {hasChildren && (
                                    <span
                                      className="text-[9.5px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                                      style={{
                                        background: 'var(--bg)',
                                        color: 'var(--text-3)',
                                      }}
                                    >
                                      {node.children.length} sub
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`col-span-3 text-right num-mono text-[12px] ${
                                    sign < 0 ? 'text-red' : 'text-text-1'
                                  }`}
                                >
                                  {fmt(sign * node.total)}
                                </span>
                                <span className="col-span-2 text-right num-mono text-[10.5px] text-text-4 pr-1">
                                  {pct(sign * node.total, dre.receitaLiquida)}
                                </span>
                              </button>

                              {/* Subcategories */}
                              {hasChildren && nodeOpen && (
                                <div className="ml-6 mt-0.5 mb-1.5">
                                  {node.children.map((child) => {
                                    const childColor = child.color ?? color;
                                    const childPct = node.total ? (child.total / node.total) * 100 : 0;
                                    return (
                                      <div
                                        key={child.key}
                                        className="grid grid-cols-12 items-center py-1"
                                        style={{ paddingLeft: 16 }}
                                      >
                                        <div className="col-span-7 flex items-center gap-2 min-w-0">
                                          <span
                                            className="h-1 w-3 rounded flex-shrink-0"
                                            style={{ background: childColor, opacity: 0.6 }}
                                          />
                                          <span className="text-[11.5px] text-text-3 truncate">{child.name}</span>
                                          <span className="text-[10px] text-text-4 num-mono flex-shrink-0">
                                            {childPct.toFixed(0)}% do pai
                                          </span>
                                        </div>
                                        <span
                                          className={`col-span-3 text-right num-mono text-[11px] ${
                                            sign < 0 ? 'text-red' : 'text-text-2'
                                          }`}
                                        >
                                          {fmt(sign * child.total)}
                                        </span>
                                        <span className="col-span-2 text-right num-mono text-[10px] text-text-4 pr-1">
                                          {pct(sign * child.total, dre.receitaLiquida)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Subtotals */}
            <Subtotal label="(=) Receita líquida" value={dre.receitaLiquida} base={dre.receitaLiquida} />
            <Subtotal
              label="(=) Resultado operacional"
              value={dre.resultadoOperacional}
              base={dre.receitaLiquida}
            />
            <Subtotal
              label="(=) Resultado antes do serviço da dívida"
              value={dre.resultadoAntesDividas}
              base={dre.receitaLiquida}
            />

            {/* Total */}
            <div
              className="grid grid-cols-12 py-4 mt-3 items-baseline"
              style={{
                borderTop: '3px double var(--text-2)',
                borderBottom: '0.5px solid var(--border)',
                background: 'var(--bg)',
                borderRadius: 6,
                paddingLeft: 12,
                paddingRight: 12,
              }}
            >
              <span
                className="col-span-7 font-serif text-[18px] text-text-1"
                style={{ letterSpacing: '-0.025em' }}
              >
                (=) Resultado líquido do período
              </span>
              <span
                className={`col-span-3 text-right font-serif text-[22px] ${
                  dre.resultadoLiquido < 0 ? 'text-red' : 'text-green'
                }`}
                style={{ letterSpacing: '-0.025em' }}
              >
                {fmt(dre.resultadoLiquido)}
              </span>
              <span
                className={`col-span-2 text-right font-serif text-[14px] ${
                  dre.resultadoLiquido < 0 ? 'text-red' : 'text-green'
                }`}
              >
                {pct(dre.resultadoLiquido, dre.receitaLiquida)}
              </span>
            </div>
          </div>

          <footer
            className="mt-4 pt-3 text-[10px] text-text-4 flex flex-wrap gap-x-6 gap-y-1"
            style={{ borderTop: '0.5px solid var(--border-lt)' }}
          >
            <span>
              <span className="text-text-3 mr-1">¹</span>
              Valores entre parênteses representam saídas.
            </span>
            <span>
              <span className="text-text-3 mr-1">²</span>
              Categorias com palavras-chave de "moradia/saúde/assinatura" caem em fixas.
            </span>
            <span>
              <span className="text-text-3 mr-1">³</span>
              Lançamentos planejados e cancelados são ignorados na DRE.
            </span>
          </footer>
        </article>
      )}

      {stmt && null}
    </div>
  );
}

function Subtotal({ label, value, base }: { label: string; value: number; base: number }) {
  return (
    <div
      className="grid grid-cols-12 py-2 mt-2 items-baseline"
      style={{
        borderTop: '0.5px solid var(--border-lt)',
        borderBottom: '0.5px solid var(--border-lt)',
        background: 'var(--surface)',
        borderRadius: 4,
        paddingLeft: 12,
        paddingRight: 8,
      }}
    >
      <span className="col-span-7 font-serif text-[14px] text-text-1">{label}</span>
      <span
        className={`col-span-3 text-right font-serif text-[14px] ${
          value < 0 ? 'text-red' : 'text-text-1'
        }`}
      >
        {fmt(value)}
      </span>
      <span className="col-span-2 text-right num-mono text-[10.5px] text-text-3 pr-1">
        {pct(value, base)}
      </span>
    </div>
  );
}

function Margin({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: 'pos' | 'neg';
}) {
  return (
    <article className="g">
      <div className="g-label">{label}</div>
      <div className={`g-val md ${tone || 'muted'}`}>
        {value.toFixed(1).replace('.', ',')}
        <span className="text-text-3 text-[18px]">%</span>
      </div>
      <div className="g-sub">{hint}</div>
    </article>
  );
}
