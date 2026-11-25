import type { RivhitClient, RivhitDocDetails, RivhitDocSummary } from '../supabase/functions/_shared/rivhit.ts';
import { formatRivhitDate } from '../supabase/functions/_shared/rivhit.ts';

/**
 * Stand-in for Rivhit Online in local development (no API token needed).
 * Returns data in the same shape as the real Document.List / Document.Details,
 * and adds a new order every few syncs so you can watch orders arrive.
 */

type Doc = RivhitDocSummary & { lines: [string, string, number][] };

const CUSTOMERS = ['מכולת השכונה – רמת גן', 'סופר כהן ובניו', 'מינימרקט הדקל', 'קיוסק יוסי', 'מעדניית גולן', 'סופר דוד'];
const PRODUCTS: [string, string][] = [
  ['1001', 'חלב 3% קרטון 1 ליטר'], ['1002', 'גבינה לבנה 5%'], ['2001', 'במבה 80 גרם'], ['2002', 'ביסלי גריל'],
  ['3001', 'קפה עלית 200 גרם'], ['3002', 'שוקולד פרה'], ['4001', 'קוקה קולה 1.5 ליטר'], ['4002', 'מים מינרליים'],
];

export function createFakeRivhit(documentType: number): RivhitClient & { calls: number } {
  let next = 5001;
  const docs: Doc[] = [];

  const addDoc = (hoursAgo: number) => {
    const at = new Date(Date.now() - hoursAgo * 3_600_000);
    const lines = Array.from({ length: 2 + (next % 3) }, (_, i) => {
      const [sku, name] = PRODUCTS[(next + i * 3) % PRODUCTS.length];
      return [sku, name, 1 + ((next + i) % 12)] as [string, string, number];
    });
    docs.push({
      document_type: documentType,
      document_number: next,
      document_date: formatRivhitDate(at),
      document_time: at.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }),
      customer_name: CUSTOMERS[next % CUSTOMERS.length],
      is_cancelled: false,
      lines,
    });
    next++;
  };

  [50, 26, 5, 1].forEach(addDoc);

  const fake = {
    calls: 0,
    async listDocuments(type: number) {
      fake.calls++;
      if (fake.calls % 3 === 0 && docs.length < 12) addDoc(0);
      return docs.filter((d) => d.document_type === type).map(({ lines: _lines, ...summary }) => summary);
    },
    async listDocumentTypes() {
      return [{ document_type: documentType, document_name: 'הזמנת לקוח' }, { document_type: 1, document_name: 'חשבונית מס' }];
    },
    async documentDetails(type: number, number: number): Promise<RivhitDocDetails> {
      const d = docs.find((x) => x.document_type === type && x.document_number === number);
      if (!d) throw new Error(`fake Rivhit: no document ${number}`);
      return {
        ...d,
        items: d.lines.map(([catalog_number, description, quantity], i) => ({ line: i + 1, catalog_number, description, quantity })),
      };
    },
  };
  return fake;
}
