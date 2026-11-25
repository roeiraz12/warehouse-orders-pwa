import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { BigButton } from '../../components/ui/BigButton';
import { NumberStepper } from '../../components/ui/NumberStepper';
import { useToast } from '../../components/ui/Toast';
import { useOrders } from '../../store/ordersStore';
import { DEFAULT_BUSINESS_DAYS } from '../../lib/orderRules';
import { he } from '../../i18n/he';

interface Row {
  key: number;
  name: string;
  qty: number;
}

const inputCls =
  'w-full min-h-touch rounded-2xl border-4 border-slate-300 bg-white px-4 text-xl text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none';

export function NewOrderScreen() {
  const navigate = useNavigate();
  const createOrder = useOrders((s) => s.createOrder);
  const showToast = useToast((s) => s.show);

  const [client, setClient] = useState('');
  const [rows, setRows] = useState<Row[]>([{ key: 1, name: '', qty: 1 }]);
  const [days, setDays] = useState(DEFAULT_BUSINESS_DAYS);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const updateRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = async () => {
    const items = rows.filter((r) => r.name.trim() && r.qty > 0);
    if (!client.trim()) return setError(he.newOrder.errClient);
    if (items.length === 0) return setError(he.newOrder.errItems);
    setError(null);
    setBusy(true);
    try {
      const order = await createOrder({
        clientName: client,
        businessDaysToDeliver: days,
        notes,
        items: items.map((r) => ({ name: r.name, quantityOrdered: r.qty, unit: 'יח׳' })),
      });
      showToast(he.newOrder.created);
      navigate(`/orders/${order.id}`, { replace: true });
    } catch {
      // The red connection banner explains what went wrong.
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ScreenHeader title={he.newOrder.title} backTo="/orders" />
      <main className="space-y-8 px-4 py-5 pb-10">
        <label className="block">
          <span className="mb-2 block text-xl font-bold text-slate-900">{he.newOrder.client}</span>
          <input
            className={inputCls}
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder={he.newOrder.clientPlaceholder}
            autoComplete="off"
          />
        </label>

        <section>
          <h2 className="mb-3 text-xl font-bold text-slate-900">{he.newOrder.items}</h2>
          <ol className="space-y-5">
            {rows.map((row, idx) => (
              <li key={row.key} className="space-y-3 rounded-3xl border-4 border-slate-200 bg-white p-4">
                <label className="block">
                  <span className="mb-1 block text-lg font-medium text-slate-700">
                    {idx + 1}. {he.newOrder.itemName}
                  </span>
                  <input className={inputCls} value={row.name} onChange={(e) => updateRow(row.key, { name: e.target.value })} autoComplete="off" />
                </label>
                <div>
                  <span className="mb-1 block text-lg font-medium text-slate-700">{he.newOrder.itemQty}</span>
                  <NumberStepper
                    value={row.qty}
                    min={1}
                    onChange={(qty) => updateRow(row.key, { qty })}
                    label={`${he.newOrder.itemQty} ${idx + 1}`}
                    plusLabel={he.missingModal.plus}
                    minusLabel={he.missingModal.minus}
                  />
                </div>
                {rows.length > 1 && (
                  <BigButton variant="neutral" onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}>
                    {he.newOrder.removeItem}
                  </BigButton>
                )}
              </li>
            ))}
          </ol>
          <BigButton
            variant="outline"
            className="mt-5"
            onClick={() => setRows((rs) => [...rs, { key: Math.max(...rs.map((r) => r.key)) + 1, name: '', qty: 1 }])}
          >
            {he.newOrder.addItem}
          </BigButton>
        </section>

        <section className="space-y-3 rounded-3xl bg-white p-4">
          <h2 className="text-xl font-bold text-slate-900">{he.newOrder.days}</h2>
          <p className="text-lg text-slate-600">{he.newOrder.daysHint}</p>
          <NumberStepper
            value={days}
            min={1}
            max={30}
            onChange={setDays}
            label={he.newOrder.days}
            plusLabel={he.missingModal.plus}
            minusLabel={he.missingModal.minus}
          />
          <p className="rounded-2xl bg-brand-soft p-4 text-xl text-brand">
            <span className="font-extrabold">{he.deadline.daysLeft(days)}</span>
          </p>
        </section>

        <label className="block">
          <span className="mb-2 block text-xl font-bold text-slate-900">{he.newOrder.notes}</span>
          <textarea
            className={`${inputCls} min-h-[120px] py-3`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-2xl bg-bad-soft p-4 text-xl font-bold text-bad-ink">
            ⚠ {error}
          </p>
        )}

        <BigButton variant="success" size="xl" disabled={busy} onClick={submit}>
          {he.newOrder.save}
        </BigButton>
      </main>
    </>
  );
}
