import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileDown,
  Flame,
  FolderOpen,
  Gauge,
  LibraryBig,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import {
  getGetDashboardQueryKey,
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
  retrievalQuestions: string[];
};
const blankForm: FormState = { term: '', type: 'word', meaning: '', partOfSpeech: '', pronunciation: '', example: '', translation: '', urduMeaning: '', notes: '', tags: '', retrievalQuestions: [''] };

const typeLabels: Record<string, string> = { word: 'Word', phrase: 'Phrase', idiom: 'Idiom', phrasal_verb: 'Phrasal verb' };
const typeColors: Record<string, string> = { word: '#2B5FE2', phrase: '#1F9D64', idiom: '#7C5CFC', phrasal_verb: '#0EA5A0' };

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

type FreeDefinition = { meaning: string; partOfSpeech: string; pronunciation: string; example: string };

async function fetchFreeDefinition(term: string): Promise<FreeDefinition | null> {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`);
    if (!response.ok) return null;
    const entries = await response.json();
    const entry = Array.isArray(entries) ? entries[0] : null;
    const meaningBlock = entry?.meanings?.[0];
    const definitionBlock = meaningBlock?.definitions?.[0];
    if (!definitionBlock?.definition) return null;
    const phonetic = entry?.phonetic || entry?.phonetics?.find((item: { text?: string }) => item.text)?.text || '';
    return { meaning: definitionBlock.definition, partOfSpeech: meaningBlock?.partOfSpeech || '', pronunciation: phonetic, example: definitionBlock.example || '' };
  } catch {
    return null;
  }
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

type AuthUser = { id: string; email: string };

async function authFetch(path: string, init?: RequestInit) {
  return fetch(`/api${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
}

function useAuthController() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<'checking' | 'ready'>('checking');
  const qc = useQueryClient();

  useEffect(() => {
    authFetch('/auth/me').then(async response => { if (response.ok) setUser(await response.json()); }).catch(() => {}).finally(() => setStatus('ready'));
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Could not log in.');
    setUser(data);
  };

  const signup = async (email: string, password: string) => {
    const response = await authFetch('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Could not create your account.');
    setUser(data);
  };

  const logout = async () => {
    await authFetch('/auth/logout', { method: 'POST' });
    setUser(null);
    qc.clear();
  };

  return { user, status, login, signup, logout };
}

const AuthContext = createContext<ReturnType<typeof useAuthController> | null>(null);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const controller = useAuthController();
  return <AuthContext.Provider value={controller}>{children}</AuthContext.Provider>;
}

function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      if (mode === 'login') await login(email, password); else await signup(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  };

  return <div className="flex min-h-[100dvh] items-center justify-center p-6">
    <div className="card-surface w-full max-w-sm p-7 md:p-9">
      <p className="eyebrow">Vocab Atelier</p>
      <h1 className="serif mt-2 text-2xl">{mode === 'login' ? 'Welcome back.' : 'Start your shelf.'}</h1>
      <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{mode === 'login' ? 'Log in to reach your words.' : 'A free account keeps your vocabulary private to you.'}</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div><label className="field-label" htmlFor="auth-email">Email</label><input id="auth-email" type="email" autoComplete="email" className="field" required value={email} onChange={e => setEmail(e.target.value)} data-testid="input-auth-email" /></div>
        <div><label className="field-label" htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="field" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} data-testid="input-auth-password" /></div>
        {error && <p className="text-xs text-[hsl(var(--destructive))]" data-testid="status-auth-error">{error}</p>}
        <button type="submit" className="button-primary w-full justify-center" disabled={pending} data-testid="button-auth-submit">{pending && <Loader2 size={15} className="animate-spin" />} {mode === 'login' ? 'Log in' : 'Create account'}</button>
      </form>
      <button type="button" className="button-quiet mt-5 w-full justify-center" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} data-testid="button-auth-toggle">{mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}</button>
    </div>
  </div>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  if (status === 'checking') return <div className="flex min-h-[100dvh] items-center justify-center"><Loader2 size={22} className="animate-spin text-[hsl(var(--primary))]" /></div>;
  if (!user) return <AuthScreen />;
  return <>{children}</>;
}

function showToast(message: string) {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: message }));
}

function ToastHost() {
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  useEffect(() => {
    const handler = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, message }]);
      setTimeout(() => setToasts(prev => prev.filter(toast => toast.id !== id)), 2600);
    };
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, []);
  if (!toasts.length) return null;
  return <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2">{toasts.map(toast => <div key={toast.id} className="rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-medium text-[hsl(var(--primary-foreground))] shadow-lg" role="status" data-testid="toast-message">{toast.message}</div>)}</div>;
}

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <ToastHost />
      <aside className="sidebar">
        <Logo />
        <div className="mt-12 space-y-1">
          <p className="eyebrow mb-3 px-3 text-[hsl(var(--sidebar-foreground)/.38)]">Study room</p>
          <NavItem href="/" icon={<Gauge size={17} />} label="Today" />
          <NavItem href="/challenge" icon={<CalendarDays size={17} />} label="Challenge" />
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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--sidebar-primary)/.18)] text-xs font-bold text-[hsl(var(--sidebar-primary))]">{(user?.email ?? '?').slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-xs text-[hsl(var(--sidebar-foreground)/.85)]" data-testid="text-current-user">{user?.email}</p><button type="button" className="mono text-[9px] text-[hsl(var(--sidebar-foreground)/.5)] underline-offset-2 hover:underline" onClick={logout} data-testid="button-logout">LOG OUT</button></div>
        </div>
      </aside>
      <main className="main-area">{children}</main>
      <nav className="mobile-nav">
        <NavItem href="/" icon={<Gauge />} label="Today" />
        <NavItem href="/challenge" icon={<CalendarDays />} label="Challenge" />
        <NavItem href="/library" icon={<LibraryBig />} label="Library" />
        <NavItem href="/review" icon={<Brain />} label="Review" />
        <NavItem href="/insights" icon={<TrendingUp />} label="Insights" />
        <button type="button" className="nav-link" onClick={logout} data-testid="button-logout-mobile"><LogOut /><span>Log out</span></button>
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
  const color = accent === 'gold' ? 'hsl(var(--accent))' : accent === 'sage' ? '#1F9D64' : 'hsl(var(--primary))';
  return <div className="card-surface hover-lift p-5" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="mb-6 flex items-start justify-between"><span className="eyebrow">{label}</span><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /></div><p className="serif text-4xl leading-none">{value}</p><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{detail}</p></div>;
}

