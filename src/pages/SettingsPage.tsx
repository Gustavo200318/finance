import React, { useEffect, useMemo, useState } from 'react';
import Ti from '../components/Ti';
import Hero from '../components/Hero';
import { Skeleton } from '../components/Skeleton';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { ALL_WIDGETS, useDashboardWidgets } from '../lib/preferences';
import {
  createCategory,
  deleteCategory,
  updateCategory,
  updateProfile,
  useCategories,
} from '../lib/data';
import type { Category, CategoryType } from '../lib/types';

interface Props {
  refreshKey?: number;
}

type TabId = 'profile' | 'categories' | 'dashboard' | 'shortcuts';

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'profile', label: 'Perfil', icon: 'user' },
  { id: 'categories', label: 'Categorias', icon: 'tag' },
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
  { id: 'shortcuts', label: 'Atalhos', icon: 'keyboard' },
];

export default function SettingsPage({ refreshKey = 0 }: Props) {
  const [tab, setTab] = useState<TabId>('profile');

  return (
    <div className="content flex flex-col gap-4" style={{ padding: '26px 28px' }}>
      <Hero
        eyebrow="Configurações"
        title={
          <>
            Ajustes do<br />
            <em>seu app.</em>
          </>
        }
        note="Perfil, tema, categorias, widgets visíveis no Dashboard e atalhos."
      />

      <section
        className="grid gap-4"
        style={{ gridTemplateColumns: '200px 1fr' }}
      >
        {/* sidebar interna */}
        <aside className="flex flex-col gap-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors"
                style={{
                  background: active ? 'var(--card)' : 'transparent',
                  color: active ? 'var(--text-1)' : 'var(--text-3)',
                  border: active ? '0.5px solid var(--border)' : '0.5px solid transparent',
                  fontWeight: active ? 500 : 400,
                  fontSize: 12.5,
                }}
              >
                <Ti name={t.icon} size={14} />
                {t.label}
              </button>
            );
          })}
        </aside>

        <div>
          {tab === 'profile' && <ProfileTab />}
          {tab === 'categories' && <CategoriesTab refreshKey={refreshKey} />}
          {tab === 'dashboard' && <DashboardTab />}
          {tab === 'shortcuts' && <ShortcutsTab />}
        </div>
      </section>
    </div>
  );
}

// ─── PROFILE TAB ────────────────────────────────────────────────────────
function ProfileTab() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', currency: 'BRL', goal: '' });
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setForm({
      name: profile?.name ?? '',
      currency: profile?.currency ?? 'BRL',
      goal: String(profile?.monthly_income_goal ?? '0'),
    });
  }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user.id, {
        name: form.name.trim() || null,
        currency: form.currency || 'BRL',
        monthly_income_goal: Number(form.goal) || 0,
      });
      await refreshProfile();
      toast.success('Perfil atualizado');
    } catch (e: any) {
      toast.error('Erro ao salvar', e?.message);
    } finally {
      setSaving(false);
    }
  };

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      toast.info('Você saiu da conta');
    } catch (e: any) {
      toast.error('Erro ao sair', e?.message);
      setSigningOut(false);
    }
  };

  return (
    <article className="g" style={{ padding: '24px 28px' }}>
      <div className="g-label" style={{ marginBottom: 14 }}>
        Conta
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input type="email" value={user?.email ?? ''} className="field-input" disabled />
        </Field>
        <Field label="Nome">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="field-input"
            placeholder="Como devemos te chamar"
          />
        </Field>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Moeda">
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="field-input"
            >
              <option value="BRL">BRL · Real</option>
              <option value="USD">USD · Dólar</option>
              <option value="EUR">EUR · Euro</option>
            </select>
          </Field>
          <Field label="Meta de receita mensal" hint="Opcional">
            <input
              type="number"
              step="0.01"
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              className="field-input num-mono"
            />
          </Field>
        </div>
        <div
          className="flex items-center justify-between pt-3"
          style={{ borderTop: '0.5px solid var(--border-lt)' }}
        >
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="text-[12px] px-3 py-2 rounded-pill inline-flex items-center gap-1.5 disabled:opacity-60"
            style={{ color: 'var(--red)' }}
          >
            <Ti name="logout" size={12} />
            {signingOut ? 'Saindo...' : 'Sair da conta'}
          </button>
          <button type="submit" disabled={saving} className="tb-btn">
            <Ti name="check" />
            {saving ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </div>
      </form>
    </article>
  );
}

