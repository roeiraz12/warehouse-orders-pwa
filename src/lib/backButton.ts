import { useNavigate } from 'react-router-dom';

/**
 * Makes the Android back button (and browser back) behave like an app:
 *  - an open bottom sheet closes instead of leaving the screen
 *  - in-app "Back" buttons really go back, instead of piling up new history entries
 */

type HistoryState = { idx?: number; sheet?: boolean } | null;
const state = () => window.history.state as HistoryState;

/** True when there's an earlier screen of this app to go back to (React Router stores `idx`). */
export const canGoBack = () => (state()?.idx ?? 0) > 0;

/** Back to the previous screen, or to `fallback` when the app was opened directly on this one. */
export function useGoBack() {
  const navigate = useNavigate();
  return (fallback: string) => (canGoBack() ? navigate(-1) : navigate(fallback, { replace: true }));
}

// ---- bottom sheets ----
// Opening a sheet adds a history entry for the same URL, so "back" just closes it.

let sheetOpen = false;
let closeSheetCb: (() => void) | null = null;
let ownPopPending = false;
let afterPop: (() => void)[] = [];

window.addEventListener('popstate', () => {
  if (ownPopPending) {
    // We removed the sheet's entry ourselves (sheet closed from a button).
    ownPopPending = false;
    const queued = afterPop;
    afterPop = [];
    queued.forEach((fn) => fn());
    return;
  }
  if (sheetOpen) {
    // The user pressed back while a sheet was open: close it, stay on the screen.
    sheetOpen = false;
    const cb = closeSheetCb;
    closeSheetCb = null;
    cb?.();
  }
});

export function sheetOpened(onBack: () => void) {
  closeSheetCb = onBack;
  if (sheetOpen) return;
  sheetOpen = true;
  window.history.pushState({ ...(state() ?? {}), sheet: true }, '');
}

/** The sheet was closed from code (button, backdrop, Escape): drop its history entry. */
export function sheetClosed() {
  closeSheetCb = null;
  if (!sheetOpen) return;
  sheetOpen = false;
  ownPopPending = true;
  window.history.back();
}

/** Run `fn` once any sheet's history entry is gone — use before navigating away from a sheet. */
export function afterSheetCloses(fn: () => void) {
  if (sheetOpen || ownPopPending) afterPop.push(fn);
  else fn();
}
