import { useNavigate } from 'react-router-dom';
import { useSession } from '../../store/sessionStore';
import { he } from '../../i18n/he';
import { useGoBack } from '../../lib/backButton';

interface Props {
  title: string;
  /** Where "Back" goes. Omit on home screens — there is nowhere to go back to. */
  backTo?: string;
}

export function ScreenHeader({ title, backTo }: Props) {
  const navigate = useNavigate();
  const { role, setRole } = useSession();
  const goBack = useGoBack();

  const btn = 'min-h-12 shrink-0 rounded-xl px-3 text-lg font-bold active:scale-[0.97]';

  return (
    <header className="sticky top-0 z-40 bg-brand px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white shadow-md">
      <div className="flex items-center gap-2">
        {backTo && (
          <button type="button" className={`${btn} bg-white text-brand`} onClick={() => goBack(backTo)}>
            <span aria-hidden="true">→ </span>
            {he.header.back}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold leading-tight">{title}</h1>
          <p className="text-sm leading-tight text-white/80">
            {he.header.loggedInAs} {role === 'manager' ? he.header.roleManager : he.header.roleEmployee}
          </p>
        </div>
        <button
          type="button"
          className={`${btn} border-2 border-white/60`}
          onClick={() => {
            setRole(null);
            navigate('/', { replace: true });
          }}
        >
          {he.header.exit}
        </button>
      </div>
    </header>
  );
}