// ─── CATEGORIES TAB ─────────────────────────────────────────────────────
function CategoriesTab({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth();
  const toast = useToast();
  const cats = useCategories();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState<{ parent?: Category | null; type?: CategoryType } | null>(null);
  const [confirmDel, setConfirmDel] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!refreshKey) return;
    cats.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const tree = useMemo(() => {
    const roots: Category[] = [];
    const childrenMap = new Map<string, Category[]>();
    for (const c of cats.data ?? []) {
      if (c.parent_id) {
        const arr = childrenMap.get(c.parent_id) ?? [];
        arr.push(c);
        childrenMap.set(c.parent_id, arr);
      } else {
        roots.push(c);
      }
    }
    const sorted = roots.sort((a, b) => a.name.localeCompare(b.name));
    sorted.forEach((r) => {
      const cs = childrenMap.get(r.id) ?? [];
      cs.sort((a, b) => a.name.localeCompare(b.name));
      childrenMap.set(r.id, cs);
    });
    return { roots: sorted, childrenMap };
  }, [cats.data]);

  const onDelete = async (cat: Category) => {
    setDeleting(true);
    try {
      await deleteCategory(cat.id);
      toast.success('Categoria excluída', cat.name);
      setConfirmDel(null);
      cats.refresh();
    } catch (e: any) {
      toast.error('Erro ao excluir', e?.message ?? 'Pode haver transações usando essa categoria.');
    } finally {
      setDeleting(false);
    }
  };

  const grouped = useMemo(() => {
    const out: Record<CategoryType, Category[]> = {
      income: [],
      expense: [],
      debt: [],
      investment: [],
      transfer: [],
    };
    for (const r of tree.roots) {
      if (out[r.type]) out[r.type].push(r);
    }
    return out;
  }, [tree.roots]);

  if (cats.loading) {
    return (
      <article className="g" style={{ padding: 22 }}>
        <Skeleton height={220} />
      </article>
    );
  }

  const typeLabels: { id: CategoryType; label: string; color: string }[] = [
    { id: 'income', label: 'Receitas', color: '#2ECC8A' },
    { id: 'expense', label: 'Despesas', color: '#FF6B6B' },
    { id: 'debt', label: 'Dívidas', color: '#FFA62B' },
    { id: 'investment', label: 'Investimentos', color: '#7C5BFF' },
    { id: 'transfer', label: 'Transferências', color: '#22D3EE' },
  ];

  return (
    <>
      <article className="g" style={{ padding: '20px 24px' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="g-label" style={{ marginBottom: 4 }}>
              Categorias
            </div>
            <div className="text-[11px] text-text-3">
              {cats.data?.length ?? 0} no total. Crie subcategorias clicando em "+ Sub".
            </div>
          </div>
          <button className="tb-btn" onClick={() => setCreating({ parent: null, type: 'expense' })}>
            <Ti name="plus" /> Nova categoria
          </button>
        </div>

        <div className="space-y-5">
          {typeLabels.map((tl) => {
            const list = grouped[tl.id];
            if (list.length === 0) return null;
            return (
              <div key={tl.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: tl.color }}
                  />
                  <span
                    className="text-[10px] uppercase font-medium"
                    style={{ letterSpacing: '0.12em', color: 'var(--text-3)' }}
                  >
                    {tl.label}
                  </span>
                </div>
                <ul style={{ borderTop: '0.5px solid var(--border-lt)' }}>
                  {list.map((root) => {
                    const children = tree.childrenMap.get(root.id) ?? [];
                    return (
                      <li key={root.id} style={{ borderBottom: '0.5px solid var(--border-lt)' }}>
                        <CategoryRow
                          cat={root}
                          isParent
                          onEdit={() => setEditing(root)}
                          onAddSub={() => setCreating({ parent: root, type: root.type })}
                          onDelete={() => setConfirmDel(root)}
                        />
                        {children.length > 0 && (
                          <ul style={{ borderTop: '0.5px dashed var(--border-lt)', marginLeft: 28 }}>
                            {children.map((child) => (
                              <li key={child.id} style={{ borderBottom: '0.5px dashed var(--border-lt)' }}>
                                <CategoryRow
                                  cat={child}
                                  onEdit={() => setEditing(child)}
                                  onDelete={() => setConfirmDel(child)}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </article>

      {(!!editing || !!creating) && user && (
        <CategoryFormModal
          open={!!editing || !!creating}
          onClose={() => {
            setEditing(null);
            setCreating(null);
          }}
          initial={editing}
          defaultParent={creating?.parent ?? null}
          defaultType={creating?.type ?? 'expense'}
          userId={user.id}
          onSaved={() => cats.refresh()}
          allRoots={tree.roots}
        />
      )}

      {confirmDel && (
        <ConfirmDialog
          open={!!confirmDel}
          onClose={() => setConfirmDel(null)}
          onConfirm={() => onDelete(confirmDel)}
          title={`Excluir categoria "${confirmDel.name}"?`}
          description="Transações que usam essa categoria ficam sem categoria. Subcategorias filhas também precisam ser excluídas antes."
          confirmLabel="Excluir"
          loading={deleting}
        />
      )}
    </>
  );
}

function CategoryRow({
  cat,
  isParent,
  onEdit,
  onAddSub,
  onDelete,
}: {
  cat: Category;
  isParent?: boolean;
  onEdit: () => void;
  onAddSub?: () => void;
  onDelete: () => void;
}) {
  const color = cat.color ?? '#9CA3AF';
  return (
    <div
      className="flex items-center gap-3 py-2.5"
      style={{ paddingLeft: isParent ? 0 : 6, paddingRight: 4 }}
    >
      <span
        className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}26`, color }}
      >
        <Ti name={cat.icon || (isParent ? 'folder' : 'point')} size={12} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] text-text-1 truncate">{cat.name}</div>
        {cat.is_default && <div className="text-[10px] text-text-4">padrão</div>}
      </div>
      {onAddSub && (
        <button
          onClick={onAddSub}
          className="text-[10.5px] text-text-3 hover:text-text-1 px-2 py-1 inline-flex items-center gap-1"
        >
          <Ti name="plus" size={10} /> Sub
        </button>
      )}
      <button
        onClick={onEdit}
        className="text-[10.5px] text-text-3 hover:text-text-1 px-2 py-1 inline-flex items-center gap-1"
      >
        <Ti name="pencil" size={11} /> Editar
      </button>
      <button
        onClick={onDelete}
        className="text-[10.5px] px-2 py-1 inline-flex items-center gap-1"
        style={{ color: 'var(--red)' }}
      >
        <Ti name="trash" size={11} />
      </button>
    </div>
  );
}

function CategoryFormModal({
  open,
  onClose,
  initial,
  defaultParent,
  defaultType,
  userId,
  onSaved,
  allRoots,
}: {
  open: boolean;
  onClose: () => void;
  initial: Category | null;
  defaultParent: Category | null;
  defaultType: CategoryType;
  userId: string;
  onSaved: () => void;
  allRoots: Category[];
}) {
  const toast = useToast();
  const editing = !!initial;
  const [form, setForm] = useState({
    name: '',
    type: defaultType,
    parent_id: defaultParent?.id ?? '',
    color: '#7C5BFF',
    icon: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        name: initial.name,
        type: initial.type,
        parent_id: initial.parent_id ?? '',
        color: initial.color ?? '#7C5BFF',
        icon: initial.icon ?? '',
      });
    } else {
      setForm({
        name: '',
        type: defaultType,
        parent_id: defaultParent?.id ?? '',
        color: '#7C5BFF',
        icon: '',
      });
    }
  }, [open, initial, defaultParent, defaultType]);

  if (!open) return null;

  const possibleParents = allRoots.filter((r) => r.type === form.type && r.id !== initial?.id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        parent_id: form.parent_id || null,
        color: form.color || null,
        icon: form.icon.trim() || null,
      };
      if (editing && initial) {
        await updateCategory(initial.id, payload);
        toast.success('Categoria atualizada');
      } else {
        await createCategory(userId, payload);
        toast.success('Categoria criada');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error('Erro ao salvar', e?.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(12, 27, 44, 0.45)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div
        className="g relative w-full max-w-md"
        style={{ padding: 26 }}
      >
        <div className="hero-eyebrow text-green">{editing ? 'Editar' : 'Nova'} categoria</div>
        <h2 className="font-serif text-[22px] text-text-1 mt-1 mb-5" style={{ letterSpacing: '-0.02em' }}>
          {editing ? initial?.name : 'Categoria'}
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="field-input"
              autoFocus
              required
            />
          </Field>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Tipo">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as CategoryType, parent_id: '' })}
                className="field-input"
                disabled={editing}
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
                <option value="debt">Dívida</option>
                <option value="investment">Investimento</option>
                <option value="transfer">Transferência</option>
              </select>
            </Field>
            <Field label="Categoria pai">
              <select
                value={form.parent_id}
                onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                className="field-input"
              >
                <option value="">— Categoria raiz —</option>
                {possibleParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Cor">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-9 w-12 rounded cursor-pointer"
                  style={{ border: '0.5px solid var(--border)' }}
                />
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="field-input num-mono"
                  placeholder="#7C5BFF"
                />
              </div>
            </Field>
            <Field label="Ícone (Tabler)" hint="Ex: home, car, shopping-cart">
              <input
                type="text"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="field-input"
                placeholder="folder"
              />
            </Field>
          </div>

          <div
            className="flex items-center justify-end gap-2 pt-3"
            style={{ borderTop: '0.5px solid var(--border-lt)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="text-[12px] text-text-3 hover:text-text-1 px-3 py-2 rounded-pill"
            >
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="tb-btn">
              <Ti name="check" />
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── DASHBOARD TAB ──────────────────────────────────────────────────────
function DashboardTab() {
  const [widgets, setWidgets] = useDashboardWidgets();
  return (
    <article className="g" style={{ padding: '24px 28px' }}>
      <div className="g-label" style={{ marginBottom: 14 }}>
        Widgets do Dashboard
      </div>
      <p className="text-[11.5px] text-text-3 mb-4">
        Esconda blocos que você não usa. As preferências ficam salvas neste navegador.
      </p>
      <ul className="space-y-2">
        {ALL_WIDGETS.map((w) => {
          const enabled = !!widgets[w.id];
          return (
            <li
              key={w.id}
              className="flex items-center justify-between py-3"
              style={{ borderBottom: '0.5px solid var(--border-lt)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-text-1 font-medium">{w.label}</div>
                <div className="text-[11px] text-text-3 mt-0.5">{w.description}</div>
              </div>
              <button
                onClick={() =>
                  setWidgets((prev) => ({ ...prev, [w.id]: !prev[w.id] }))
                }
                className="relative shrink-0"
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 999,
                  background: enabled ? 'var(--green)' : 'var(--border)',
                  transition: 'background 0.2s',
                  cursor: 'pointer',
                }}
                aria-label={enabled ? 'Desativar' : 'Ativar'}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: enabled ? 20 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#FFF',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
                  }}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

// ─── SHORTCUTS TAB ──────────────────────────────────────────────────────
function ShortcutsTab() {
  const items: { keys: string[]; label: string }[] = [
    { keys: ['Esc'], label: 'Fechar modal' },
    { keys: ['Ctrl', 'Shift', 'R'], label: 'Recarregar com cache limpo' },
    { keys: ['F12'], label: 'Abrir DevTools' },
  ];
  return (
    <article className="g" style={{ padding: '24px 28px' }}>
      <div className="g-label" style={{ marginBottom: 14 }}>
        Atalhos
      </div>
      <p className="text-[11.5px] text-text-3 mb-4">
        Atalhos disponíveis hoje. Em breve: <code className="text-[10.5px]">⌘K</code> para busca global,{' '}
        <code className="text-[10.5px]">N</code> para nova transação.
      </p>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex items-center justify-between py-2.5"
            style={{ borderBottom: '0.5px solid var(--border-lt)' }}
          >
            <span className="text-[12.5px] text-text-2">{it.label}</span>
            <span className="flex gap-1">
              {it.keys.map((k, j) => (
                <kbd
                  key={j}
                  className="text-[10.5px] px-2 py-0.5 num-mono"
                  style={{
                    background: 'var(--bg)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-2)',
                  }}
                >
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="field-label" style={{ marginBottom: 0 }}>
        {label}
      </span>
      {children}
      {hint && <span className="text-[10px] text-text-4">{hint}</span>}
    </label>
  );
}
