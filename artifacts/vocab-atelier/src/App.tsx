import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  CircleAlert,
  Flame,
  FolderOpen,
  Gauge,
  LibraryBig,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  getGetDashboardQueryKey,
  getGetNextReviewQueryKey,
  getGetVocabularyQueryKey,
  getListVocabularyQueryKey,
  type VocabularyItem,
  type VocabularyInput,
  type VocabularyType,
  type ReviewRating as ReviewRatingType,
  VocabularyType as VocabularyTypeValue,
  useCreateVocabulary,
  useDeleteVocabulary,
  useEnrichVocabulary,
  useGetDashboard,
  useGetNextReview,
  useGetVocabulary,
  useListVocabulary,
  useSubmitReview,
  useUpdateVocabulary,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
const types = [VocabularyTypeValue.word, VocabularyTypeValue.phrase, VocabularyTypeValue.idiom, VocabularyTypeValue.phrasal_verb] as const;
type FormState = {
  term: string;
  type: string;
  meaning: string;
  partOfSpeech: string;
  pronunciation: string;
  example: string;
  translation: string;
  urduMeaning: string;
  notes: string;
  tags: string;
};
const blankForm: FormState = { term: '', type: 'word', meaning: '', partOfSpeech: '', pronunciation: '', example: '', translation: '', urduMeaning: '', notes: '', tags: '' };

const typeLabels: Record<string, string> = { word: 'Word', phrase: 'Phrase', idiom: 'Idiom', phrasal_verb: 'Phrasal verb' };
const typeColors: Record<string, string> = { word: '#9a4d3f', phrase: '#5f806a', idiom: '#cf9651', phrasal_verb: '#56748a' };

function formatDate(value?: string | null) {
  if (!value) return 'Not reviewed yet';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function getEnrichmentErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') return data.error;
  }
  return 'Enrichment is unavailable right now, but you can keep writing.';
}

function formatDue(value?: string | null) {
  if (!value) return 'No date';
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Due today';
  return `Due ${formatDate(value)}`;
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 px-2 no-underline" data-testid="link-logo">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]">
        <BookOpen size={17} strokeWidth={2.5} />
      </span>
      <span>
        <span className="serif block text-[17px] leading-none text-[hsl(var(--sidebar-foreground))]">Vocab Atelier</span>
        <span className="mono mt-1 block text-[9px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.45)]">a private lexicon</span>
      </span>
    </Link>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  const [location] = useLocation();
  const active = href === '/' ? location === '/' : location.startsWith(href);
  return <Link href={href} className={`nav-link ${active ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase()}`}>{icon}<span>{label}</span></Link>;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <div className="grain" />
      <aside className="sidebar">
        <Logo />
        <div className="mt-12 space-y-1">
          <p className="eyebrow mb-3 px-3 text-[hsl(var(--sidebar-foreground)/.38)]">Study room</p>
          <NavItem href="/" icon={<Gauge size={17} />} label="Today" />
          <NavItem href="/library" icon={<LibraryBig size={17} />} label="Library" />
          <NavItem href="/review" icon={<Brain size={17} />} label="Review" />
          <NavItem href="/insights" icon={<TrendingUp size={17} />} label="Insights" />
        </div>
        <div className="mt-auto rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent))] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="eyebrow text-[hsl(var(--sidebar-foreground)/.5)]">A small ritual</span>
            <Sparkles size={14} className="text-[hsl(var(--sidebar-primary))]" />
          </div>
          <p className="serif text-[17px] leading-snug text-[hsl(var(--sidebar-foreground))]">A word a day is a room getting larger.</p>
          <p className="mt-3 text-[11px] leading-relaxed text-[hsl(var(--sidebar-foreground)/.5)]">Keep showing up. Your future self will have more to say.</p>
        </div>
        <div className="mt-5 flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--sidebar-primary)/.18)] text-xs font-bold text-[hsl(var(--sidebar-primary))]">AM</div>
          <div><p className="text-xs text-[hsl(var(--sidebar-foreground)/.85)]">Your atelier</p><p className="mono text-[9px] text-[hsl(var(--sidebar-foreground)/.4)]">PERSONAL SPACE</p></div>
        </div>
      </aside>
      <main className="main-area">{children}</main>
      <nav className="mobile-nav">
        <NavItem href="/" icon={<Gauge />} label="Today" />
        <NavItem href="/library" icon={<LibraryBig />} label="Library" />
        <NavItem href="/review" icon={<Brain />} label="Review" />
        <NavItem href="/insights" icon={<TrendingUp />} label="Insights" />
      </nav>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="mb-10 flex items-end justify-between gap-5 fade-in">
    <div><p className="eyebrow mb-3">{eyebrow}</p><h1 className="serif text-[clamp(34px,5vw,55px)] leading-[.98] tracking-[-.035em]">{title}</h1>{description && <p className="mt-4 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{description}</p>}</div>
    {action}
  </header>;
}

function LoadingState({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3" data-testid="status-loading">{Array.from({ length: rows }).map((_, index) => <div className="card-surface flex items-center gap-4 p-5" key={index}><div className="skeleton h-10 w-10 rounded-xl" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-2/5" /><div className="skeleton h-3 w-3/5" /></div></div>)}</div>;
}

