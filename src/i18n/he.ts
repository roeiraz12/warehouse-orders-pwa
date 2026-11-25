/** All user-facing text lives here. */
export const he = {
  appName: 'ניהול הזמנות',

  entry: {
    title: 'ברוכים הבאים',
    subtitle: 'בחרו איך להיכנס',
    manager: 'כניסה כמנהל',
    employee: 'כניסה כעובד',
  },

  header: {
    back: 'חזרה',
    loggedInAs: 'מחובר/ת כ:',
    exit: 'יציאה',
    roleManager: 'מנהל',
    roleEmployee: 'עובד',
  },

  list: {
    title: 'הזמנות פעילות',
    empty: 'אין הזמנות פתוחות כרגע',
    emptyHint: 'כל ההזמנות טופלו. כל הכבוד!',
    newOrder: '+ הזמנה חדשה',
    progress: (done: number, total: number) => `${done} מתוך ${total} פריטים`,
    missingCount: (n: number) => (n === 1 ? 'פריט אחד חסר' : `${n} פריטים חסרים`),
    open: 'פתיחת ההזמנה',
  },

  deadline: {
    daysLeft: (n: number) =>
      n < 0
        ? n === -1 ? 'באיחור של יום אחד!' : `באיחור של ${-n} ימים!`
        : n === 0 ? 'לאספקה היום!'
        : n === 1 ? 'עוד יום אחד לאספקה'
        : `עוד ${n} ימים לאספקה`,
  },

  checklist: {
    title: 'רשימת ליקוט',
    orderTitle: (n: string) => `הזמנה ${n}`,
    qty: 'כמות:',
    packed: 'נארז',
    missing: 'חסר',
    statusPacked: 'נארז ✓',
    statusMissing: (n: number, unit?: string) => `חסר: ${n} ${unit ?? ''}`.trim(),
    update: 'שמירה וחזרה לרשימה',
    finish: 'סיום והעברה למשלוח',
    notFound: 'ההזמנה לא נמצאה',
    alreadyDone: 'ההזמנה הזו כבר הועברה למשלוח',
    notes: 'הערות:',
  },

  missingModal: {
    title: 'כמה חסר?',
    of: (total: number, unit?: string) => `מתוך ${total} ${unit ?? ''}`.trim(),
    all: 'הכל חסר',
    confirm: 'סמן כחסר ושלח בוואטסאפ',
    whatsappHint: 'תיפתח הודעה מוכנה בוואטסאפ – רק ללחוץ "שלח".',
    cancel: 'ביטול',
    plus: 'הוספה של אחד',
    minus: 'הורדה של אחד',
  },

  undoModal: {
    title: 'לבטל את הסימון?',
    body: (name: string) => `הפריט "${name}" יחזור למצב "לא נבדק".`,
    confirm: 'כן, לבטל סימון',
    cancel: 'לא, להשאיר',
  },

  finishModal: {
    title: 'לסיים את ההזמנה?',
    body: (packed: number, missing: number) =>
      missing > 0 ? `${packed} פריטים נארזו, ${missing} חסרים. המנהל כבר קיבל התראה על החוסרים.` : `כל ${packed} הפריטים נארזו.`,
    confirm: 'כן, להעביר למשלוח',
    cancel: 'עוד לא',
  },

  newOrder: {
    title: 'הזמנה חדשה',
    client: 'שם הלקוח',
    clientPlaceholder: 'לדוגמה: סופר כהן',
    items: 'פריטים בהזמנה',
    itemName: 'שם הפריט',
    itemQty: 'כמות',
    addItem: '+ הוספת פריט',
    removeItem: 'מחיקת פריט',
    days: 'ימי עסקים לאספקה',
    daysHint: 'ברירת מחדל: 3 ימי עסקים (א׳–ה׳)',
    notes: 'הערות (לא חובה)',
    save: 'יצירת ההזמנה',
    errClient: 'יש למלא שם לקוח',
    errItems: 'יש להוסיף לפחות פריט אחד עם שם וכמות',
    created: 'ההזמנה נוצרה',
  },

  manager: {
    title: 'לוח בקרה',
    attention: 'דורש תשומת לב',
    allGood: 'הכל בזמן – אין הזמנות באיחור, דחופות או עם חוסרים.',
    pipeline: 'תהליך ההזמנות',
    shortages: 'חוסרים פתוחים לפי מוצר',
    shortagesHint: 'בהזמנות שעוד לא נשלחו',
    noShortages: 'אין חוסרים פתוחים',
    inOrders: (n: number) => (n === 1 ? 'בהזמנה אחת' : `ב-${n} הזמנות`),
    notices: 'הודעות מריווחית',
    ack: 'ראיתי ✓',
    openOrder: 'לפתיחת ההזמנה',
    newOrder: '+ הזמנה חדשה',
    markShipped: 'סמן כנשלחה',
    shippedToast: 'ההזמנה סומנה כנשלחה',
    emptyFilter: 'אין הזמנות כאן כרגע',
    itemsSummary: (packed: number, missing: number) =>
      missing > 0 ? `${packed} נארזו · ${missing} חסרים` : `${packed} פריטים נארזו`,
    filters: {
      late: 'באיחור',
      soon: 'להיום / מחר',
      missing: 'עם חוסרים',
      new: 'חדשות',
      picking: 'בליקוט',
      ready: 'מוכנות למשלוח',
      shipped: 'נשלחו',
    },
    stageHints: {
      new: 'עוד לא התחילו לארוז',
      picking: 'באמצע אריזה',
      ready: 'ארוזות, מחכות למשלוח',
      shipped: 'ב-7 הימים האחרונים',
    },
    resetDemo: 'איפוס נתוני הדגמה',
    resetConfirm: 'לאפס את כל הנתונים לנתוני ההדגמה?',
  },

  code: {
    title: 'קוד העסק',
    explain: 'יש להקליד את קוד העסק. צריך לעשות את זה רק פעם אחת בכל טלפון.',
    label: 'קוד העסק',
    submit: 'כניסה',
    wrong: 'הקוד לא נכון. נסו שוב או בקשו את הקוד מהמנהל.',
    checking: 'בודק…',
  },

  connection: {
    offline: 'אין חיבור לשרת – ייתכן שהשינוי האחרון לא נשמר.',
    retry: 'לנסות שוב',
    loading: 'טוען…',
    loadFailed: 'לא הצלחנו לטעון את ההזמנות.',
  },

  sync: {
    error: 'אין חיבור לריווחית – הזמנות חדשות לא נכנסות לאפליקציה!',
    errorHint: 'יש לבדוק את מפתח ה-API של ריווחית. פרטים:',
    never: 'עדיין לא נמשכו הזמנות מריווחית.',
  },

  toast: {
    saved: 'ההזמנה נשמרה',
    finished: 'ההזמנה הועברה למשלוח',
  },
};
