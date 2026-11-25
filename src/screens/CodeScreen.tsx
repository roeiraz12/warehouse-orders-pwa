import { useState } from 'react';
import { BigButton } from '../components/ui/BigButton';
import { useOrders } from '../store/ordersStore';
import { he } from '../i18n/he';

/** Live mode, once per phone: the shared business code keeps strangers out of the order data. */
export function CodeScreen() {
  const submitCode = useOrders((s) => s.submitCode);
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<'wrong' | 'offline' | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setProblem(null);
    const result = await submitCode(code);
    if (result !== 'ok') {
      setBusy(false);
      setProblem(result);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-8 px-5 py-10">
      <div className="text-center">
        <div aria-hidden="true" className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-brand text-5xl text-white">
          🔑
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900">{he.code.title}</h1>
        <p className="mt-3 text-xl text-slate-700">{he.code.explain}</p>
      </div>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="block">
          <span className="sr-only">{he.code.label}</span>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setProblem(null);
            }}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            dir="ltr"
            className="h-24 w-full rounded-3xl border-4 border-slate-300 bg-white text-center text-4xl font-extrabold tracking-widest text-slate-900 focus:border-brand focus:outline-none"
          />
        </label>

        {problem && (
          <p role="alert" className="rounded-2xl bg-bad-soft p-4 text-xl font-bold text-bad-ink">
            ⚠ {problem === 'wrong' ? he.code.wrong : he.connection.loadFailed}
          </p>
        )}

        <BigButton type="submit" size="xl" disabled={busy || !code.trim()}>
          {busy ? he.code.checking : he.code.submit}
        </BigButton>
      </form>
    </main>
  );
}