function ErrorState({ onRetry, message = 'The shelves are taking a moment to open.' }: { onRetry: () => void; message?: string }) {
  return <div className="card-surface flex flex-col items-center justify-center px-6 py-16 text-center" data-testid="status-error"><CircleAlert size={25} className="mb-4 text-[hsl(var(--primary))]" /><p className="serif text-2xl">A quiet interruption.</p><p className="mt-2 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{message}</p><button className="button-secondary mt-5" onClick={onRetry} data-testid="button-retry"><RotateCcw size={14} /> Try again</button></div>;
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <div className="card-surface flex flex-col items-center justify-center px-6 py-20 text-center" data-testid="status-empty"><span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><FolderOpen size={24} /></span><p className="serif text-2xl">{title}</p><p className="mt-2 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{copy}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function StatCard({ label, value, detail, accent = 'primary' }: { label: string; value: string | number; detail: string; accent?: 'primary' | 'gold' | 'sage' }) {
  const color = accent === 'gold' ? 'hsl(var(--accent))' : accent === 'sage' ? '#5f806a' : 'hsl(var(--primary))';
  return <div className="card-surface hover-lift p-5" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="mb-6 flex items-start justify-between"><span className="eyebrow">{label}</span><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /></div><p className="serif text-4xl leading-none">{value}</p><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{detail}</p></div>;
}

