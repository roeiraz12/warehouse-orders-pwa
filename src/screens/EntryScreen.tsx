import { useNavigate } from 'react-router-dom';
import { useSession } from '../store/sessionStore';
import { BigButton } from '../components/ui/BigButton';
import { he } from '../i18n/he';

export function EntryScreen() {
  const navigate = useNavigate();
  const setRole = useSession((s) => s.setRole);

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-10 px-5 py-10">
      <div className="text-center">
        <div aria-hidden="true" className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-brand text-5xl text-white">
          📦
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900">{he.appName}</h1>
        <p className="mt-3 text-xl text-slate-700">{he.entry.subtitle}</p>
      </div>

      <div className="flex flex-col gap-6">
        <BigButton
          size="xl"
          className="min-h-[140px] whitespace-nowrap text-3xl"
          icon="👔"
          onClick={() => {
            setRole('manager');
            navigate('/manager', { replace: true });
          }}
        >
          {he.entry.manager}
        </BigButton>
        <BigButton
          size="xl"
          variant="success"
          className="min-h-[140px] whitespace-nowrap text-3xl"
          icon="📋"
          onClick={() => {
            setRole('employee');
            navigate('/orders', { replace: true });
          }}
        >
          {he.entry.employee}
        </BigButton>
      </div>
    </main>
  );
}
