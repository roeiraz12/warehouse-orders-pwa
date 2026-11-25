import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { BigButton } from '../../components/ui/BigButton';
import { Modal } from '../../components/ui/Modal';
import { NumberStepper } from '../../components/ui/NumberStepper';
import { useToast } from '../../components/ui/Toast';
import { ItemRow } from '../../components/orders/ItemRow';
import { useOrder } from '../../hooks/useOrderData';
import { useOrders } from '../../store/ordersStore';
import { isActive, isChecklistComplete, progressOf } from '../../lib/orderRules';
import type { OrderItem } from '../../types';
import { he } from '../../i18n/he';
import { missingMessage, orderNumber, whatsappLink } from '../../lib/whatsapp';
import { afterSheetCloses, useGoBack } from '../../lib/backButton';

export function OrderChecklistScreen() {
  const { id } = useParams();
  const goBack = useGoBack();
  const { order, items } = useOrder(id);
  const { setItemState, touchOrder, completeOrder } = useOrders();
  const showToast = useToast((s) => s.show);

  const [missingFor, setMissingFor] = useState<OrderItem | null>(null);
  const [missingQty, setMissingQty] = useState(1);
  const [undoFor, setUndoFor] = useState<OrderItem | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!order) {
    return (
      <>
        <ScreenHeader title={he.checklist.notFound} backTo="/orders" />
        <main className="p-5 text-xl">{he.checklist.notFound}</main>
      </>
    );
  }

  const active = isActive(order);
  const p = progressOf(items);
  const complete = isChecklistComplete(items);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      // The red connection banner explains what went wrong.
    } finally {
      setBusy(false);
    }
  };

  const openMissing = (item: OrderItem) => {
    setMissingQty(item.quantityOrdered);
    setMissingFor(item);
  };

  return (
    <>
      <ScreenHeader title={he.checklist.orderTitle(orderNumber(order))} backTo="/orders" />

      <main className="space-y-3 px-3 py-3 pb-10">
        <h2 className="text-2xl font-extrabold leading-tight text-slate-900">{order.clientName}</h2>
        {order.notes && (
          <p className="rounded-xl bg-warn-soft p-3 text-base text-warn-ink">
            <span className="font-bold">{he.checklist.notes} </span>
            {order.notes}
          </p>
        )}

        {!active && (
          <p className="rounded-2xl bg-ok-soft p-4 text-xl font-bold text-ok-ink">✓ {he.checklist.alreadyDone}</p>
        )}

        {/* The grocery list */}
        <ul className="space-y-3" aria-label={he.checklist.title}>
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              disabled={!active || busy}
              onPacked={() => run(() => setItemState(item.id, 'packed'))}
              onMissing={() => openMissing(item)}
              onUndo={() => setUndoFor(item)}
            />
          ))}
        </ul>

        {active && (
          <div className="space-y-3 pt-2">
            {complete && (
              <BigButton
                variant="success"
                size="xl"
                className="min-h-[120px] text-3xl"
                icon="🚚"
                disabled={busy}
                onClick={() => setConfirmFinish(true)}
              >
                {he.checklist.finish}
              </BigButton>
            )}
            <BigButton
              variant="primary"
              size="lg"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await touchOrder(order.id);
                  showToast(he.toast.saved);
                  goBack('/orders');
                })
              }
            >
              {he.checklist.update}
            </BigButton>
          </div>
        )}
      </main>

      {/* How much is missing? */}
      <Modal open={!!missingFor} title={he.missingModal.title} onClose={() => setMissingFor(null)}>
        {missingFor && (
          <div className="space-y-5">
            <p className="text-center text-2xl font-bold text-slate-900">{missingFor.name}</p>
            <NumberStepper
              value={missingQty}
              min={1}
              max={missingFor.quantityOrdered}
              onChange={setMissingQty}
              label={he.missingModal.title}
              plusLabel={he.missingModal.plus}
              minusLabel={he.missingModal.minus}
            />
            <p className="text-center text-xl text-slate-700">{he.missingModal.of(missingFor.quantityOrdered, missingFor.unit)}</p>
            <BigButton variant="neutral" onClick={() => setMissingQty(missingFor.quantityOrdered)}>
              {he.missingModal.all}
            </BigButton>
            {/* A real link (not a script redirect) so phones open WhatsApp reliably; the save runs on the same tap. */}
            <a
              href={whatsappLink(missingMessage(order, missingFor, missingQty))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                const item = missingFor;
                setMissingFor(null);
                void run(() => setItemState(item.id, 'missing', missingQty));
              }}
              className="flex min-h-[80px] w-full items-center justify-center gap-3 rounded-2xl bg-bad px-6 text-xl font-bold text-white shadow-sm active:scale-[0.98]"
            >
              <span aria-hidden="true">💬</span>
              {he.missingModal.confirm}
            </a>
            <p className="text-center text-base text-slate-600">{he.missingModal.whatsappHint}</p>
            <BigButton variant="outline" onClick={() => setMissingFor(null)}>
              {he.missingModal.cancel}
            </BigButton>
          </div>
        )}
      </Modal>

      {/* Undo an accidental tap */}
      <Modal open={!!undoFor} title={he.undoModal.title} onClose={() => setUndoFor(null)}>
        {undoFor && (
          <div className="space-y-5">
            <p className="text-center text-xl text-slate-800">{he.undoModal.body(undoFor.name)}</p>
            <BigButton
              variant="danger"
              size="lg"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await setItemState(undoFor.id, 'pending');
                  setUndoFor(null);
                })
              }
            >
              {he.undoModal.confirm}
            </BigButton>
            <BigButton variant="outline" size="lg" onClick={() => setUndoFor(null)}>
              {he.undoModal.cancel}
            </BigButton>
          </div>
        )}
      </Modal>

      {/* Finish & move to shipping */}
      <Modal open={confirmFinish} title={he.finishModal.title} onClose={() => setConfirmFinish(false)}>
        <div className="space-y-5">
          <p className="text-center text-xl text-slate-800">{he.finishModal.body(p.packed, p.missing)}</p>
          <BigButton
            variant="success"
            size="xl"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await completeOrder(order.id);
                setConfirmFinish(false);
                showToast(he.toast.finished);
                afterSheetCloses(() => goBack('/orders'));
              })
            }
          >
            {he.finishModal.confirm}
          </BigButton>
          <BigButton variant="outline" size="lg" onClick={() => setConfirmFinish(false)}>
            {he.finishModal.cancel}
          </BigButton>
        </div>
      </Modal>
    </>
  );
}