function Dashboard() {
  const dashboard = useGetDashboard();
  const list = useListVocabulary();
  const summary = dashboard.data;
  const recent = (list.data ?? []).slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 4);
  const percent = summary && summary.total ? Math.round((summary.mastered / summary.total) * 100) : 0;
  return <div className="content-wrap">
    <PageHeader eyebrow={new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())} title={summary?.dueToday ? 'Your words are waiting.' : 'A quiet day for language.'} description={summary?.dueToday ? `${summary.dueToday} ${summary.dueToday === 1 ? 'card is' : 'cards are'} ready for a thoughtful review.` : 'Keep collecting. Your next meaningful phrase is just around the corner.'} action={<Link href="/library" className="button-primary" data-testid="link-add-word"><Plus size={16} /> Add a word</Link>} />
    {dashboard.isLoading ? <LoadingState rows={1} /> : dashboard.isError || !summary ? <ErrorState onRetry={() => dashboard.refetch()} /> : <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 fade-in delay-1">
        <StatCard label="In your lexicon" value={summary.total} detail="words worth keeping" />
        <StatCard label="Due today" value={summary.dueToday} detail={summary.dueToday ? 'ready when you are' : 'you are all caught up'} accent="gold" />
        <StatCard label="Mastered" value={`${percent}%`} detail={`${summary.mastered} durable memories`} accent="sage" />
        <StatCard label="Streak" value={`${summary.streak}d`} detail="your rhythm is becoming a habit" accent="gold" />
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
        <div className="card-surface relative overflow-hidden p-7 md:p-9 fade-in delay-2">
          <div className="absolute -right-10 -top-12 h-48 w-48 rounded-full border-[22px] border-[hsl(var(--accent)/.18)]" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4"><div><p className="eyebrow mb-3">The next right thing</p><h2 className="serif max-w-md text-3xl leading-tight">Give your memory a little exercise.</h2><p className="mt-3 max-w-md text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">A short session is enough to keep the thread alive. Your cards will meet you where you left off.</p></div><span className="hidden rounded-full bg-[hsl(var(--accent)/.3)] p-3 text-[hsl(var(--primary))] sm:block"><Target size={22} /></span></div>
            <div className="mt-8 flex flex-wrap items-center gap-4"><Link href="/review" className="button-primary" data-testid="link-start-review"><Brain size={16} /> {summary.dueToday ? 'Begin review' : 'Review a few'}</Link><span className="mono text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{summary.reviewedToday} reviewed today</span></div>
          </div>
        </div>
        <div className="card-surface p-7 fade-in delay-3">
          <div className="flex items-center justify-between"><p className="eyebrow">Your collection</p><span className="mono text-xs text-[hsl(var(--muted-foreground))]">{summary.total} total</span></div>
          <div className="mt-7 space-y-5">{types.map((type) => { const count = summary.typeCounts?.[type] ?? 0; const width = summary.total ? `${Math.max(4, (count / summary.total) * 100)}%` : '4%'; return <div key={type}><div className="mb-2 flex justify-between text-xs"><span>{typeLabels[type]}</span><span className="mono text-[hsl(var(--muted-foreground))]">{count}</span></div><div className="bar-track"><div className="bar-fill" style={{ width, background: typeColors[type] }} /></div></div>; })}</div>
        </div>
      </section>
      <section className="mt-8 fade-in delay-3">
         <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Recently added</p><h2 className="serif mt-2 text-2xl">Fresh on the shelf</h2></div><Link href="/library" className="button-quiet shrink-0" data-testid="link-view-library">View library <ChevronRight size={14} /></Link></div>
         {list.isLoading ? <LoadingState rows={2} /> : list.isError ? <ErrorState onRetry={() => list.refetch()} /> : recent.length === 0 ? <EmptyState title="Your shelf is ready." copy="Save the first word that makes you pause." action={<Link href="/library" className="button-primary" data-testid="link-add-first-word"><Plus size={15} /> Add your first word</Link>} /> : <div className="grid min-w-0 gap-3 md:grid-cols-2">{recent.map((item, index) => <VocabPreview key={item.id} item={item} index={index} />)}</div>}
      </section>
    </>}
  </div>;
}

function VocabPreview({ item, index = 0 }: { item: VocabularyItem; index?: number }) {
  return <Link href="/library" className={`card-surface hover-lift flex min-w-0 items-center gap-3 p-4 fade-in delay-${Math.min(index + 1, 4)}`} data-testid={`card-recent-${item.id}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold" style={{ background: `${typeColors[item.type]}18`, color: typeColors[item.type] }}>{item.term.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 overflow-hidden"><span className="flex min-w-0 items-center gap-2"><span className="min-w-0 truncate text-sm font-semibold">{item.term}</span><span className="tag shrink-0">{typeLabels[item.type]}</span></span><span className="mt-1 block truncate text-xs text-[hsl(var(--muted-foreground))]">{item.meaning}</span></span><ChevronRight size={16} className="shrink-0 text-[hsl(var(--muted-foreground))]" /></Link>;
}

function Library() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | VocabularyType>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const params = useMemo(() => ({ search: search || undefined, type: filter === 'all' ? undefined : filter }), [search, filter]);
  const list = useListVocabulary(params);
  const deleteMutation = useDeleteVocabulary();
  const qc = useQueryClient();
  const items = list.data ?? [];
  const handleDelete = (id: string, term: string) => { if (window.confirm(`Remove “${term}” from your shelf?`)) deleteMutation.mutate({ id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListVocabularyQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); } }); };
  return <div className="content-wrap">
    <PageHeader eyebrow="The collection" title="Your language, gathered." description="A living shelf of words, phrases, idioms, and verbs you decided were worth keeping." action={<button className="button-primary" onClick={() => setEditingId('new')} data-testid="button-add-vocabulary"><Plus size={16} /> Add vocabulary</button>} />
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between fade-in delay-1">
      <div className="relative w-full md:max-w-sm"><Search size={16} className="absolute left-3.5 top-3.5 text-[hsl(var(--muted-foreground))]" /><input className="field pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your shelf..." data-testid="input-search-vocabulary" /></div>
      <div className="flex gap-1.5 overflow-auto pb-1">{(['all', ...types] as const).map((type) => <button key={type} onClick={() => setFilter(type)} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${filter === type ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`} data-testid={`button-filter-${type}`}>{type === 'all' ? 'All words' : typeLabels[type]}</button>)}</div>
    </div>
    {list.isLoading ? <LoadingState rows={5} /> : list.isError ? <ErrorState onRetry={() => list.refetch()} /> : items.length === 0 ? <EmptyState title={search ? 'Nothing matched.' : 'The shelf is still open.'} copy={search ? 'Try a shorter search or another spelling.' : 'Collect words from conversations, books, and the odd sentence that stays with you.'} action={!search ? <button className="button-primary" onClick={() => setEditingId('new')} data-testid="button-add-empty"><Plus size={15} /> Save a word</button> : undefined} /> : <div className="space-y-3">{items.map((item, index) => <LibraryRow key={item.id} item={item} index={index} onEdit={() => setEditingId(item.id)} onDelete={() => handleDelete(item.id, item.term)} deleting={deleteMutation.isPending} />)}</div>}
    {editingId && <VocabularyModal editingId={editingId === 'new' ? null : editingId} onClose={() => setEditingId(null)} />}
  </div>;
}

