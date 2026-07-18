// ── Internationalisation ────────────────────────────────────────────
// Translations for static HTML labels rendered via data-i18n attributes.
// Dynamic strings (hero title, view label, pill labels) are handled
// directly in dashboardBehavior.ts using the lang-aware closures there.

export type Lang = 'en' | 'ar';

export const LANG_KEY = 'portfolio-lang';

export function getSavedLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === 'ar' || v === 'en') return v;
  } catch { /* ignore */ }
  return 'en';
}

export function saveLang(lang: Lang) {
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
}

// All static UI strings reachable via data-i18n="key"
export const T: Record<Lang, Record<string, string>> = {
  en: {
    // Live price bar labels
    'live.gold'       : 'Gold 24K:',
    'live.xau'        : 'XAU:',
    'live.usd'        : 'USD/EGP:',
    'live.eur'        : 'EUR/EGP:',
    // API warning
    'warning.text'    : 'USD exchange rate & Gold price unavailable — using fallback estimates. Prices may be inaccurate.',
    'warning.retry'   : 'Retry',
    // Heatmap card
    'card.heatmap'    : 'Holdings Heatmap',
    'heatmap.legend'  : 'size = value · color = return',
    'heatmap.loss'    : 'Loss',
    'heatmap.gain'    : 'Gain',
    // Performance card
    'card.perf'       : 'Performance',
    'perf.breakdown'  : 'Breakdown',
    'perf.sort.hint'  : 'Tap a parameter to sort all your positions by it.',
    'perf.sort.value' : 'Market Value',
    'perf.sort.pnl'   : 'Unrealized PnL Value',
    'perf.sort.pct'   : 'Unrealized PnL %',
    'perf.sort.name'  : 'Alphabetical',
    'growth.save'     : '+ Save Snapshot',
    'perf.return.attr': 'Return Attribution',
    'perf.certs.note' : '📜 Certificates · held at face value — interest income is in the Income tab',
    // Wallet Health card
    'card.health'     : 'Wallet Health',
    'health.outof'    : 'out of 100',
    'health.diversity': 'Diversity',
    'health.ef'       : 'Emergency fund',
    'health.yield'    : 'Yield rate',
    'health.liquidity': 'Liquidity',
    // Wallet Segments card
    'card.segments'   : 'Wallet Segments',
    'seg.gold'        : 'Gold 24K',
    'seg.bareeq'      : 'Bareeq',
    'seg.re'          : 'Real Estate',
    'seg.certs'       : 'Certificates',
    // Emergency Fund card
    'card.ef'         : 'Emergency Fund · Bareeq Target',
    'ef.togo'         : 'EGP to go',
    // DCA card
    'card.dca'        : '🪙 Buy More Gold — Scenario Calculator',
    'dca.s1.title'    : 'Scenario 1 · 1 bar (5g, 24K)',
    'dca.s2.title'    : 'Scenario 2 · 2 bars of 5g (10g, 24K)',
    'dca.s3.title'    : 'Scenario 3 · 1 bar (10g, 24K)',
    'dca.s4.title'    : 'Scenario 4 · Gold Pound (21K, 8g)',
    'dca.s1.fee'      : 'Mfg fee: 87 EGP/g',
    'dca.s2.fee'      : 'Mfg fee: 87 EGP/g (5g-bar rate)',
    'dca.s3.fee'      : 'Mfg fee: 84 EGP/g (10g-bar rate)',
    'dca.s4.fee'      : 'Mfg fee: 77 EGP/g · Cashback: 24 EGP/g',
    'dca.pay'         : 'Pay',
    'dca.avg'         : 'New Average',
    'dca.pnl'         : 'Adjusted PnL',
    // Certificates section
    'certs.hero.label': 'NBE Certificates · Total Principal',
    'certs.hero.sub'  : 'Principal Balance · EGP',
    'certs.stat.count': 'Certificates',
    'certs.stat.apy'  : 'Avg APY',
    'certs.stat.annual': 'Annual Yield',
    'certs.stat.monthly': 'Monthly Yield',
    'certs.stat.soon' : 'Maturing in 90d',
    'certs.timeline'  : 'Maturity Timeline',
    'certs.byrate'    : 'By Interest Rate',
    'certs.all.label' : 'All Certificates · NBE',
    'certs.chip.all'  : 'All',
    'certs.chip.high' : '🔥 High Rate (≥20%)',
    'certs.chip.soon' : '⚠️ Due Soon',
    'certs.th.name'   : 'Certificate',
    'certs.th.value'  : 'Value',
    'certs.th.rate'   : 'Rate',
    'certs.th.maturity': 'Maturity',
    'certs.th.monthly': 'Monthly',
    // Footer
    'footer.updated'  : 'Last updated:',
    'footer.sub'      : 'Prices via open APIs · Funds: manual NAV',
    // Add data modal
    'modal.add.title' : '➕ Add Data',
    'modal.add.desc'  : 'How would you like to update your dashboard?',
    'modal.add.scan.title': 'From a screenshot',
    'modal.add.scan.desc' : 'AI reads your Thndr order or fund NAV image and updates automatically.',
    'modal.add.manual.title': 'Manually',
    'modal.add.manual.desc' : 'Enter fund NAVs and units held directly.',
    'btn.cancel'      : 'Cancel',
    // NAV editor modal
    'modal.nav.title' : '✏️ Update NAVs',
    'modal.nav.desc'  : 'Enter the latest fund NAVs from your app. Values are saved to the database and reflected everywhere. Gold holdings are derived from your recorded gold transactions, not editable here.',
    'modal.nav.abr.nav'  : 'Bareeq NAV (EGP/cert)',
    'modal.nav.abr.certs': 'Bareeq Certs held',
    'modal.nav.re.nav'   : 'Real Estate NAV',
    'modal.nav.re.certs' : 'Real Estate Certs',
    'btn.apply'       : 'Apply & Save',
    // AI Scanner drawer
    'scan.title'      : '📸 AI Scanner',
    'scan.close'      : 'Close',
    'scan.sub'        : 'Upload a screenshot and AI will read it and update your dashboard automatically.',
    'scan.mode.order.title': 'Thndr Order Confirmation',
    'scan.mode.order.desc' : 'After buying/selling ABR or BRE — reads fund, certs, NAV, amount and updates positions.',
    'scan.mode.nav.title'  : 'Fund NAV Screenshot',
    'scan.mode.nav.desc'   : 'Any fund price page — reads current NAV and updates that fund\'s price.',
    'scan.upload'     : '📁 Tap to choose screenshot',
    'scan.result.title': 'Extracted Data',
    'scan.apply'      : 'Apply to Dashboard',
    'scan.key.notset' : 'API Key: not set',
    'scan.setkey'     : '⚙️ Set API Key',
    // API key modal
    'apikey.title'    : '🔑 Gemini API Key',
    'apikey.desc'     : "This key is stored only in your browser (localStorage) and never sent anywhere except Google's API.",
    'apikey.label'    : 'Gemini API Key',
    'apikey.save'     : 'Save Key',
    // Insights drawer
    'insights.title'  : 'ℹ️ Cross-Card Intelligence',
    'insights.close'  : 'Close',
  },

  ar: {
    // Live price bar labels
    'live.gold'       : 'ذهب 24ق:',
    'live.xau'        : 'XAU:',
    'live.usd'        : 'دولار/ج.م:',
    'live.eur'        : 'يورو/ج.م:',
    // API warning
    'warning.text'    : 'سعر صرف الدولار وسعر الذهب غير متاحَين — يتم استخدام تقديرات احتياطية. قد تكون الأسعار غير دقيقة.',
    'warning.retry'   : 'إعادة المحاولة',
    // Heatmap card
    'card.heatmap'    : 'خريطة الحيازات',
    'heatmap.legend'  : 'الحجم = القيمة · اللون = العائد',
    'heatmap.loss'    : 'خسارة',
    'heatmap.gain'    : 'ربح',
    // Performance card
    'card.perf'       : 'الأداء',
    'perf.breakdown'  : 'التفاصيل',
    'perf.sort.hint'  : 'اضغط على معيار لترتيب مراكزك به.',
    'perf.sort.value' : 'القيمة السوقية',
    'perf.sort.pnl'   : 'قيمة الربح / الخسارة',
    'perf.sort.pct'   : 'نسبة الربح / الخسارة %',
    'perf.sort.name'  : 'أبجدي',
    'growth.save'     : '+ حفظ لقطة',
    'perf.return.attr': 'توزيع العوائد',
    'perf.certs.note' : '📜 الشهادات · محتفظ بها بالقيمة الاسمية — دخل الفوائد في تبويب الدخل',
    // Wallet Health card
    'card.health'     : 'صحة المحفظة',
    'health.outof'    : 'من 100',
    'health.diversity': 'التنوع',
    'health.ef'       : 'صندوق الطوارئ',
    'health.yield'    : 'معدل العائد',
    'health.liquidity': 'السيولة',
    // Wallet Segments card
    'card.segments'   : 'أقسام المحفظة',
    'seg.gold'        : 'ذهب 24ق',
    'seg.bareeq'      : 'بريق',
    'seg.re'          : 'عقارات',
    'seg.certs'       : 'شهادات',
    // Emergency Fund card
    'card.ef'         : 'صندوق الطوارئ · هدف بريق',
    'ef.togo'         : 'ج.م متبقية',
    // DCA card
    'card.dca'        : '🪙 شراء مزيد من الذهب — حاسبة سيناريوهات',
    'dca.s1.title'    : 'السيناريو 1 · سبيكة (5 جم، 24ق)',
    'dca.s2.title'    : 'السيناريو 2 · سبيكتان 5 جم (10 جم، 24ق)',
    'dca.s3.title'    : 'السيناريو 3 · سبيكة (10 جم، 24ق)',
    'dca.s4.title'    : 'السيناريو 4 · جنيه ذهب (21ق، 8 جم)',
    'dca.s1.fee'      : 'رسوم تصنيع: 87 ج.م/جم',
    'dca.s2.fee'      : 'رسوم تصنيع: 87 ج.م/جم (سعر سبيكة 5 جم)',
    'dca.s3.fee'      : 'رسوم تصنيع: 84 ج.م/جم (سعر سبيكة 10 جم)',
    'dca.s4.fee'      : 'رسوم تصنيع: 77 ج.م/جم · استرداد: 24 ج.م/جم',
    'dca.pay'         : 'ادفع',
    'dca.avg'         : 'متوسط جديد',
    'dca.pnl'         : 'ر/خ معدّل',
    // Certificates section
    'certs.hero.label': 'شهادات بنك مصر · إجمالي رأس المال',
    'certs.hero.sub'  : 'رصيد رأس المال · ج.م',
    'certs.stat.count': 'الشهادات',
    'certs.stat.apy'  : 'متوسط العائد',
    'certs.stat.annual': 'العائد السنوي',
    'certs.stat.monthly': 'العائد الشهري',
    'certs.stat.soon' : 'تستحق خلال 90 يوم',
    'certs.timeline'  : 'جدول الاستحقاق',
    'certs.byrate'    : 'حسب معدل الفائدة',
    'certs.all.label' : 'جميع الشهادات · بنك مصر',
    'certs.chip.all'  : 'الكل',
    'certs.chip.high' : '🔥 عائد مرتفع (≥20%)',
    'certs.chip.soon' : '⚠️ تستحق قريباً',
    'certs.th.name'   : 'الشهادة',
    'certs.th.value'  : 'القيمة',
    'certs.th.rate'   : 'المعدل',
    'certs.th.maturity': 'الاستحقاق',
    'certs.th.monthly': 'شهري',
    // Footer
    'footer.updated'  : 'آخر تحديث:',
    'footer.sub'      : 'الأسعار عبر APIs مفتوحة · الصناديق: NAV يدوي',
    // Add data modal
    'modal.add.title' : '➕ إضافة بيانات',
    'modal.add.desc'  : 'كيف تريد تحديث لوحتك؟',
    'modal.add.scan.title': 'من لقطة شاشة',
    'modal.add.scan.desc' : 'الذكاء الاصطناعي يقرأ طلبك في ثاندر أو NAV الصندوق ويحدّث تلقائياً.',
    'modal.add.manual.title': 'يدوياً',
    'modal.add.manual.desc' : 'أدخل NAV الصناديق وعدد الوحدات مباشرة.',
    'btn.cancel'      : 'إلغاء',
    // NAV editor modal
    'modal.nav.title' : '✏️ تحديث NAVs',
    'modal.nav.desc'  : 'أدخل أحدث NAV للصناديق من تطبيقك. تُحفظ القيم في قاعدة البيانات وتظهر في كل مكان. حيازات الذهب مشتقة من معاملاتك المسجلة وغير قابلة للتعديل هنا.',
    'modal.nav.abr.nav'  : 'NAV بريق (ج.م/وحدة)',
    'modal.nav.abr.certs': 'وحدات بريق المحتازة',
    'modal.nav.re.nav'   : 'NAV العقارات',
    'modal.nav.re.certs' : 'وحدات العقارات المحتازة',
    'btn.apply'       : 'تطبيق وحفظ',
    // AI Scanner drawer
    'scan.title'      : '📸 الماسح بالذكاء الاصطناعي',
    'scan.close'      : 'إغلاق',
    'scan.sub'        : 'ارفع لقطة شاشة وسيقرأها الذكاء الاصطناعي ويحدّث لوحتك تلقائياً.',
    'scan.mode.order.title': 'تأكيد طلب ثاندر',
    'scan.mode.order.desc' : 'بعد شراء/بيع ABR أو BRE — يقرأ الصندوق والوحدات وNAV والمبلغ ويحدّث المراكز.',
    'scan.mode.nav.title'  : 'لقطة NAV الصندوق',
    'scan.mode.nav.desc'   : 'أي صفحة سعر صندوق — يقرأ NAV الحالي ويحدّث سعر ذلك الصندوق.',
    'scan.upload'     : '📁 اضغط لاختيار لقطة شاشة',
    'scan.result.title': 'البيانات المستخرجة',
    'scan.apply'      : 'تطبيق على اللوحة',
    'scan.key.notset' : 'مفتاح API: غير مضبوط',
    'scan.setkey'     : '⚙️ ضبط مفتاح API',
    // API key modal
    'apikey.title'    : '🔑 مفتاح Gemini API',
    'apikey.desc'     : 'يُخزَّن هذا المفتاح في متصفحك فقط (localStorage) ولا يُرسَل إلى أي جهة سوى API جوجل.',
    'apikey.label'    : 'مفتاح Gemini API',
    'apikey.save'     : 'حفظ المفتاح',
    // Insights drawer
    'insights.title'  : 'ℹ️ تحليل شامل للمحفظة',
    'insights.close'  : 'إغلاق',
  },
};