const dailyChallengeStorageKey = 'vocab-atelier-daily-challenge';

function getDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDayNumber(value: string) {
  return value.split('').reduce((total, character) => total + character.charCodeAt(0), 0);
}

function DailyChallenge({ fullPage = false }: { fullPage?: boolean }) {
  const list = useListVocabulary();
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const items = (list.data ?? []).slice().sort((a, b) => a.id.localeCompare(b.id));
  const today = getDayKey();
  const item = items.length ? items[getDayNumber(today) % items.length] : undefined;

  useEffect(() => {
    try {
      setCompleted(window.localStorage.getItem(dailyChallengeStorageKey) === today);
    } catch {
      setCompleted(false);
    }
  }, [today]);

  const finish = () => {
    try {
      window.localStorage.setItem(dailyChallengeStorageKey, today);
    } catch {
      // The challenge still completes for this session if storage is unavailable.
    }
    setCompleted(true);
    setRevealed(true);
  };

  const challenge = list.isLoading ? <div className="card-surface p-6"><div className="skeleton h-4 w-32" /><div className="skeleton mt-6 h-9 w-3/4" /><div className="skeleton mt-4 h-4 w-1/2" /></div> :
    list.isError ? <ErrorState onRetry={() => list.refetch()} /> :
    !item ? <EmptyState title="Your challenge is waiting." copy="Save a few words to your shelf and tomorrow's prompt will be ready." action={<Link href="/library" className="button-primary"><Plus size={15} /> Save a word</Link>} /> :
    <div className="card-surface relative overflow-hidden p-7 md:p-9" data-testid="card-daily-challenge">
      <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border-[24px] border-[hsl(var(--accent)/.2)]" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--accent)/.28)] text-[hsl(var(--primary))]"><CalendarDays size={17} /></span><span className="eyebrow">One thoughtful prompt</span></div>
          <span className={`tag ${completed ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]' : ''}`}>{completed ? 'Complete today' : 'Ready in 2 minutes'}</span>
        </div>
        <p className="eyebrow mt-8">Today's word</p>
        <h2 className="serif mt-2 text-4xl leading-tight">{revealed ? item.term : 'What word fits this meaning?'}</h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{item.meaning}</p>
        <div className="mt-6 rounded-2xl bg-[hsl(var(--secondary)/.55)] p-4"><p className="eyebrow mb-2">Use it in context</p><p className="text-sm italic leading-relaxed">“{item.example}”</p></div>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          {!revealed && <button className="button-primary" onClick={() => setRevealed(true)} data-testid="button-reveal-challenge"><Sparkles size={15} /> Reveal the word</button>}
          {revealed && !completed && <button className="button-primary" onClick={finish} data-testid="button-complete-challenge"><Check size={15} /> Mark challenge complete</button>}
          {completed && <span className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--primary))]"><Check size={16} /> Your daily practice is logged.</span>}
          
        </div>
      </div>
    </div>;

  if (fullPage) return <div className="content-wrap"><PageHeader eyebrow="Daily vocabulary" title="A small challenge, every day." description="Turn one saved word into a memory you can reach for in conversation." action={<Link href="/" className="button-secondary"><Gauge size={15} /> Back to today</Link>} /><div className="mx-auto max-w-3xl">{challenge}</div></div>;
  return <section className="mt-8 fade-in delay-2"><div className="mb-4 flex items-end justify-between gap-3"><div><p className="eyebrow">Daily vocabulary</p><h2 className="serif mt-2 text-2xl">Keep the thread alive.</h2></div><Link href="/challenge" className="button-quiet">Open challenge <ChevronRight size={14} /></Link></div>{challenge}</section>;
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
      <DailyChallenge />
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