function LibraryRow({ item, index, onEdit, onDelete, deleting }: { item: VocabularyItem; index: number; onEdit: () => void; onDelete: () => void; deleting: boolean }) {
  return <div className={`card-surface hover-lift flex flex-col gap-4 p-5 fade-in delay-${Math.min(index + 1, 4)} md:flex-row md:items-center`} data-testid={`row-vocabulary-${item.id}`}>
    <div className="flex min-w-0 flex-1 items-center gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold" style={{ background: `${typeColors[item.type]}18`, color: typeColors[item.type] }}>{item.term.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{item.term}</h3><span className="tag">{typeLabels[item.type]}</span>{item.source === 'ai' && <span className="tag bg-[hsl(var(--accent)/.25)]"><Sparkles size={10} className="mr-1" /> enriched</span>}</div><p className="mt-1 truncate text-sm text-[hsl(var(--muted-foreground))]">{item.meaning}</p><div className="mt-2 flex flex-wrap gap-1">{item.tags.slice(0, 3).map(tag => <span key={tag} className="mono text-[9px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">#{tag}</span>)}</div></div></div>
    <div className="flex items-center justify-between gap-3 md:justify-end"><div className="mr-2 text-right"><p className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{item.repetitions ? `${item.intervalDays} day interval` : 'New card'}</p><p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{formatDue(item.dueAt)}</p></div><button className="button-quiet" onClick={onEdit} data-testid={`button-edit-${item.id}`}><Pencil size={15} /> <span className="hidden sm:inline">Edit</span></button><button className="button-quiet text-[hsl(var(--destructive))]" onClick={onDelete} disabled={deleting} data-testid={`button-delete-${item.id}`}><Trash2 size={15} /></button></div>
  </div>;
}

function VocabularyModal({ editingId, onClose }: { editingId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = !editingId;
  const [form, setForm] = useState<FormState>(blankForm);
  const [context, setContext] = useState('');
  const [saveError, setSaveError] = useState('');
  const itemQuery = useGetVocabulary(editingId ?? '', { query: { enabled: Boolean(editingId), queryKey: getGetVocabularyQueryKey(editingId ?? '') } });
  const create = useCreateVocabulary();
  const update = useUpdateVocabulary();
  const enrich = useEnrichVocabulary();
  useEffect(() => {
    const item = itemQuery.data;
     if (item) setForm({ term: item.term, type: item.type, meaning: item.meaning, partOfSpeech: item.partOfSpeech ?? '', pronunciation: item.pronunciation ?? '', example: item.example, translation: item.translation ?? '', urduMeaning: item.urduMeaning ?? '', notes: item.notes ?? '', tags: item.tags.join(', ') });
  }, [itemQuery.data]);
  const set = (key: keyof FormState, value: string) => setForm(prev => ({ ...prev, [key]: value }));
   const applyEnrichment = () => { if (!form.term.trim()) return; enrich.mutate({ data: { term: form.term.trim(), type: form.type as VocabularyType, context: context || null } }, { onSuccess: (data) => setForm(prev => ({ ...prev, term: data.term, meaning: data.meaning, partOfSpeech: data.partOfSpeech ?? '', pronunciation: data.pronunciation ?? '', example: data.example, translation: data.translation ?? '', urduMeaning: data.urduMeaning ?? '', tags: data.tags.join(', '), notes: data.memoryHook ? `Memory hook: ${data.memoryHook}` : prev.notes })) }); };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!form.term.trim() || !form.meaning.trim() || !form.example.trim()) { setSaveError('Term, meaning, and example are required.'); return; }
    setSaveError('');
     const payload: VocabularyInput = { term: form.term.trim(), type: form.type as VocabularyType, meaning: form.meaning.trim(), partOfSpeech: form.partOfSpeech.trim() || null, pronunciation: form.pronunciation.trim() || null, example: form.example.trim(), translation: form.translation.trim() || null, urduMeaning: form.urduMeaning.trim() || null, notes: form.notes.trim() || null, tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean), source: enrich.data ? 'ai' : 'manual' };
    if (editingId) update.mutate({ id: editingId, data: payload }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListVocabularyQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetVocabularyQueryKey(editingId) }); onClose(); }, onError: () => setSaveError('That edit could not be saved. Try again.') });
    else create.mutate({ data: payload }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListVocabularyQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); onClose(); }, onError: () => setSaveError('That word could not be saved. Try again.') });
  };
  const busy = create.isPending || update.isPending;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="vocab-modal-title" data-testid="dialog-vocabulary">
    <div className="mb-7 flex items-start justify-between"><div><p className="eyebrow mb-2">{isNew ? 'Add to the collection' : 'Refine this entry'}</p><h2 id="vocab-modal-title" className="serif text-3xl">{isNew ? 'Save a new word.' : 'Edit your note.'}</h2></div><button className="button-quiet" onClick={onClose} data-testid="button-close-vocabulary"><X size={18} /></button></div>
    {itemQuery.isLoading && editingId ? <LoadingState rows={2} /> : <form onSubmit={save} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]"><div><label className="field-label" htmlFor="vocab-term">Term</label><input id="vocab-term" className="field" autoFocus value={form.term} onChange={e => set('term', e.target.value)} placeholder="e.g. serendipity" data-testid="input-vocabulary-term" /></div><div><label className="field-label" htmlFor="vocab-type">Kind</label><select id="vocab-type" className="field" value={form.type} onChange={e => set('type', e.target.value)} data-testid="select-vocabulary-type">{types.map(type => <option value={type} key={type}>{typeLabels[type]}</option>)}</select></div></div>
       <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] p-4"><div className="flex items-center gap-2"><Sparkles size={15} className="text-[hsl(var(--primary))]" /><p className="text-xs font-bold">Let the atelier help</p><span className="tag ml-auto">optional</span></div><div className="mt-3 flex gap-2"><input className="field flex-1 bg-[hsl(var(--card))]" value={context} onChange={e => setContext(e.target.value)} placeholder="Add a context or leave blank" data-testid="input-enrichment-context" /><button type="button" className="button-secondary shrink-0" onClick={applyEnrichment} disabled={enrich.isPending || !form.term.trim()} data-testid="button-enrich-vocabulary">{enrich.isPending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {enrich.isPending ? 'Thinking...' : 'Enrich'}</button></div>{enrich.isError && <p className="mt-2 text-xs text-[hsl(var(--destructive))]" data-testid="status-enrichment-error">{getEnrichmentErrorMessage(enrich.error)}</p>}</div>
      <div><label className="field-label" htmlFor="vocab-meaning">Meaning</label><textarea id="vocab-meaning" className="field min-h-[74px] resize-y" value={form.meaning} onChange={e => set('meaning', e.target.value)} placeholder="What does it mean, in your own words?" data-testid="input-vocabulary-meaning" /></div>
       <div><label className="field-label" htmlFor="vocab-urdu-meaning">Urdu meaning</label><textarea id="vocab-urdu-meaning" className="field min-h-[74px] resize-y text-right" dir="rtl" lang="ur" value={form.urduMeaning} onChange={e => set('urduMeaning', e.target.value)} placeholder="اردو میں معنی لکھیں" data-testid="input-vocabulary-urdu-meaning" /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label" htmlFor="vocab-pos">Part of speech</label><input id="vocab-pos" className="field" value={form.partOfSpeech} onChange={e => set('partOfSpeech', e.target.value)} placeholder="noun, verb..." data-testid="input-vocabulary-pos" /></div><div><label className="field-label" htmlFor="vocab-pronunciation">Pronunciation</label><input id="vocab-pronunciation" className="field" value={form.pronunciation} onChange={e => set('pronunciation', e.target.value)} placeholder="/ˌser.ənˈdip.ə.ti/" data-testid="input-vocabulary-pronunciation" /></div></div>
      <div><label className="field-label" htmlFor="vocab-example">Example sentence</label><textarea id="vocab-example" className="field min-h-[80px] resize-y" value={form.example} onChange={e => set('example', e.target.value)} placeholder="Put it in a sentence you might actually say." data-testid="input-vocabulary-example" /></div>
       <div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label" htmlFor="vocab-translation">Translation</label><input id="vocab-translation" className="field" value={form.translation} onChange={e => set('translation', e.target.value)} placeholder="Optional" data-testid="input-vocabulary-translation" /></div><div><label className="field-label" htmlFor="vocab-tags">Tags</label><input id="vocab-tags" className="field" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="travel, work, curious" data-testid="input-vocabulary-tags" /></div></div>
      <div><label className="field-label" htmlFor="vocab-notes">Private notes</label><textarea id="vocab-notes" className="field min-h-[65px] resize-y" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="A memory, a nuance, a connection..." data-testid="input-vocabulary-notes" /></div>
      {saveError && <p className="flex items-center gap-2 text-xs text-[hsl(var(--destructive))]" data-testid="status-save-error"><CircleAlert size={14} /> {saveError}</p>}
      <div className="flex justify-end gap-2 border-t border-[hsl(var(--border))] pt-5"><button type="button" className="button-secondary" onClick={onClose} data-testid="button-cancel-vocabulary">Cancel</button><button type="submit" className="button-primary" disabled={busy} data-testid="button-save-vocabulary">{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {busy ? 'Saving...' : isNew ? 'Save word' : 'Save changes'}</button></div>
    </form>}
  </div></div>;
}

function Review() {
  const next = useGetNextReview();
  const submit = useSubmitReview();
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const [lastRating, setLastRating] = useState<ReviewRatingType | null>(null);
  const card = next.data;
  useEffect(() => { setRevealed(false); setLastRating(null); }, [card?.id]);
  const rate = (rating: ReviewRatingType) => { if (!card) return; setLastRating(rating); submit.mutate({ id: card.id, data: { rating } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetNextReviewQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getListVocabularyQueryKey() }); } }); };
  const ratingCopy: Record<string, { label: string; hint: string }> = { again: { label: 'Again', hint: 'Reset the thread' }, hard: { label: 'Hard', hint: 'A little more practice' }, good: { label: 'Good', hint: 'Keep this interval' }, easy: { label: 'Easy', hint: 'You have this one' } };
  return <div className="content-wrap">
    <PageHeader eyebrow="Spaced repetition" title="One card at a time." description="Recall first. Reveal second. Then choose the rating that feels honest." action={<Link href="/library" className="button-secondary" data-testid="link-review-library"><LibraryBig size={15} /> Browse shelf</Link>} />
    {next.isLoading ? <div className="card-surface mx-auto max-w-2xl p-8"><div className="skeleton h-3 w-20" /><div className="skeleton mx-auto mt-20 h-12 w-2/3" /><div className="skeleton mx-auto mt-4 h-4 w-1/2" /><div className="skeleton mt-24 h-12 w-full" /></div> : next.isError ? <ErrorState onRetry={() => next.refetch()} /> : !card ? <EmptyState title="The shelf is quiet." copy="There are no cards waiting right now. Add a new word or come back later for another round." action={<Link href="/library" className="button-primary" data-testid="link-review-empty-library"><Plus size={15} /> Add vocabulary</Link>} /> : <div className="mx-auto max-w-2xl fade-in">
      <div className="mb-4 flex items-center justify-between"><span className="eyebrow">A card for you</span><span className="mono text-[10px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{formatDue(card.dueAt)}</span></div>
       <div className={`card-surface relative overflow-hidden p-7 text-center transition ${revealed ? 'border-[hsl(var(--primary)/.35)]' : ''}`}><div className="absolute left-0 top-0 h-1 w-full bg-[hsl(var(--accent))]" /><span className="tag mt-2" style={{ color: typeColors[card.type], background: `${typeColors[card.type]}18` }}>{typeLabels[card.type]}</span><h2 className="serif mt-10 text-[clamp(40px,8vw,70px)] leading-none tracking-[-.045em]" data-testid="text-review-term">{card.term}</h2>{card.pronunciation && <p className="mono mt-4 text-xs text-[hsl(var(--muted-foreground))]">{card.pronunciation}</p>}<div className="mx-auto mt-9 max-w-lg border-t border-[hsl(var(--border))] pt-7">{!revealed ? <><p className="text-sm text-[hsl(var(--muted-foreground))]">What does this mean?</p><button className="button-primary mt-5" onClick={() => setRevealed(true)} data-testid="button-reveal-answer">Reveal answer <ChevronRight size={15} /></button></> : <div className="fade-in text-left"><p className="eyebrow mb-2">Meaning</p><p className="serif text-2xl leading-snug" data-testid="text-review-meaning">{card.meaning}</p>{card.urduMeaning && <p className="mt-3 rounded-xl bg-[hsl(var(--secondary)/.55)] px-4 py-3 text-right text-lg leading-relaxed" dir="rtl" lang="ur" data-testid="text-review-urdu-meaning">{card.urduMeaning}</p>}{card.translation && <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{card.translation}</p>}<div className="mt-7 rounded-xl bg-[hsl(var(--secondary)/.55)] p-4"><p className="eyebrow mb-2">In context</p><p className="text-sm italic leading-relaxed">“{card.example}”</p></div>{card.notes && <p className="mt-4 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Note: {card.notes}</p>}</div>}</div></div>
      {revealed && <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">{(Object.keys(ratingCopy) as ReviewRatingType[]).map(rating => <button className="review-option" key={rating} onClick={() => rate(rating)} disabled={submit.isPending} data-testid={`button-rate-${rating}`}><span className="block text-sm font-bold">{ratingCopy[rating].label}</span><span className="mt-1 block text-[10px] leading-tight text-[hsl(var(--muted-foreground))]">{ratingCopy[rating].hint}</span></button>)}</div>}
      {lastRating && submit.isPending && <p className="mt-5 text-center text-xs text-[hsl(var(--muted-foreground))]" data-testid="status-review-saving"><Loader2 size={13} className="mr-1 inline animate-spin" /> Saving your rhythm...</p>}
      {lastRating && !submit.isPending && <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[hsl(var(--primary))] fade-in" data-testid="status-review-complete"><Check size={14} /> Noted. Your next card is ready.</div>}
    </div>}
  </div>;
}

function Insights() {
  const dashboard = useGetDashboard();
  const list = useListVocabulary();
  const items = list.data ?? [];
  const total = dashboard.data?.total || items.length;
  const mastered = dashboard.data?.mastered ?? items.filter(i => i.intervalDays >= 21).length;
  const typeTotal = types.reduce((sum, type) => sum + items.filter(item => item.type === type).length, 0);
  const longest = items.slice().sort((a, b) => b.intervalDays - a.intervalDays).slice(0, 5);
  return <div className="content-wrap">
    <PageHeader eyebrow="The long view" title="See your progress take shape." description="Learning is not a straight line. These small signals show how your collection is settling into memory." />
    {dashboard.isLoading || list.isLoading ? <LoadingState rows={3} /> : dashboard.isError || list.isError ? <ErrorState onRetry={() => { dashboard.refetch(); list.refetch(); }} /> : <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-[1.1fr_.9fr] fade-in delay-1">
        <div className="card-surface overflow-hidden p-7 md:p-9"><div className="flex items-start justify-between"><div><p className="eyebrow">Memory garden</p><h2 className="serif mt-3 text-3xl">A collection with roots.</h2><p className="mt-3 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Mastery grows quietly through the repetitions you choose to make.</p></div><div className="relative flex h-24 w-24 shrink-0 items-center justify-center"><svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 88 88"><circle cx="44" cy="44" r="35" fill="none" stroke="hsl(var(--secondary))" strokeWidth="7" /><circle cx="44" cy="44" r="35" fill="none" stroke="hsl(var(--primary))" strokeWidth="7" strokeLinecap="round" strokeDasharray="220" strokeDashoffset={220 - (Math.min(100, total ? mastered / total * 100 : 0) / 100) * 220} /></svg><span className="serif text-xl">{total ? Math.round(mastered / total * 100) : 0}%</span></div></div><div className="mt-9 grid grid-cols-3 gap-3 border-t border-[hsl(var(--border))] pt-5"><div><p className="mono text-xl">{mastered}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Mastered</p></div><div><p className="mono text-xl">{dashboard.data?.learning ?? Math.max(0, total - mastered)}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Learning</p></div><div><p className="mono text-xl">{dashboard.data?.reviewedToday ?? 0}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Today</p></div></div></div>
        <div className="card-surface p-7 md:p-9"><p className="eyebrow">Your rhythm</p><div className="mt-7 flex items-end gap-2">{Array.from({ length: 12 }).map((_, i) => { const height = 25 + ((i * 17 + (dashboard.data?.streak ?? 0) * 9) % 65); return <div className="flex flex-1 flex-col items-center gap-2" key={i}><div className="w-full rounded-t-md bg-[hsl(var(--primary)/.14)]" style={{ height: `${height}px` }}><div className="h-full w-full origin-bottom rounded-t-md bg-[hsl(var(--primary)/.72)]" style={{ transform: `scaleY(${i > 8 ? .76 : .48})` }} /></div><span className="mono text-[8px] text-[hsl(var(--muted-foreground))]">{i + 1}</span></div>; })}</div><p className="mt-6 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]"><span className="font-bold text-[hsl(var(--foreground))]">{dashboard.data?.streak ?? 0} days</span> of keeping the thread. Consistency beats intensity here.</p></div>
      </section>
      <section className="grid gap-6 lg:grid-cols-[.9fr_1.1fr] fade-in delay-2">
        <div className="card-surface p-7"><div className="flex items-center justify-between"><div><p className="eyebrow">Vocabulary mix</p><h2 className="serif mt-2 text-2xl">What you collect</h2></div><BookOpen size={19} className="text-[hsl(var(--primary))]" /></div><div className="mt-7 space-y-5">{types.map(type => { const count = items.filter(item => item.type === type).length; const ratio = typeTotal ? count / typeTotal * 100 : 0; return <div key={type}><div className="mb-2 flex justify-between text-xs"><span>{typeLabels[type]}</span><span className="mono text-[hsl(var(--muted-foreground))]">{count}</span></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(count ? 5 : 0, ratio)}%`, background: typeColors[type] }} /></div></div>; })}</div></div>
        <div className="card-surface p-7"><div className="flex items-center justify-between"><div><p className="eyebrow">Strongest memories</p><h2 className="serif mt-2 text-2xl">Words with roots</h2></div><Flame size={19} className="text-[hsl(var(--accent-foreground))]" /></div>{longest.length === 0 ? <p className="mt-8 text-sm text-[hsl(var(--muted-foreground))]">Your strongest memories will appear here after a few reviews.</p> : <div className="mt-5 divide-y divide-[hsl(var(--border))]">{longest.map(item => <div key={item.id} className="flex items-center justify-between gap-3 py-3" data-testid={`insight-item-${item.id}`}><div><p className="text-sm font-semibold">{item.term}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{item.meaning}</p></div><span className="mono shrink-0 text-[10px] text-[hsl(var(--primary))]">{item.intervalDays}d interval</span></div>)}</div>}</div>
      </section>
    </div>}
  </div>;
}

function NotFoundView() {
  return <div className="content-wrap flex min-h-[100dvh] items-center justify-center"><div className="text-center"><p className="eyebrow">404 / misplaced page</p><h1 className="serif mt-3 text-5xl">This room is empty.</h1><Link href="/" className="button-primary mt-7" data-testid="link-not-found-home">Return to today</Link></div></div>;
}

function Router() {
  const [location] = useLocation();
  return <Shell><ErrorBoundary resetKey={location}><Switch><Route path="/" component={Dashboard} /><Route path="/library" component={Library} /><Route path="/review" component={Review} /><Route path="/insights" component={Insights} /><Route component={NotFoundView} /></Switch></ErrorBoundary></Shell>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