function VocabularyDetailModal({ item, onClose, onEdit }: { item: VocabularyItem; onClose: () => void; onEdit: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="detail-modal-title" data-testid="dialog-vocabulary-detail">
    <div className="mb-6 flex items-start justify-between"><div><span className="tag" style={{ color: typeColors[item.type], background: `${typeColors[item.type]}18` }}>{typeLabels[item.type]}</span><h2 id="detail-modal-title" className="serif mt-3 text-4xl">{item.term}</h2>{item.pronunciation && <p className="mono mt-2 text-xs text-[hsl(var(--muted-foreground))]">{item.pronunciation}</p>}</div><button className="button-quiet" onClick={onClose} aria-label="Close" data-testid="button-close-detail"><X size={18} /></button></div>
    <div className="space-y-5">
      <div><p className="eyebrow mb-1">Meaning</p><p className="text-sm leading-relaxed">{item.meaning}</p></div>
      {item.urduMeaning && <div><p className="eyebrow mb-1">Urdu meaning</p><p className="text-right text-sm leading-relaxed" dir="rtl" lang="ur">{item.urduMeaning}</p></div>}
      {item.translation && <div><p className="eyebrow mb-1">Translation</p><p className="text-sm leading-relaxed">{item.translation}</p></div>}
      <div><p className="eyebrow mb-1">In context</p><p className="text-sm italic leading-relaxed text-[hsl(var(--muted-foreground))]">“{item.example}”</p></div>
      {item.retrievalQuestions?.length > 0 && <div><p className="eyebrow mb-1">Recall questions</p><ul className="space-y-1.5">{item.retrievalQuestions.map((question, index) => <li key={index} className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{question}</li>)}</ul></div>}
      {item.notes && <div><p className="eyebrow mb-1">Notes</p><p className="text-sm leading-relaxed">{item.notes}</p></div>}
      {item.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{item.tags.map(tag => <span key={tag} className="tag">#{tag}</span>)}</div>}
      <div className="flex flex-wrap gap-4 border-t border-[hsl(var(--border))] pt-4 text-xs text-[hsl(var(--muted-foreground))]"><span>{item.repetitions ? `${item.intervalDays} day interval` : 'New card'}</span><span>{formatDue(item.dueAt)}</span></div>
    </div>
    <div className="mt-7 flex justify-end gap-2"><button className="button-secondary" onClick={onClose} data-testid="button-close-detail-secondary">Close</button><button className="button-primary" onClick={onEdit} data-testid="button-edit-from-detail"><Pencil size={15} /> Edit</button></div>
  </div></div>;
}

type ImportStage = 'choose' | 'reviewing' | 'importing' | 'done';

function ImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const create = useCreateVocabulary();
  const enrich = useEnrichVocabulary();
  const [stage, setStage] = useState<ImportStage>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<{ added: number; skipped: string[] }>({ added: 0, skipped: [] });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File) => {
    setError('');
    setBusy(true);
    const body = new FormData();
    body.append('file', file);
    try {
      const response = await fetch('/api/import/extract', { method: 'POST', body, credentials: 'include' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Could not read that file.');
      const found: string[] = data?.candidates ?? [];
      if (!found.length) { setError('No new candidate words were found in that file.'); setBusy(false); return; }
      setCandidates(found);
      setSelected(new Set(found));
      setStage('reviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (word: string) => setSelected(prev => { const next = new Set(prev); if (next.has(word)) next.delete(word); else next.add(word); return next; });

  const startImport = async () => {
    const words = candidates.filter(word => selected.has(word));
    if (!words.length) return;
    setStage('importing');
    setProgress({ done: 0, total: words.length });
    let added = 0;
    const skipped: string[] = [];
    for (const word of words) {
      let filled = await fetchFreeDefinition(word);
      if (!filled) {
        try {
          const data = await enrich.mutateAsync({ data: { term: word, type: 'word', context: null } });
          filled = { meaning: data.meaning, partOfSpeech: data.partOfSpeech ?? '', pronunciation: data.pronunciation ?? '', example: data.example };
        } catch {
          filled = null;
        }
      }
      if (!filled?.meaning || !filled.example) {
        skipped.push(word);
      } else {
        try {
          await create.mutateAsync({ data: { term: word, type: 'word', meaning: filled.meaning, partOfSpeech: filled.partOfSpeech || null, pronunciation: filled.pronunciation || null, example: filled.example, tags: [], retrievalQuestions: [], source: 'ai' } });
          added += 1;
        } catch {
          skipped.push(word);
        }
      }
      setProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }
    qc.invalidateQueries({ queryKey: getListVocabularyQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    setResults({ added, skipped });
    setStage('done');
    if (added) showToast(`${added} word${added === 1 ? '' : 's'} imported.`);
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && stage !== 'importing') onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="import-modal-title" data-testid="dialog-import">
    <div className="mb-7 flex items-start justify-between"><div><p className="eyebrow mb-2">Bring in words</p><h2 id="import-modal-title" className="serif text-3xl">Import vocabulary.</h2></div>{stage !== 'importing' && <button className="button-quiet" onClick={onClose} data-testid="button-close-import"><X size={18} /></button>}</div>

    {stage === 'choose' && <div>
      <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Upload a PDF or a plain text file. We'll pull out candidate words you haven't saved yet, so you can pick which ones actually matter to you before anything is added.</p>
      <button type="button" className="button-primary mt-6 w-full justify-center" onClick={() => fileInputRef.current?.click()} disabled={busy} data-testid="button-choose-file">{busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {busy ? 'Reading file...' : 'Choose a file'}</button>
      <input ref={fileInputRef} type="file" accept=".pdf,.txt,text/plain,application/pdf" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) handleFile(file); event.target.value = ''; }} data-testid="input-import-file" />
      {error && <p className="mt-3 text-xs text-[hsl(var(--destructive))]" data-testid="status-import-error">{error}</p>}
    </div>}

    {stage === 'reviewing' && <div>
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-[hsl(var(--muted-foreground))]">{selected.size} of {candidates.length} selected</p><div className="flex gap-2"><button type="button" className="button-quiet" onClick={() => setSelected(new Set(candidates))} data-testid="button-select-all">Select all</button><button type="button" className="button-quiet" onClick={() => setSelected(new Set())} data-testid="button-select-none">Select none</button></div></div>
      <div className="mt-4 max-h-[45vh] overflow-auto rounded-2xl border border-[hsl(var(--border))] p-3"><div className="flex flex-wrap gap-2">{candidates.map(word => <button key={word} type="button" onClick={() => toggle(word)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${selected.has(word) ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'}`} data-testid={`button-candidate-${word}`}>{word}</button>)}</div></div>
      <div className="mt-6 flex justify-end gap-2"><button className="button-secondary" onClick={onClose} data-testid="button-cancel-import">Cancel</button><button className="button-primary" onClick={startImport} disabled={!selected.size} data-testid="button-start-import">Add {selected.size} word{selected.size === 1 ? '' : 's'}</button></div>
    </div>}

    {stage === 'importing' && <div className="py-10 text-center"><Loader2 size={22} className="mx-auto animate-spin text-[hsl(var(--primary))]" /><p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]" data-testid="status-import-progress">Importing {progress.done} of {progress.total}...</p></div>}

    {stage === 'done' && <div className="py-4 text-center">
      <p className="serif text-2xl">{results.added} word{results.added === 1 ? '' : 's'} added.</p>
      {results.skipped.length > 0 && <p className="mt-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Couldn't find a definition for: {results.skipped.join(', ')}</p>}
      <button className="button-primary mt-7" onClick={onClose} data-testid="button-finish-import">Done</button>
    </div>}
  </div></div>;
}

function Library() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | VocabularyType>('all');
  const [category, setCategory] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const params = useMemo(() => ({ search: search || undefined, type: filter === 'all' ? undefined : filter }), [search, filter]);
  const list = useListVocabulary(params);
  const exportList = useListVocabulary();
  const deleteMutation = useDeleteVocabulary();
  const qc = useQueryClient();
  const allItems = list.data ?? [];
  const categories = useMemo(() => Array.from(new Set(allItems.flatMap(item => item.tags))).sort((a, b) => a.localeCompare(b)), [allItems]);
  const items = category === 'all' ? allItems : allItems.filter(item => item.tags.includes(category));
  const handleDelete = (id: string, term: string) => { if (window.confirm(`Remove “${term}” from your shelf?`)) deleteMutation.mutate({ id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListVocabularyQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); } }); };
  const exportWords = () => {
    if (!exportList.data?.length) return;
    window.print();
  };
  return <div className="content-wrap">
    <PageHeader eyebrow="The collection" title="Your language, gathered." description="A living shelf of words, phrases, idioms, and verbs you decided were worth keeping." action={<div className="flex flex-wrap justify-end gap-2"><button className="button-secondary" onClick={() => setImporting(true)} data-testid="button-import-vocabulary"><Upload size={16} /> Import</button><button className="button-secondary" onClick={exportWords} disabled={exportList.isLoading || exportList.isError || !exportList.data?.length} data-testid="button-export-vocabulary"><FileDown size={16} /> {exportList.isLoading ? 'Preparing...' : 'Export PDF'}</button><button className="button-primary" onClick={() => setEditingId('new')} data-testid="button-add-vocabulary"><Plus size={16} /> Add vocabulary</button></div>} />
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between fade-in delay-1">
      <div className="relative w-full md:max-w-sm"><Search size={16} className="absolute left-3.5 top-3.5 text-[hsl(var(--muted-foreground))]" /><input className="field pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your shelf..." data-testid="input-search-vocabulary" /></div>
      <div className="flex gap-1.5 overflow-auto pb-1">{(['all', ...types] as const).map((type) => <button key={type} onClick={() => setFilter(type)} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${filter === type ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`} data-testid={`button-filter-${type}`}>{type === 'all' ? 'All words' : typeLabels[type]}</button>)}</div>
    </div>
     <section className="mb-7 card-surface p-5 fade-in delay-2" data-testid="section-themes">
       <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Tag size={15} /></span><div><p className="eyebrow">Thematic shelves</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Use tags as categories to make your words easier to revisit.</p></div></div><span className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{categories.length} {categories.length === 1 ? 'theme' : 'themes'}</span></div>
       {categories.length ? <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setCategory('all')} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${category === 'all' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'}`} data-testid="button-category-all">All themes</button>{categories.map(theme => <button key={theme} onClick={() => setCategory(theme)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${category === theme ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'}`} data-testid={`button-category-${theme}`}>#{theme} <span className="mono ml-1 opacity-70">{allItems.filter(item => item.tags.includes(theme)).length}</span></button>)}</div> : <p className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">Add themes like travel, work, or conversation in a word's Tags field.</p>}
     </section>
    {list.isLoading ? <LoadingState rows={5} /> : list.isError ? <ErrorState onRetry={() => list.refetch()} /> : items.length === 0 ? <EmptyState title={search ? 'Nothing matched.' : 'The shelf is still open.'} copy={search ? 'Try a shorter search or another spelling.' : 'Collect words from conversations, books, and the odd sentence that stays with you.'} action={!search ? <button className="button-primary" onClick={() => setEditingId('new')} data-testid="button-add-empty"><Plus size={15} /> Save a word</button> : undefined} /> : <div className="space-y-3">{items.map((item, index) => <LibraryRow key={item.id} item={item} index={index} onView={() => setViewingId(item.id)} onEdit={() => setEditingId(item.id)} onDelete={() => handleDelete(item.id, item.term)} deleting={deleteMutation.isPending} />)}</div>}
     {exportList.data?.length ? <PrintExport items={exportList.data} /> : null}
    {editingId && <VocabularyModal editingId={editingId === 'new' ? null : editingId} onClose={() => setEditingId(null)} />}
    {viewingId && (() => { const item = allItems.find(entry => entry.id === viewingId); return item ? <VocabularyDetailModal item={item} onClose={() => setViewingId(null)} onEdit={() => { setViewingId(null); setEditingId(item.id); }} /> : null; })()}
    {importing && <ImportModal onClose={() => setImporting(false)} />}
  </div>;
}

function PrintExport({ items }: { items: VocabularyItem[] }) {
  return <section className="print-export" aria-hidden="true">
    <div className="print-export-header">
      <p className="eyebrow">Vocab Atelier</p>
      <h1 className="serif">My vocabulary collection</h1>
      <p className="print-export-meta">{items.length} {items.length === 1 ? 'entry' : 'entries'} · Exported {new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date())}</p>
    </div>
    <div className="print-export-grid">
      {items.map(item => <article className="print-export-card" key={item.id}>
        <div className="print-export-card-heading">
          <h2>{item.term}</h2>
          <span>{typeLabels[item.type]}</span>
        </div>
        {item.pronunciation && <p className="print-export-pronunciation">{item.pronunciation}</p>}
        <p className="print-export-label">Meaning</p>
        <p>{item.meaning}</p>
        {item.urduMeaning && <><p className="print-export-label">Urdu meaning</p><p className="print-export-urdu" dir="rtl" lang="ur">{item.urduMeaning}</p></>}
        {item.translation && <><p className="print-export-label">Translation</p><p>{item.translation}</p></>}
        <p className="print-export-label">In context</p>
        <p className="print-export-example">“{item.example}”</p>
        {item.notes && <><p className="print-export-label">Notes</p><p>{item.notes}</p></>}
        {item.tags.length > 0 && <p className="print-export-tags">{item.tags.map(tag => `#${tag}`).join('  ')}</p>}
      </article>)}
    </div>
  </section>;
}

function LibraryRow({ item, index, onView, onEdit, onDelete, deleting }: { item: VocabularyItem; index: number; onView: () => void; onEdit: () => void; onDelete: () => void; deleting: boolean }) {
  return <div className={`card-surface hover-lift flex flex-col gap-4 p-5 fade-in delay-${Math.min(index + 1, 4)} md:flex-row md:items-center`} data-testid={`row-vocabulary-${item.id}`}>
    <button type="button" className="flex min-w-0 flex-1 items-center gap-4 text-left" onClick={onView} data-testid={`button-view-${item.id}`}><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold" style={{ background: `${typeColors[item.type]}18`, color: typeColors[item.type] }}>{item.term.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{item.term}</h3><span className="tag">{typeLabels[item.type]}</span>{item.source === 'ai' && <span className="tag bg-[hsl(var(--accent)/.25)]"><Sparkles size={10} className="mr-1" /> enriched</span>}</div><p className="mt-1 truncate text-sm text-[hsl(var(--muted-foreground))]">{item.meaning}</p><div className="mt-2 flex flex-wrap gap-1">{item.tags.slice(0, 3).map(tag => <span key={tag} className="mono text-[9px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">#{tag}</span>)}</div></div></button>
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
     if (item) setForm({ term: item.term, type: item.type, meaning: item.meaning, partOfSpeech: item.partOfSpeech ?? '', pronunciation: item.pronunciation ?? '', example: item.example, translation: item.translation ?? '', urduMeaning: item.urduMeaning ?? '', notes: item.notes ?? '', tags: item.tags.join(', '), retrievalQuestions: item.retrievalQuestions?.length ? item.retrievalQuestions : [''] });
  }, [itemQuery.data]);
  const set = (key: keyof Omit<FormState, 'retrievalQuestions'>, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const setQuestion = (index: number, value: string) => setForm(prev => ({ ...prev, retrievalQuestions: prev.retrievalQuestions.map((question, questionIndex) => questionIndex === index ? value : question) }));
  const addQuestion = () => setForm(prev => ({ ...prev, retrievalQuestions: [...prev.retrievalQuestions, ''] }));
  const removeQuestion = (index: number) => setForm(prev => ({ ...prev, retrievalQuestions: prev.retrievalQuestions.length > 1 ? prev.retrievalQuestions.filter((_, questionIndex) => questionIndex !== index) : [''] }));
   const applyEnrichment = () => { if (!form.term.trim()) return; enrich.mutate({ data: { term: form.term.trim(), type: form.type as VocabularyType, context: context || null } }, { onSuccess: (data) => setForm(prev => ({ ...prev, term: data.term, meaning: data.meaning, partOfSpeech: data.partOfSpeech ?? '', pronunciation: data.pronunciation ?? '', example: data.example, translation: data.translation ?? '', urduMeaning: data.urduMeaning ?? '', tags: data.tags.join(', '), retrievalQuestions: data.retrievalQuestions?.length ? data.retrievalQuestions : prev.retrievalQuestions, notes: data.memoryHook ? `Memory hook: ${data.memoryHook}` : prev.notes })) }); };
  const [freeLookupState, setFreeLookupState] = useState<'idle' | 'loading' | 'error'>('idle');
  const lookupFree = async () => {
    const term = form.term.trim();
    if (!term) return;
    setFreeLookupState('loading');
    const found = await fetchFreeDefinition(term);
    if (!found) { setFreeLookupState('error'); return; }
    setForm(prev => ({ ...prev, meaning: found.meaning || prev.meaning, partOfSpeech: found.partOfSpeech || prev.partOfSpeech, pronunciation: found.pronunciation || prev.pronunciation, example: found.example || prev.example }));
    setFreeLookupState('idle');
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!form.term.trim() || !form.meaning.trim() || !form.example.trim()) { setSaveError('Term, meaning, and example are required.'); return; }
    setSaveError('');
     const payload: VocabularyInput = { term: form.term.trim(), type: form.type as VocabularyType, meaning: form.meaning.trim(), partOfSpeech: form.partOfSpeech.trim() || null, pronunciation: form.pronunciation.trim() || null, example: form.example.trim(), translation: form.translation.trim() || null, urduMeaning: form.urduMeaning.trim() || null, notes: form.notes.trim() || null, tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean), retrievalQuestions: form.retrievalQuestions.map(question => question.trim()).filter(Boolean), source: enrich.data ? 'ai' : 'manual' };
    if (editingId) update.mutate({ id: editingId, data: payload }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListVocabularyQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetVocabularyQueryKey(editingId) }); showToast(`"${payload.term}" updated.`); onClose(); }, onError: () => setSaveError('That edit could not be saved. Try again.') });
    else create.mutate({ data: payload }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListVocabularyQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); showToast(`"${payload.term}" saved.`); onClose(); }, onError: () => setSaveError('That word could not be saved. Try again.') });
  };
  const busy = create.isPending || update.isPending;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="vocab-modal-title" data-testid="dialog-vocabulary">
    <div className="mb-7 flex items-start justify-between"><div><p className="eyebrow mb-2">{isNew ? 'Add to the collection' : 'Refine this entry'}</p><h2 id="vocab-modal-title" className="serif text-3xl">{isNew ? 'Save a new word.' : 'Edit your note.'}</h2></div><button className="button-quiet" onClick={onClose} data-testid="button-close-vocabulary"><X size={18} /></button></div>
    {itemQuery.isLoading && editingId ? <LoadingState rows={2} /> : <form onSubmit={save} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]"><div><label className="field-label" htmlFor="vocab-term">Term</label><input id="vocab-term" className="field" autoFocus value={form.term} onChange={e => set('term', e.target.value)} placeholder="e.g. serendipity" data-testid="input-vocabulary-term" /></div><div><label className="field-label" htmlFor="vocab-type">Kind</label><select id="vocab-type" className="field" value={form.type} onChange={e => set('type', e.target.value)} data-testid="select-vocabulary-type">{types.map(type => <option value={type} key={type}>{typeLabels[type]}</option>)}</select></div></div>
       <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] p-4"><div className="flex items-center gap-2"><Sparkles size={15} className="text-[hsl(var(--primary))]" /><p className="text-xs font-bold">Let the atelier help</p><span className="tag ml-auto">optional</span></div><div className="mt-3 flex flex-wrap gap-2"><input className="field flex-1 bg-[hsl(var(--card))]" value={context} onChange={e => setContext(e.target.value)} placeholder="Add a context or leave blank" data-testid="input-enrichment-context" /><button type="button" className="button-secondary shrink-0" onClick={lookupFree} disabled={freeLookupState === 'loading' || !form.term.trim()} data-testid="button-free-lookup">{freeLookupState === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} {freeLookupState === 'loading' ? 'Looking up...' : 'Free lookup'}</button><button type="button" className="button-secondary shrink-0" onClick={applyEnrichment} disabled={enrich.isPending || !form.term.trim()} data-testid="button-enrich-vocabulary">{enrich.isPending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {enrich.isPending ? 'Thinking...' : 'Enrich'}</button></div>{freeLookupState === 'error' && <p className="mt-2 text-xs text-[hsl(var(--destructive))]" data-testid="status-free-lookup-error">No free dictionary entry found for that term. Try Enrich instead.</p>}{enrich.isError && <p className="mt-2 text-xs text-[hsl(var(--destructive))]" data-testid="status-enrichment-error">{getEnrichmentErrorMessage(enrich.error)}</p>}</div>
      <div><label className="field-label" htmlFor="vocab-meaning">Meaning</label><textarea id="vocab-meaning" className="field min-h-[74px] resize-y" value={form.meaning} onChange={e => set('meaning', e.target.value)} placeholder="What does it mean, in your own words?" data-testid="input-vocabulary-meaning" /></div>
       <div><label className="field-label" htmlFor="vocab-urdu-meaning">Urdu meaning</label><textarea id="vocab-urdu-meaning" className="field min-h-[74px] resize-y text-right" dir="rtl" lang="ur" value={form.urduMeaning} onChange={e => set('urduMeaning', e.target.value)} placeholder="اردو میں معنی لکھیں" data-testid="input-vocabulary-urdu-meaning" /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label" htmlFor="vocab-pos">Part of speech</label><input id="vocab-pos" className="field" value={form.partOfSpeech} onChange={e => set('partOfSpeech', e.target.value)} placeholder="noun, verb..." data-testid="input-vocabulary-pos" /></div><div><label className="field-label" htmlFor="vocab-pronunciation">Pronunciation</label><input id="vocab-pronunciation" className="field" value={form.pronunciation} onChange={e => set('pronunciation', e.target.value)} placeholder="/ˌser.ənˈdip.ə.ti/" data-testid="input-vocabulary-pronunciation" /></div></div>
      <div><label className="field-label" htmlFor="vocab-example">Example sentence</label><textarea id="vocab-example" className="field min-h-[80px] resize-y" value={form.example} onChange={e => set('example', e.target.value)} placeholder="Put it in a sentence you might actually say." data-testid="input-vocabulary-example" /></div>
       <div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label" htmlFor="vocab-translation">Translation</label><input id="vocab-translation" className="field" value={form.translation} onChange={e => set('translation', e.target.value)} placeholder="Optional" data-testid="input-vocabulary-translation" /></div><div><label className="field-label" htmlFor="vocab-tags">Tags</label><input id="vocab-tags" className="field" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="travel, work, curious" data-testid="input-vocabulary-tags" /></div></div>
      <div><div className="flex items-center justify-between"><label className="field-label">Recall questions</label><span className="text-[10px] text-[hsl(var(--muted-foreground))]">2-3 scenario clues, no giveaways</span></div><div className="mt-1 space-y-2">{form.retrievalQuestions.map((question, index) => <div className="flex gap-2" key={index}><input className="field flex-1" value={question} onChange={e => setQuestion(index, e.target.value)} placeholder="Describe a situation where this word applies, without naming it" data-testid={`input-retrieval-question-${index}`} /><button type="button" className="button-secondary shrink-0 px-3" onClick={() => removeQuestion(index)} aria-label="Remove question" data-testid={`button-remove-retrieval-question-${index}`}><Trash2 size={14} /></button></div>)}</div><button type="button" className="button-quiet mt-2" onClick={addQuestion} data-testid="button-add-retrieval-question"><Plus size={14} /> Add a question</button></div>
      <div><label className="field-label" htmlFor="vocab-notes">Private notes</label><textarea id="vocab-notes" className="field min-h-[65px] resize-y" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="A memory, a nuance, a connection..." data-testid="input-vocabulary-notes" /></div>
      {saveError && <p className="flex items-center gap-2 text-xs text-[hsl(var(--destructive))]" data-testid="status-save-error"><CircleAlert size={14} /> {saveError}</p>}
      <div className="flex justify-end gap-2 border-t border-[hsl(var(--border))] pt-5"><button type="button" className="button-secondary" onClick={onClose} data-testid="button-cancel-vocabulary">Cancel</button><button type="submit" className="button-primary" disabled={busy} data-testid="button-save-vocabulary">{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {busy ? 'Saving...' : isNew ? 'Save word' : 'Save changes'}</button></div>
    </form>}
  </div></div>;
}

type PracticeMode = 'recall' | 'meaning' | 'urdu' | 'cloze' | 'word' | 'spelling' | 'choice' | 'match' | 'sentence' | 'synonym' | 'correction' | 'retrieval';

const practiceModes: Array<{ value: PracticeMode; label: string; description: string }> = [
  { value: 'recall', label: 'Recall and reveal', description: 'Think first, then reveal the answer.' },
  { value: 'retrieval', label: 'Answer your question', description: 'Answer your own scenario clue, then recall the word.' },
  { value: 'meaning', label: 'Write the meaning', description: 'Explain the word in English.' },
  { value: 'urdu', label: 'Write the Urdu meaning', description: 'Recall the Urdu meaning in Urdu script.' },
  { value: 'cloze', label: 'Fill in the blank', description: 'Complete the example sentence.' },
  { value: 'word', label: 'Write the word', description: 'See the meaning and recall the vocabulary.' },
  { value: 'spelling', label: 'Spelling check', description: 'Type the exact spelling from the clue.' },
  { value: 'choice', label: 'Multiple choice', description: 'Choose the correct English meaning.' },
  { value: 'match', label: 'Match the meaning', description: 'Match the word with its meaning.' },
  { value: 'sentence', label: 'Use it in a sentence', description: 'Write your own natural example.' },
  { value: 'synonym', label: 'Synonym or antonym', description: 'Write a related or opposite word.' },
  { value: 'correction', label: 'Correct the sentence', description: 'Rewrite the example using the word correctly.' },
];

function normalizeReviewAnswer(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/gi, ' ').trim();
}

function getClozeSentence(card: VocabularyItem) {
  const escapedTerm = card.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sentence = card.example.replace(new RegExp(escapedTerm, 'i'), '_____');
  return sentence === card.example ? `Use “${card.term}” to complete your own sentence.` : sentence;
}

function getReviewPrompt(mode: PracticeMode, card: VocabularyItem) {
  switch (mode) {
    case 'meaning':
      return `What does “${card.term}” mean in English?`;
    case 'urdu':
      return `What is the Urdu meaning of “${card.term}”?`;
    case 'cloze':
      return getClozeSentence(card);
    case 'word':
      return `Write the vocabulary item for this meaning: ${card.meaning}`;
    case 'spelling':
      return `Type the exact spelling for: ${card.meaning}`;
    case 'choice':
    case 'match':
      return `Choose the meaning that matches “${card.term}”.`;
    case 'sentence':
      return `Write your own sentence using “${card.term}”.`;
    case 'synonym':
      return `Write a synonym or antonym for “${card.term}”.`;
    case 'correction':
      return `Rewrite this example in your own correct sentence: “${card.example}”`;
    case 'retrieval':
      return 'Which word does this question point to?';
    default:
      return 'What does this mean?';
  }
}

function getObjectiveAnswer(mode: PracticeMode, card: VocabularyItem) {
  if (mode === 'word' || mode === 'spelling' || mode === 'cloze' || mode === 'retrieval') return card.term;
  if (mode === 'choice' || mode === 'match') return card.meaning;
  return null;
}

function ReviewAnswerDetails({ card }: { card: VocabularyItem }) {
  return <div className="mt-5 space-y-4 text-left">
    <div><p className="eyebrow mb-2">English meaning</p><p className="serif text-2xl leading-snug" data-testid="text-review-meaning">{card.meaning}</p></div>
    {card.urduMeaning && <div className="rounded-xl bg-[hsl(var(--secondary)/.55)] px-4 py-3 text-right" dir="rtl" lang="ur"><p className="eyebrow mb-2 text-left" dir="ltr">Urdu meaning</p><p className="text-lg leading-relaxed" data-testid="text-review-urdu-meaning">{card.urduMeaning}</p></div>}
    {card.translation && <p className="text-sm text-[hsl(var(--muted-foreground))]">{card.translation}</p>}
    <div className="rounded-xl bg-[hsl(var(--secondary)/.55)] p-4"><p className="eyebrow mb-2">In context</p><p className="text-sm italic leading-relaxed">“{card.example}”</p></div>
    {card.notes && <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Note: {card.notes}</p>}
  </div>;
}

function Review() {
  const list = useListVocabulary();
  const submit = useSubmitReview();
  const qc = useQueryClient();
  const [mode, setMode] = useState<PracticeMode>('recall');
  const [practiceCount, setPracticeCount] = useState('5');
  const [sessionCards, setSessionCards] = useState<VocabularyItem[]>([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [answered, setAnswered] = useState(false);
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);
  const [lastRating, setLastRating] = useState<ReviewRatingType | null>(null);
  const [saveError, setSaveError] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const dueCards = useMemo(() => (list.data ?? []).filter(item => new Date(item.dueAt).getTime() <= Date.now()).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)), [list.data]);
  const retrievalEligible = useMemo(() => dueCards.filter(item => (item.retrievalQuestions?.length ?? 0) > 0).length, [dueCards]);
  const card = sessionCards[cardIndex];
  const choices = useMemo(() => {
    if (!card || (mode !== 'choice' && mode !== 'match')) return [];
    return Array.from(new Set([card.meaning, ...sessionCards.filter(item => item.id !== card.id).map(item => item.meaning)])).slice(0, 4).sort((a, b) => a.localeCompare(b));
  }, [card, mode, sessionCards]);
  const ratingCopy: Record<string, { label: string; hint: string }> = { again: { label: 'Again', hint: 'Reset the thread' }, hard: { label: 'Hard', hint: 'A little more practice' }, good: { label: 'Good', hint: 'Keep this interval' }, easy: { label: 'Easy', hint: 'You have this one' } };

  useEffect(() => {
    setAnswer('');
    setSelectedOption('');
    setAnswered(false);
    setAnswerCorrect(null);
    setLastRating(null);
    setSaveError('');
    setQuestionIndex(card?.retrievalQuestions?.length ? Math.floor(Math.random() * card.retrievalQuestions.length) : 0);
  }, [card?.id, mode]);

  const questionCount = card?.retrievalQuestions?.length ?? 0;
  const activeQuestion = questionCount ? card!.retrievalQuestions[questionIndex % questionCount] : '';
  const showPrevQuestion = () => setQuestionIndex(index => (index - 1 + questionCount) % questionCount);
  const showNextQuestion = () => setQuestionIndex(index => (index + 1) % questionCount);

  const startSession = () => {
    if (mode === 'retrieval' && retrievalEligible === 0) return;
    const pool = mode === 'retrieval' ? dueCards.filter(item => (item.retrievalQuestions?.length ?? 0) > 0) : dueCards;
    const amount = practiceCount === 'all' ? pool.length : Number(practiceCount);
    setSessionCards(pool.slice(0, amount));
    setCardIndex(0);
    setSessionStarted(true);
  };

  const checkAnswer = () => {
    if (mode === 'recall') {
      setAnswered(true);
      return;
    }
    const response = mode === 'choice' || mode === 'match' ? selectedOption : answer.trim();
    if (!response) return;
    const expected = getObjectiveAnswer(mode, card);
    setAnswerCorrect(expected ? normalizeReviewAnswer(response) === normalizeReviewAnswer(expected) : null);
    setAnswered(true);
  };

  const rate = (rating: ReviewRatingType) => {
    if (!card || !answered || submit.isPending) return;
    setLastRating(rating);
    setSaveError('');
    submit.mutate({ id: card.id, data: { rating } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        qc.invalidateQueries({ queryKey: getListVocabularyQueryKey() });
        setCardIndex(index => index + 1);
      },
      onError: () => {
        setLastRating(null);
        setSaveError('That review could not be saved. Try again.');
      },
    });
  };

  return <div className="content-wrap">
    <PageHeader eyebrow="Spaced repetition" title="Practice with intention." description="Choose a practice style, answer the prompt, then rate how it felt." action={<Link href="/library" className="button-secondary" data-testid="link-review-library"><LibraryBig size={15} /> Browse shelf</Link>} />
    {list.isLoading ? <div className="card-surface mx-auto max-w-2xl p-8"><div className="skeleton h-3 w-20" /><div className="skeleton mx-auto mt-20 h-12 w-2/3" /><div className="skeleton mx-auto mt-4 h-4 w-1/2" /><div className="skeleton mt-24 h-12 w-full" /></div> : list.isError ? <ErrorState onRetry={() => list.refetch()} /> : dueCards.length === 0 ? <EmptyState title="The shelf is quiet." copy="There are no cards due right now. Add a new word or come back later for another round." action={<Link href="/library" className="button-primary" data-testid="link-review-empty-library"><Plus size={15} /> Add vocabulary</Link>} /> : !sessionStarted ? <div className="mx-auto max-w-3xl">
      <div className="card-surface p-6 md:p-8">
        <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.25)] text-[hsl(var(--primary))]"><Brain size={20} /></span><div><p className="eyebrow">Build a session</p><h2 className="serif mt-2 text-3xl">How do you want to practice?</h2><p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{dueCards.length} {dueCards.length === 1 ? 'card is' : 'cards are'} ready today.</p></div></div>
        <div className="mt-7 grid gap-4 md:grid-cols-[1fr_180px]">
          <div><label className="field-label" htmlFor="practice-mode">Practice style</label><select id="practice-mode" className="field" value={mode} onChange={event => setMode(event.target.value as PracticeMode)} data-testid="select-practice-mode">{practiceModes.map(option => <option key={option.value} value={option.value}>{option.label} — {option.description}</option>)}</select>{mode === 'retrieval' && <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">{retrievalEligible} of {dueCards.length} due {dueCards.length === 1 ? 'card has' : 'cards have'} saved recall questions.</p>}</div>
          <div><label className="field-label" htmlFor="practice-count">Words at a time</label><select id="practice-count" className="field" value={practiceCount} onChange={event => setPracticeCount(event.target.value)} data-testid="select-practice-count"><option value="5">5 words</option><option value="10">10 words</option><option value="20">20 words</option><option value="all">All due words</option></select></div>
        </div>
        {mode === 'retrieval' && retrievalEligible === 0 && <p className="mt-3 text-xs text-[hsl(var(--destructive))]" data-testid="status-no-retrieval-questions">None of your due words have recall questions saved yet. Add some from the Library, or add them via Enrich.</p>}
        <button className="button-primary mt-7 w-full sm:w-auto" onClick={startSession} disabled={mode === 'retrieval' && retrievalEligible === 0} data-testid="button-start-practice"><Brain size={16} /> Start practice</button>
      </div>
    </div> : !card ? <div className="mx-auto max-w-2xl text-center">
      <div className="card-surface p-8"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Check size={25} /></span><p className="serif mt-5 text-3xl">Session complete.</p><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">You practiced {sessionCards.length} {sessionCards.length === 1 ? 'word' : 'words'}. Come back later when the next interval is due.</p><button className="button-primary mt-6" onClick={() => setSessionStarted(false)} data-testid="button-new-practice"><RotateCcw size={15} /> Practice again</button></div>
    </div> : <div className="mx-auto max-w-2xl fade-in">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><span className="eyebrow">Card {cardIndex + 1} of {sessionCards.length}</span><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{practiceModes.find(option => option.value === mode)?.label}</p></div><button className="button-quiet" onClick={() => setSessionStarted(false)} data-testid="button-change-practice">Change session</button></div>
      <div className={`card-surface relative overflow-hidden p-6 transition md:p-7 ${answered ? 'border-[hsl(var(--primary)/.35)]' : ''}`}><div className="absolute left-0 top-0 h-1 w-full bg-[hsl(var(--accent))]" /><div className="flex items-center justify-between gap-3"><span className="tag" style={{ color: typeColors[card.type], background: `${typeColors[card.type]}18` }}>{typeLabels[card.type]}</span><span className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{formatDue(card.dueAt)}</span></div>
        {mode === 'word' || mode === 'spelling' ? <div className="mt-10 text-center"><p className="eyebrow">Clue</p><p className="serif mt-4 text-2xl leading-snug">{card.meaning}</p></div> : mode === 'retrieval' ? <div className="mt-10 text-center"><p className="eyebrow">Your question{questionCount > 1 ? ` (${questionIndex % questionCount + 1} of ${questionCount})` : ''}</p><div className="mt-4 flex items-center justify-center gap-3">{questionCount > 1 && <button type="button" className="button-quiet" onClick={showPrevQuestion} aria-label="Previous question" data-testid="button-prev-retrieval-question"><ChevronLeft size={18} /></button>}<p className="serif max-w-md text-2xl leading-snug" data-testid="text-review-retrieval-question">{activeQuestion || 'No recall questions saved for this word yet.'}</p>{questionCount > 1 && <button type="button" className="button-quiet" onClick={showNextQuestion} aria-label="Next question" data-testid="button-next-retrieval-question"><ChevronRight size={18} /></button>}</div></div> : <div className="mt-10 text-center"><h2 className="serif text-[clamp(40px,8vw,70px)] leading-none tracking-[-.045em]" data-testid="text-review-term">{card.term}</h2>{card.pronunciation && <p className="mono mt-4 text-xs text-[hsl(var(--muted-foreground))]">{card.pronunciation}</p>}</div>}
        {!answered ? <div className="mx-auto mt-9 max-w-lg border-t border-[hsl(var(--border))] pt-7">
          <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{getReviewPrompt(mode, card)}</p>
          {mode === 'recall' ? <button className="button-primary mt-5" onClick={checkAnswer} data-testid="button-reveal-answer">Reveal answer <ChevronRight size={15} /></button> : mode === 'choice' || mode === 'match' ? <div className="mt-5 space-y-2">{choices.map(choice => <button className={`review-option w-full ${selectedOption === choice ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))]' : ''}`} key={choice} onClick={() => setSelectedOption(choice)} data-testid="button-choice-option">{choice}</button>)}<button className="button-primary mt-3" onClick={checkAnswer} disabled={!selectedOption} data-testid="button-check-answer">Check answer <Check size={15} /></button></div> : <div className="mt-5"><textarea className="field min-h-[90px] resize-y" dir={mode === 'urdu' ? 'rtl' : 'auto'} lang={mode === 'urdu' ? 'ur' : undefined} value={answer} onChange={event => setAnswer(event.target.value)} placeholder={mode === 'urdu' ? 'اردو میں جواب لکھیں' : 'Write your answer here...'} data-testid="input-review-answer" /><button className="button-primary mt-3" onClick={checkAnswer} disabled={!answer.trim()} data-testid="button-check-answer">Check answer <Check size={15} /></button></div>}
        </div> : <div className="mx-auto mt-9 max-w-lg border-t border-[hsl(var(--border))] pt-7">
          {answerCorrect === true && <p className="mb-4 text-sm font-semibold text-[hsl(var(--primary))]">Looks right.</p>}
          {answerCorrect === false && <p className="mb-4 text-sm font-semibold text-[hsl(var(--destructive))]">Not quite—compare with the answer below.</p>}
          {answerCorrect === null && mode !== 'recall' && <div className="mb-4 rounded-xl bg-[hsl(var(--secondary)/.55)] p-4"><p className="eyebrow mb-2">Your response</p><p className="text-sm leading-relaxed" dir={mode === 'urdu' ? 'rtl' : 'auto'}>{answer || selectedOption}</p></div>}
          <ReviewAnswerDetails card={card} />
        </div>}
      </div>
      {answered && <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">{(Object.keys(ratingCopy) as ReviewRatingType[]).map(rating => <button className="review-option" key={rating} onClick={() => rate(rating)} disabled={submit.isPending} data-testid={`button-rate-${rating}`}><span className="block text-sm font-bold">{ratingCopy[rating].label}</span><span className="mt-1 block text-[10px] leading-tight text-[hsl(var(--muted-foreground))]">{ratingCopy[rating].hint}</span></button>)}</div>}
      {saveError && <p className="mt-5 flex items-center justify-center gap-2 text-xs text-[hsl(var(--destructive))]" data-testid="status-review-error"><CircleAlert size={14} /> {saveError}</p>}
      {lastRating && submit.isPending && <p className="mt-5 text-center text-xs text-[hsl(var(--muted-foreground))]" data-testid="status-review-saving"><Loader2 size={13} className="mr-1 inline animate-spin" /> Saving your rhythm...</p>}
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
  return <Shell><ErrorBoundary resetKey={location}><Switch><Route path="/" component={Dashboard} /><Route path="/challenge" component={() => <DailyChallenge fullPage />} /><Route path="/library" component={Library} /><Route path="/review" component={Review} /><Route path="/insights" component={Insights} /><Route component={NotFoundView} /></Switch></ErrorBoundary></Shell>;
}

function App() {
  return <QueryClientProvider client={queryClient}><AuthProvider><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AuthGate><Router /></AuthGate></WouterRouter><Toaster /></TooltipProvider></AuthProvider></QueryClientProvider>;
}

export default App;
