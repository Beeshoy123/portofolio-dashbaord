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
    'settings.logout' : 'Log out',
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
    // Gold hero stat row
    'gold.stat.avg'   : 'Avg Cost',
    'gold.stat.grams' : 'Grams Held',
    'gold.stat.holding': 'Holding Cost',
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
    // AI Scanner drawer
    'scan.title'      : '📸 AI Scanner',
    'scan.close'      : 'Close',
    'scan.sub'        : 'Upload a screenshot and AI will read it and update your dashboard automatically.',
    'scan.mode.order.title': 'Thndr Order Confirmation',
    'scan.mode.order.desc' : 'After buying/selling ABR or BRE — reads fund, certs, NAV, amount and updates positions.',
    'scan.mode.nav.title'  : 'Fund NAV Screenshot',
    'scan.mode.nav.desc'   : 'Any fund price page — reads current NAV and updates that fund\'s price.',
    'scan.mode.orderslist.title': 'Orders List',
    'scan.mode.orderslist.desc' : 'Screenshots containing multiple executed orders — extracts a table of rows for review and import.',
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
    // Growth view
    'growth.label'    : 'Savings Growth · Month over Month',
    // Total Capital view
    'perf.vs'         : 'vs',
    'perf.deployed'   : 'deployed',
    'perf.income.breakdown': 'Income Breakdown',
    // Attribution bar labels
    'attr.gold'       : 'Gold',
    'attr.price.pending': 'live price pending',
    'attr.liquid'     : 'EG Stock',
    'attr.liquid.sub' : 'Bareeq + Real Est.',
    'attr.bareeq'     : 'Bareeq',
    'attr.certs'      : 'Certs',
    // Wallet Segments
    'seg.assets'      : 'assets',
    // Emergency fund note
    'ef.note.prefix'  : 'Yield only: ~',
    'ef.note.suffix'  : 'months · add monthly deposits to go faster',
    // Math labels (ml.*)
    'ml.sell.price'   : 'Sell Price:',
    'ml.curr.value'   : 'Current Value:',
    'ml.cost.basis'   : 'Cost Basis:',
    'ml.raw.pnl'      : 'Raw PnL:',
    'ml.sell.cashback': 'Sell Cashback:',
    'ml.net.pnl'      : 'Net PnL:',
    'ml.bareeq'       : 'Bareeq:',
    'ml.bareeq.pnl'   : 'Bareeq PnL:',
    'ml.re'           : 'Real Est.:',
    'ml.re.pnl'       : 'Real Est. PnL:',
    'ml.nbe.certs'    : 'NBE Certs:',
    'ml.total.yield'  : 'Total Yield:',
    'ml.gold.pnl'     : 'Gold PnL:',
    'ml.liquid.pnl'   : 'EG Stock PnL:',
    'ml.total.cap.pnl': 'Total Capital PnL:',
    'ml.monthly.income': 'Monthly Income:',
    'ml.annual.income': 'Annual Income:',
    'ml.blended.yield': 'Blended Yield:',
    'ml.diversity'    : 'Diversity:',
    'ml.emergency.fund': 'Emergency Fund:',
    'ml.yield.rate'   : 'Yield Rate:',
    'ml.liquidity'    : 'Liquidity:',
    'ml.average'      : 'Average:',
    'ml.total.principal': 'Total Principal:',
    'ml.avg.apy'      : 'Avg APY:',
    'ml.annual.yield' : 'Annual Yield:',
    'ml.monthly.yield': 'Monthly yield:',
    // Math calc descriptions (mc.*)
    'mc.val.minus.cost'    : 'value − cost',
    'mc.val.cb.minus.cost' : '(value + cashback) − cost',
    'mc.bareeq.re.combined': 'Bareeq + Real Est. combined',
    'mc.gold.plus.liquid'  : 'gold + EG Stock',
    'mc.times.12'          : '× 12',
    'mc.annual.div.total'  : 'annual income ÷ total wallet',
    'mc.annual.div.12'     : 'annual ÷ 12',
    'mc.refunded.on.sell'  : 'added on sell, not cost basis',
    'mc.gold.conc'         : 'gold conc.',
    'mc.blended.benchmark' : 'blended ÷ 27% benchmark',
    'mc.liquid.div.total'  : 'EG Stock ÷',
    'mc.total.word'        : 'total',
    'mc.certificates'      : 'certificates',
    // Hero card
    'hero.market.value'   : 'Market Value:',
    'hero.net.pnl'        : 'net PnL',
    // Cohort analysis
    'card.cohort.gold'    : '📊 Cohort Analysis · Gold Purchases',
    'card.cohort.batches' : '📊 Cohort Analysis · Buy Batches',
    'cohort.empty'        : 'No gold transactions recorded yet.',
    'cohort.fund.profit.formula': 'Profit = (Units × Current NAV) − Invested',
    // Income view sub-labels
    'perf.weighted.avg'   : 'weighted avg',
    'perf.blended.on.total': 'blended annual yield on total wallet',
    // Wallet Segment row details
    'seg.avg.cost'        : 'Avg cost',
    'seg.mkt'             : 'Mkt',
    'seg.vs.cost'         : 'vs cost',
    'seg.certs.at'        : 'certs @',
    'seg.bareeq.fund'     : 'Bareeq Fund',
    'seg.beltone.re'      : 'Beltone Real Estate',
    'seg.nbe.certs'       : 'NBE Certificates',
    'seg.nbe.certs.avg'   : 'NBE certs · avg',
    // heroMath labels
    'ml.combined.nav'     : 'Combined NAV:',
    'ml.total.value'      : 'Total Value:',
    'ml.total.cost'       : 'Total Cost:',
    'ml.pnl'              : 'PnL:',
    'ml.certificates.label': 'Certificates:',
    'ml.gold.live.price'  : 'Gold 24K (live sell price):',
    'ml.gold.at.cost'     : 'Gold (at cost, live price pending):',
    // heroMath calc/result additions
    'mc.mfg.fee.incl'     : 'mfg fee incl.',
    'mc.mfg.fee.paid'     : 'mfg fee included, paid at purchase',
    'mc.refunded.sell.full': 'refunded on sell, added to value — not the cost basis',
    'mc.live.price.unavail': 'Live gold price unavailable — feature in development',
    'mc.pnl.unavail'      : 'PnL unavailable — live price feature in development',
    // Health grade
    'health.grade.excellent': 'Excellent',
    'health.grade.good'   : 'Good',
    'health.grade.attention': 'Needs attention',
    'health.grade.risk'   : 'At risk',
    // Sort labels
    'sort.by.value'       : 'By Value',
    'sort.by.pnl'         : 'By PnL',
    'sort.by.pct'         : 'By %',
    'sort.by.name'        : 'By Name',
    'sort.default'        : 'Default',
    // Performance avg-vs-sell
    'perf.my.avg'         : 'My Avg:',
    'perf.vs.sell.cb'     : 'vs Sell+Cashback:',
    'perf.funds.only'     : 'funds only',
    // DCA avg drop/rise
    'dca.avg.drops'       : 'drops',
    'dca.avg.rises'       : 'rises',
    'dca.avg.unit'        : 'EGP/pure-g from current avg',
    // DCA notes
    'dca.note.waiting'    : '⚠️ Waiting for live gold prices from goldbullioneg.com — scenarios will appear once the first scrape completes.',
    'dca.note.live'       : 'ℹ️ Prices from goldbullioneg.com (live, auto-refreshed every 5 min). Manufacturing fees and cashback from the fixed dealer fee schedule.',
    // Insights timestamp
    'insights.generated'  : 'Generated:',
    // Saving button
    'btn.saving'          : 'Saving…',
    'btn.apply'           : 'Apply & Save',
    // Hero chg line parts
    'hero.chg.mkt.value'  : 'Market Value:',
    'hero.chg.net.pnl'    : 'net PnL',
    'hero.chg.cashback'   : '+ cashback',
    'hero.chg.avg.apy'    : 'avg APY',
    'hero.pnl.unavail.dev': 'PnL unavailable — live price feature in development',
    // Performance card headlines
    'perf.net.word'       : 'net',
    'perf.egp.net'        : 'EGP net',
    'perf.pnl.unavail.short': 'PnL unavailable',
    // Performance PnL sub-label parts
    'perf.pnl.raw'        : 'raw',
    'perf.pnl.cb.on.sell' : 'cashback on sell',
    'perf.pnl.cb.rate'    : 'Cashback rate on file:',
    'perf.pnl.applied'    : '(applied on sell)',
    // PnL row sub descriptions
    'pnl.sub.physical'    : 'physical',
    'pnl.sub.fixed.income': 'Fixed Income',
    'pnl.sub.nav'         : 'NAV',
    'pnl.sub.apy'         : 'APY',
    'pnl.sub.equity'      : 'Equity Fund',
    'pnl.sub.nbe.income'  : 'NBE · interest income',
    // Gold PnL row meta
    'pnl.gold.sell.cb'    : '(sell + cashback)',
    'pnl.gold.pending'    : 'live price pending',
    // heroMath calc strings
    'mc.live.price.label' : 'live price',
    'mc.certs.avg.apy'    : 'certs · avg',
    'mc.apy.label'        : 'APY',
    // DCA avg unit
    'unit.egp.per.pure.g' : 'EGP/pure-g',
    // Cert display
    'cert.badge.soon'     : 'Soon',
    'cert.days.left'      : 'd left',
    'cert.more.suffix'    : 'more certificates',
    'cert.count.single'   : 'certificate',
    'cert.count.plural'   : 'certificates',
    'cert.avg.apy.prefix' : 'Avg',
    'cert.maturing.unit'  : 'certs',
    // EF % of target
    'ef.of.target'        : 'of',
    // Cohort table headers — gold
    'cohort.th.cohort'    : 'Cohort',
    'cohort.th.date'      : 'Date',
    'cohort.th.paid'      : 'Paid (EGP)',
    'cohort.th.weight'    : 'Weight',
    'cohort.th.bar.karat' : 'Bar / Karat',
    'cohort.th.avg.cost'  : 'Avg Cost/g',
    'cohort.th.curr.value': 'Current Value (EGP)',
    'cohort.th.profit.cb' : 'Profit incl. Cashback',
    'cohort.th.return'    : 'Return (%)',
    // Cohort table headers — fund
    'cohort.th.invested'  : 'Invested (EGP)',
    'cohort.th.units'     : 'Units',
    'cohort.th.avg.unit'  : 'Avg. Cost/Unit',
    'cohort.th.profit'    : 'Profit (EGP)',
    // Cohort shared
    'cohort.total'        : 'Total',
    'cohort.live.pending' : 'live pending',
    'cohort.no.buys'      : 'No buy transactions recorded yet.',
    'cohort.price.pending': '⏳ Live sell price pending — goldbullioneg.com scrape in progress',
    'cohort.sell.prefix'  : 'Sell:',
    'cohort.cashback.prefix': 'Cashback:',
    'cohort.profit.formula': 'Profit = (Value + Cashback) − Paid',
    'cohort.fund.abr.note': 'Fixed Income · Accrual — NAV grows daily, no yield harvest',
    'cohort.fund.re.note' : 'Equity Fund · NAV Volatility — avg cost basis',
    // Scanner UI
    'scan.err.no.key'     : 'Please set your Gemini API key first (⚙️ Set API Key below).',
    'scan.err.no.mode'    : 'Please select a scan mode (Order Confirmation or Fund NAV) first.',
    'scan.err.no.fund'    : 'Could not identify the fund (ABR or RE). Try uploading a clearer screenshot.',
    'scan.err.no.rows'    : 'No order rows were detected in the screenshot. Try a clearer image or a different crop.',
    'scan.err.failed'     : 'Scan failed. Please try again.',
    'scan.err.save.fail'  : 'Failed to save:',
    'scan.result.fund'    : 'Fund',
    'scan.result.nav'     : 'NAV',
    'scan.result.units'   : 'Units Held',
    // AI Insights view
    'ai.title'            : 'AI Insights',
    'ai.subtitle'         : 'Automated analysis of your portfolio health and allocation',
    'ai.state.ready'      : 'Ready',
    'ai.state.waiting'    : 'Waiting',
    'ai.state.fetching'   : 'Fetching',
    'ai.state.running'    : 'Running…',
    'ai.state.completed'  : 'Completed',
    'ai.state.failed'     : 'Failed',
    'ai.waiting_refresh'  : 'Waiting for first refresh',
    'ai.refresh_prices'   : 'Refresh prices',
    'ai.stage.prices'     : '1. Prices',
    'ai.stage.chart_reader': '2. Chart Reader',
    'ai.stage.judge'      : '3. Comparison Judge',
    'ai.stage.alerts'     : '4. Alerts',
    'ai.stage.advisor'    : '5. Advisor',
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
    'settings.logout' : 'تسجيل الخروج',
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
    // Gold hero stat row
    'gold.stat.avg'   : 'متوسط التكلفة',
    'gold.stat.grams' : 'الجرامات المحتجزة',
    'gold.stat.holding': 'تكلفة الحيازة',
    // Certificates section
    'certs.hero.label': 'شهادات البنك الأهلي · إجمالي رأس المال',
    'certs.hero.sub'  : 'رصيد رأس المال · ج.م',
    'certs.stat.count': 'الشهادات',
    'certs.stat.apy'  : 'متوسط العائد',
    'certs.stat.annual': 'العائد السنوي',
    'certs.stat.monthly': 'العائد الشهري',
    'certs.stat.soon' : 'تستحق خلال 90 يوم',
    'certs.timeline'  : 'جدول الاستحقاق',
    'certs.byrate'    : 'حسب معدل الفائدة',
    'certs.all.label' : 'جميع الشهادات · البنك الأهلي',
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
    // Growth view
    'growth.label'    : 'نمو المدخرات · شهر بشهر',
    // Total Capital view
    'perf.vs'         : 'مقابل',
    'perf.deployed'   : 'مستثمر',
    'perf.income.breakdown': 'توزيع الدخل',
    // Attribution bar labels
    'attr.gold'       : 'ذهب',
    'attr.price.pending': 'السعر الحي معلق',
    'attr.liquid'     : 'سهم مصري',
    'attr.liquid.sub' : 'بريق + عقارات',
    'attr.bareeq'     : 'بريق',
    'attr.certs'      : 'شهادات',
    // Wallet Segments
    'seg.assets'      : 'أصول',
    // Emergency fund note
    'ef.note.prefix'  : 'عائد فقط: ~',
    'ef.note.suffix'  : 'شهر · أضف إيداعات شهرية لتسريع الوصول',
    // Math labels (ml.*)
    'ml.sell.price'   : 'سعر البيع:',
    'ml.curr.value'   : 'القيمة الحالية:',
    'ml.cost.basis'   : 'تكلفة الشراء:',
    'ml.raw.pnl'      : 'ر/خ الأساسي:',
    'ml.sell.cashback': 'استرداد البيع:',
    'ml.net.pnl'      : 'صافي ر/خ:',
    'ml.bareeq'       : 'بريق:',
    'ml.bareeq.pnl'   : 'ر/خ بريق:',
    'ml.re'           : 'عقارات:',
    'ml.re.pnl'       : 'ر/خ العقارات:',
    'ml.nbe.certs'    : 'شهادات البنك الأهلي:',
    'ml.total.yield'  : 'إجمالي العائد:',
    'ml.gold.pnl'     : 'ر/خ الذهب:',
    'ml.liquid.pnl'   : 'ر/خ سهم مصري:',
    'ml.total.cap.pnl': 'إجمالي ر/خ رأس المال:',
    'ml.monthly.income': 'الدخل الشهري:',
    'ml.annual.income': 'الدخل السنوي:',
    'ml.blended.yield': 'العائد المدمج:',
    'ml.diversity'    : 'التنوع:',
    'ml.emergency.fund': 'صندوق الطوارئ:',
    'ml.yield.rate'   : 'معدل العائد:',
    'ml.liquidity'    : 'السيولة:',
    'ml.average'      : 'المتوسط:',
    'ml.total.principal': 'إجمالي رأس المال:',
    'ml.avg.apy'      : 'متوسط العائد:',
    'ml.annual.yield' : 'العائد السنوي:',
    'ml.monthly.yield': 'العائد الشهري:',
    // Math calc descriptions (mc.*)
    'mc.val.minus.cost'    : 'القيمة − التكلفة',
    'mc.val.cb.minus.cost' : '(القيمة + الاسترداد) − التكلفة',
    'mc.bareeq.re.combined': 'بريق + عقارات مجتمعين',
    'mc.gold.plus.liquid'  : 'ذهب + سائل',
    'mc.times.12'          : '× 12',
    'mc.annual.div.total'  : 'الدخل السنوي ÷ إجمالي المحفظة',
    'mc.annual.div.12'     : 'سنوي ÷ 12',
    'mc.refunded.on.sell'  : 'يُضاف عند البيع، ليس في التكلفة',
    'mc.gold.conc'         : 'تركيز الذهب.',
    'mc.blended.benchmark' : 'مدمج ÷ معيار 27%',
    'mc.liquid.div.total'  : 'سائل ÷',
    'mc.total.word'        : 'إجمالي',
    'mc.certificates'      : 'شهادات',
    // Hero card
    'hero.market.value'   : 'القيمة السوقية:',
    'hero.net.pnl'        : 'صافي ر/خ',
    // Cohort analysis
    'card.cohort.gold'    : '📊 تحليل الدفعات · مشتريات الذهب',
    'card.cohort.batches' : '📊 تحليل الدفعات · دفعات الشراء',
    'cohort.empty'        : 'لا توجد معاملات ذهب مسجلة بعد.',
    'cohort.fund.profit.formula': 'الربح = (الوحدات × NAV الحالي) − المستثمر',
    // Income view sub-labels
    'perf.weighted.avg'   : 'متوسط مرجح',
    'perf.blended.on.total': 'عائد سنوي مدمج على إجمالي المحفظة',
    // Wallet Segment row details
    'seg.avg.cost'        : 'متوسط التكلفة',
    'seg.mkt'             : 'سوق',
    'seg.vs.cost'         : 'مقابل التكلفة',
    'seg.certs.at'        : 'وحدة بـ',
    'seg.bareeq.fund'     : 'صندوق بريق',
    'seg.beltone.re'      : 'بلتون عقارات',
    'seg.nbe.certs'       : 'شهادات البنك الأهلي',
    'seg.nbe.certs.avg'   : 'شهادة · متوسط',
    // heroMath labels
    'ml.combined.nav'     : 'NAV المجمع:',
    'ml.total.value'      : 'إجمالي القيمة:',
    'ml.total.cost'       : 'إجمالي التكلفة:',
    'ml.pnl'              : 'ر/خ:',
    'ml.certificates.label': 'شهادات:',
    'ml.gold.live.price'  : 'ذهب 24ق (سعر البيع الحي):',
    'ml.gold.at.cost'     : 'ذهب (بالتكلفة، السعر معلق):',
    // heroMath calc/result additions
    'mc.mfg.fee.incl'     : 'شامل رسوم التصنيع',
    'mc.mfg.fee.paid'     : 'رسوم التصنيع مشمولة، مدفوعة عند الشراء',
    'mc.refunded.sell.full': 'يُسترد عند البيع، يُضاف للقيمة — ليس في التكلفة',
    'mc.live.price.unavail': 'سعر الذهب الحي غير متاح — الميزة قيد التطوير',
    'mc.pnl.unavail'      : 'ر/خ غير متاح — السعر الحي قيد التطوير',
    // Health grade
    'health.grade.excellent': 'ممتاز',
    'health.grade.good'   : 'جيد',
    'health.grade.attention': 'يحتاج اهتمام',
    'health.grade.risk'   : 'في خطر',
    // Sort labels
    'sort.by.value'       : 'حسب القيمة',
    'sort.by.pnl'         : 'حسب ر/خ',
    'sort.by.pct'         : 'حسب النسبة',
    'sort.by.name'        : 'حسب الاسم',
    'sort.default'        : 'افتراضي',
    // Performance avg-vs-sell
    'perf.my.avg'         : 'متوسطي:',
    'perf.vs.sell.cb'     : 'مقابل البيع+الاسترداد:',
    'perf.funds.only'     : 'صناديق فقط',
    // DCA avg drop/rise
    'dca.avg.drops'       : 'ينخفض',
    'dca.avg.rises'       : 'يرتفع',
    'dca.avg.unit'        : 'ج.م/جم نقي عن المتوسط',
    // DCA notes
    'dca.note.waiting'    : '⚠️ في انتظار أسعار الذهب الحية من goldbullioneg.com — ستظهر السيناريوهات بعد أول عملية مسح.',
    'dca.note.live'       : 'ℹ️ الأسعار من goldbullioneg.com (حية، تتجدد كل 5 دقائق). رسوم التصنيع والاسترداد من جدول رسوم الموزع الثابت.',
    // Insights timestamp
    'insights.generated'  : 'تم الإنشاء:',
    // Saving button
    'btn.saving'          : 'جارٍ الحفظ…',
    'btn.apply'           : 'تطبيق وحفظ',
    // Hero chg line parts
    'hero.chg.mkt.value'  : 'القيمة السوقية:',
    'hero.chg.net.pnl'    : 'ر/خ صافي',
    'hero.chg.cashback'   : '+ استرداد',
    'hero.chg.avg.apy'    : 'متوسط العائد',
    'hero.pnl.unavail.dev': 'ر/خ غير متاح — ميزة السعر الحي قيد التطوير',
    // Performance card headlines
    'perf.net.word'       : 'صافي',
    'perf.egp.net'        : 'ج.م صافي',
    'perf.pnl.unavail.short': 'ر/خ غير متاح',
    // Performance PnL sub-label parts
    'perf.pnl.raw'        : 'خام',
    'perf.pnl.cb.on.sell' : 'استرداد عند البيع',
    'perf.pnl.cb.rate'    : 'معدل الاسترداد المسجل:',
    'perf.pnl.applied'    : '(يُطبَّق عند البيع)',
    // PnL row sub descriptions
    'pnl.sub.physical'    : 'مادي',
    'pnl.sub.fixed.income': 'دخل ثابت',
    'pnl.sub.nav'         : 'NAV',
    'pnl.sub.apy'         : 'عائد سنوي',
    'pnl.sub.equity'      : 'صندوق أسهم',
    'pnl.sub.nbe.income'  : 'شهادات · دخل ثابت',
    // Gold PnL row meta
    'pnl.gold.sell.cb'    : '(بيع + استرداد)',
    'pnl.gold.pending'    : 'السعر الحي معلق',
    // heroMath calc strings
    'mc.live.price.label' : 'السعر الحي',
    'mc.certs.avg.apy'    : 'شهادة · متوسط',
    'mc.apy.label'        : 'عائد',
    // DCA avg unit
    'unit.egp.per.pure.g' : 'ج.م/جم نقي',
    // Cert display
    'cert.badge.soon'     : 'قريباً',
    'cert.days.left'      : 'يوم متبقي',
    'cert.more.suffix'    : 'شهادات أخرى',
    'cert.count.single'   : 'شهادة',
    'cert.count.plural'   : 'شهادات',
    'cert.avg.apy.prefix' : 'متوسط',
    'cert.maturing.unit'  : 'شهادة',
    // EF % of target
    'ef.of.target'        : 'من',
    // Cohort table headers — gold
    'cohort.th.cohort'    : 'دفعة',
    'cohort.th.date'      : 'التاريخ',
    'cohort.th.paid'      : 'المدفوع (ج.م)',
    'cohort.th.weight'    : 'الوزن',
    'cohort.th.bar.karat' : 'سبيكة / قيراط',
    'cohort.th.avg.cost'  : 'متوسط التكلفة/جم',
    'cohort.th.curr.value': 'القيمة الحالية (ج.م)',
    'cohort.th.profit.cb' : 'الربح شامل الاسترداد',
    'cohort.th.return'    : 'العائد (%)',
    // Cohort table headers — fund
    'cohort.th.invested'  : 'المستثمر (ج.م)',
    'cohort.th.units'     : 'وحدات',
    'cohort.th.avg.unit'  : 'متوسط التكلفة/وحدة',
    'cohort.th.profit'    : 'الربح (ج.م)',
    // Cohort shared
    'cohort.total'        : 'الإجمالي',
    'cohort.live.pending' : 'السعر معلق',
    'cohort.no.buys'      : 'لا توجد معاملات شراء مسجلة بعد.',
    'cohort.price.pending': '⏳ السعر الحي معلق — scrape goldbullioneg.com قيد التشغيل',
    'cohort.sell.prefix'  : 'بيع:',
    'cohort.cashback.prefix': 'استرداد:',
    'cohort.profit.formula': 'الربح = (القيمة + الاسترداد) − المدفوع',
    'cohort.fund.abr.note': 'دخل ثابت · تراكمي — NAV يرتفع يومياً، بلا توزيعات',
    'cohort.fund.re.note' : 'صندوق أسهم · تذبذب NAV — متوسط التكلفة',
    // Scanner UI
    'scan.err.no.key'     : 'يرجى تعيين مفتاح Gemini API أولاً (⚙️ تعيين مفتاح API أدناه).',
    'scan.err.no.mode'    : 'يرجى اختيار وضع المسح (تأكيد الطلب أو NAV الصندوق) أولاً.',
    'scan.err.no.fund'    : 'تعذّر التعرف على الصندوق (ABR أو RE). جرّب رفع لقطة شاشة أوضح.',
    'scan.mode.orderslist.title': 'قائمة الصفقات',
    'scan.mode.orderslist.desc' : 'لقطات تحتوي على صفقات متعددة — يستخرج صفوف جدول للمراجعة والاستيراد.',
    'scan.err.no.rows'    : 'لم تُكتشف أي صفوف صفقات في لقطة الشاشة. جرّب صورة أو قصًّا أوضح.',
    'scan.err.failed'     : 'فشل المسح. حاول مجدداً.',
    'scan.err.save.fail'  : 'فشل الحفظ:',
    'scan.result.fund'    : 'الصندوق',
    'scan.result.nav'     : 'NAV',
    'scan.result.units'   : 'الوحدات المحتفظ بها',
    'scan.btn.applying'   : 'جارٍ التطبيق…',
    'scan.btn.apply.dash' : 'تطبيق على لوحة التحكم',
    'scan.key.set'        : 'مفتاح API: مُعيَّن ✓',
    // AI Insights view
    'ai.title'            : 'رؤى الذكاء الاصطناعي',
    'ai.subtitle'         : 'تحليل آلي لصحة المحفظة وتوزيع الأصول',
    'ai.state.ready'      : 'جاهز',
    'ai.state.waiting'    : 'في الانتظار',
    'ai.state.fetching'   : 'جارٍ الجلب',
    'ai.state.running'    : 'جارٍ التشغيل…',
    'ai.state.completed'  : 'مكتمل',
    'ai.state.failed'     : 'فشل',
    'ai.waiting_refresh'  : 'في انتظار التحديث الأول',
    'ai.refresh_prices'   : 'تحديث الأسعار',
    'ai.stage.prices'     : '١. الأسعار',
    'ai.stage.chart_reader': '٢. قارئ الرسم البياني',
    'ai.stage.judge'      : '٣. حكم المقارنة',
    'ai.stage.alerts'     : '٤. التنبيهات',
    'ai.stage.advisor'    : '٥. المستشار',
  },
};

// ── Entity, Sector & Asset Class Localization ─────────────────────────────

export const ENTITY_NAME_MAP: Record<string, { en: string; ar: string }> = {
  // Funds (CI Capital)
  'CEX': { en: 'CI Exporters Fund', ar: 'صندوق سي آي للمصدرين' },
  'CTI': { en: 'CI Telecoms & IT Fund', ar: 'صندوق سي آي للاتصالات وتكنولوجيا المعلومات' },
  'CRE': { en: 'CI Real Estate Fund', ar: 'صندوق سي آي العقاري' },
  'CFF': { en: 'CI Financial & Fintech Fund', ar: 'صندوق سي آي للخدمات المالية والتكنولوجيا المالية' },
  'CCB': { en: 'CI Consumer & Basic Needs Fund', ar: 'صندوق سي آي للاستهلاك والاحتياجات الأساسية' },
  'CMS': { en: 'Misr Sharia Equity Fund', ar: 'صندوق مصر للأسهم المتوافقة مع الشريعة' },
  'CIP': { en: 'CI IPOs Fund', ar: 'صندوق سي آي للطروحات الأولية' },
  'CI30': { en: 'Misr Equity Fund', ar: 'صندوق مصر للأسهم' },
  'CGO': { en: 'CI Gold Fund', ar: 'صندوق سي آي للذهب' },
  'C2O': { en: 'CI 20HD Fund', ar: 'صندوق سي آي 20 ذو العائد الدوري' },

  // Funds (Beltone)
  'B70': { en: 'Beltone EGX70 Fund', ar: 'صندوق بلتون إيجي إكس 70' },
  'BRE': { en: 'Beltone Real Estate Fund', ar: 'صندوق بلتون العقاري' },
  'BWA': { en: 'Beltone Wafra Fund', ar: 'صندوق بلتون وفرة' },
  'BFI': { en: 'Beltone Financial Fund', ar: 'صندوق بلتون المالي' },
  'BCO': { en: 'Beltone Consumers Fund', ar: 'صندوق بلتون للاستهلاك' },
  'BIN': { en: 'Beltone Industrial Fund', ar: 'صندوق بلتون الصناعي' },
  'BSB': { en: 'Beltone Sabayek Fund', ar: 'صندوق بلتون سبائك' },
  'BFA': { en: 'Beltone Fadda Fund', ar: 'صندوق بلتون فضة' },
  'BMM': { en: 'Beltone Meya Meya Fund', ar: 'صندوق بلتون مية مية' },

  // Other Funds & Core Assets
  'ABR': { en: 'Bareeq Fund', ar: 'صندوق بريق' },
  'BAR': { en: 'Bareeq Fund', ar: 'صندوق بريق' },
  'BAREEQ': { en: 'Bareeq Fund', ar: 'صندوق بريق' },
  'RE': { en: 'Beltone Real Estate Fund', ar: 'صندوق بلتون العقاري' },
  'AZG': { en: 'Azimut Gold Fund', ar: 'صندوق أزيموت للذهب' },
  'AZS': { en: 'Azimut Savings Fund', ar: 'صندوق أزيموت للادخار' },
  'GOLD': { en: 'Gold 24K', ar: 'ذهب 24ق' },
  'CERTS': { en: 'Certificates', ar: 'شهادات' },
  'NBE': { en: 'NBE Certificates', ar: 'شهادات البنك الأهلي' },

  // Stocks (Original Watchlist)
  'TMGH': { en: 'Talaat Moustafa Group', ar: 'مجموعة طلعت مصطفى (TMG)' },
  'PHDC': { en: 'Palm Hills Developments', ar: 'بالم هيلز للتعمير' },
  'MASR': { en: 'Madinet Nasr for Housing', ar: 'مدينة نصر للإسكان والتعمير' },
  'COMI': { en: 'Commercial International Bank', ar: 'البنك التجاري الدولي (CIB)' },
  'QNBE': { en: 'QNB Egypt', ar: 'بنك قطر الوطني مصر (QNB)' },
  'SWDY': { en: 'Elsewedy Electric', ar: 'السويدي إليكتريك' },
  'ESRS': { en: 'Ezz Steel', ar: 'حديد عز' },
  'ETEL': { en: 'Telecom Egypt', ar: 'المصرية للاتصالات' },
  'FWRY': { en: 'Fawry', ar: 'فوري لتكنولوجيا البنوك والمدفوعات' },
  'PHAR': { en: 'EIPICO', ar: 'إيبيكو للأدوية' },
  'CLHO': { en: 'Cleopatra Hospitals Group', ar: 'مجموعة مستشفيات كليوباترا' },
  'ISPH': { en: 'Ibn Sina Pharma', ar: 'ابن سينا فارما' },
  'EFID': { en: 'Edita Food Industries', ar: 'إيديتا للصناعات الغذائية' },
  'JUFO': { en: 'Juhayna', ar: 'جهينة للصناعات الغذائية' },

  // Stocks (EGX30 Expansion)
  'ABUK': { en: 'Abou Kir Fertilizers', ar: 'أبوقير للأسمدة والصناعات الكيماوية' },
  'ADIB': { en: 'Abu Dhabi Islamic Bank-Egypt', ar: 'مصرف أبوظبي الإسلامي - مصر' },
  'AMOC': { en: 'Alexandria Mineral Oils', ar: 'الإسكندرية للزيوت المعدنية (أموك)' },
  'ARCC': { en: 'Arabian Cement Company', ar: 'شركة أسمنت العربية' },
  'BTFH': { en: 'Beltone Holding', ar: 'بلتون القابضة' },
  'EAST': { en: 'Eastern Company', ar: 'إيسترن كومباني (الشرقية للدخان)' },
  'HRHO': { en: 'EFG Holding', ar: 'إي إف جي القابضة (هيرميس)' },
  'EFIH': { en: 'E-finance For Digital and Financial Investments', ar: 'إي فاينانس للاستثمارات المالية والرقمية' },
  'EGAL': { en: 'Egypt Aluminum', ar: 'مصر للألومنيوم' },
  'EGCH': { en: 'Egyptian Chemical Industries (Kima)', ar: 'الصناعات الكيماوية المصرية (كيما)' },
  'EMFD': { en: 'Emaar Misr for Development', ar: 'إعمار مصر للتنمية' },
  'GBCO': { en: 'GB Corp', ar: 'جي بي كورب (غبور أوتو)' },
  'HELI': { en: 'Heliopolis Housing', ar: 'مصر الجديدة للإسكان والتعمير' },
  'MCQE': { en: 'Misr Cement (Qena)', ar: 'مصر للأسمنت (قنا)' },
  'ORAS': { en: 'Orascom Construction PLC', ar: 'أوراسكوم للإنشاءات' },
  'ORHD': { en: 'Orascom Development Egypt', ar: 'أوراسكوم للتنمية مصر' },
  'OIH': { en: 'Orascom Investment Holding', ar: 'أوراسكوم للاستثمار القابضة' },
  'ORWE': { en: 'Oriental Weavers', ar: 'النساجون الشرقيون' },
  'CCAP': { en: 'QALAA Holdings', ar: 'القلعة للاستشارات المالية' },
  'RAYA': { en: 'Raya Holding', ar: 'راية القابضة للاستثمارات المالية' },
  'RMDA': { en: 'Rameda (10th of Ramadan Pharmaceutical)', ar: 'راميدا (العاشر من رمضان للأدوية)' },
  'VLMR': { en: 'Valmore Holding', ar: 'فالمور القابضة' },
  'HDBK': { en: 'Housing & Development Bank', ar: 'بنك التعمير والإسكان' },
  'ALCN': { en: 'Alexandria Container & Cargo Handling', ar: 'الإسكندرية لتداول الحاويات والبضائع' },

  // Indices
  'EGX30': { en: 'EGX30 Index', ar: 'مؤشر إيجي إكس 30' },
  'EGX70': { en: 'EGX70 EWI Index', ar: 'مؤشر إيجي إكس 70 متساوي الأوزان' },
  'EGX100': { en: 'EGX100 EWI Index', ar: 'مؤشر إيجي إكس 100 متساوي الأوزان' },
};

export function translateEntityName(tickerOrName?: string | null, lang: Lang = 'en'): string {
  if (!tickerOrName) return '';
  const key = String(tickerOrName).trim();
  const upper = key.toUpperCase();

  // Direct ticker lookup
  if (ENTITY_NAME_MAP[upper]) {
    return lang === 'ar' ? ENTITY_NAME_MAP[upper].ar : ENTITY_NAME_MAP[upper].en;
  }

  // Lookup by exact English name
  const lower = key.toLowerCase();
  for (const entry of Object.values(ENTITY_NAME_MAP)) {
    if (entry.en.toLowerCase() === lower || entry.ar === key) {
      return lang === 'ar' ? entry.ar : entry.en;
    }
  }

  // Substring matching
  if (lang === 'ar') {
    // Funds
    if (/bareeq|abr\b/i.test(key)) return 'صندوق بريق';
    if (/beltone real estate|bre\b/i.test(key)) return 'صندوق بلتون العقاري';
    if (/beltone egx70|b70\b/i.test(key)) return 'صندوق بلتون إيجي إكس 70';
    if (/beltone wafra|bwa\b/i.test(key)) return 'صندوق بلتون وفرة';
    if (/beltone financial|bfi\b/i.test(key)) return 'صندوق بلتون المالي';
    if (/beltone consumers|bco\b/i.test(key)) return 'صندوق بلتون للاستهلاك';
    if (/beltone industrial|bin\b/i.test(key)) return 'صندوق بلتون الصناعي';
    if (/beltone sabayek|bsb\b/i.test(key)) return 'صندوق بلتون سبائك';
    if (/beltone fadda|bfa\b/i.test(key)) return 'صندوق بلتون فضة';
    if (/beltone meya meya|bmm\b/i.test(key)) return 'صندوق بلتون مية مية';
    if (/ci exporters|cex\b/i.test(key)) return 'صندوق سي آي للمصدرين';
    if (/ci telecoms|cti\b/i.test(key)) return 'صندوق سي آي للاتصالات وتكنولوجيا المعلومات';
    if (/ci real estate|cre\b/i.test(key)) return 'صندوق سي آي العقاري';
    if (/ci financial|cff\b/i.test(key)) return 'صندوق سي آي للخدمات المالية والتكنولوجيا المالية';
    if (/ci consumer|ccb\b/i.test(key)) return 'صندوق سي آي للاستهلاك والاحتياجات الأساسية';
    if (/misr sharia|cms\b/i.test(key)) return 'صندوق مصر للأسهم المتوافقة مع الشريعة';
    if (/ci ipos|cip\b/i.test(key)) return 'صندوق سي آي للطروحات الأولية';
    if (/misr equity|ci30\b/i.test(key)) return 'صندوق مصر للأسهم';
    if (/ci gold|cgo\b/i.test(key)) return 'صندوق سي آي للذهب';
    if (/ci 20hd|c2o\b/i.test(key)) return 'صندوق سي آي 20 ذو العائد الدوري';
    if (/azimut gold|azg\b/i.test(key)) return 'صندوق أزيموت للذهب';
    if (/azimut savings|azs\b/i.test(key)) return 'صندوق أزيموت للادخار';

    // Stocks
    if (/talaat moustafa|tmg/i.test(key)) return 'مجموعة طلعت مصطفى (TMG)';
    if (/commercial international bank|cib/i.test(key)) return 'البنك التجاري الدولي (CIB)';
    if (/palm hills/i.test(key)) return 'بالم هيلز للتعمير';
    if (/madinet nasr/i.test(key)) return 'مدينة نصر للإسكان والتعمير';
    if (/elsewedy/i.test(key)) return 'السويدي إليكتريك';
    if (/ezz steel/i.test(key)) return 'حديد عز';
    if (/telecom egypt/i.test(key)) return 'المصرية للاتصالات';
    if (/fawry/i.test(key)) return 'فوري للمدفوعات الإلكترونية';
    if (/edita/i.test(key)) return 'إيديتا للصناعات الغذائية';
    if (/juhayna/i.test(key)) return 'جهينة للصناعات الغذائية';
    if (/abou kir/i.test(key)) return 'أبوقير للأسمدة';
    if (/abu dhabi islamic/i.test(key)) return 'مصرف أبوظبي الإسلامي - مصر';
    if (/alexandria mineral/i.test(key)) return 'الإسكندرية للزيوت المعدنية (أموك)';
    if (/arabian cement/i.test(key)) return 'أسمنت العربية';
    if (/eastern company/i.test(key)) return 'الشرقية للدخان (إيسترن كومباني)';
    if (/efg holding|hermes/i.test(key)) return 'المجموعة المالية هيرميس (إي إف جي)';
    if (/e-finance/i.test(key)) return 'إي فاينانس للاستثمارات الرقمية';
    if (/egypt aluminum/i.test(key)) return 'مصر للألومنيوم';
    if (/kima/i.test(key)) return 'كيما (الصناعات الكيماوية)';
    if (/emaar/i.test(key)) return 'إعمار مصر للتنمية';
    if (/gb corp|ghabbour/i.test(key)) return 'جي بي كورب (غبور)';
    if (/heliopolis housing/i.test(key)) return 'مصر الجديدة للإسكان';
    if (/misr cement/i.test(key)) return 'مصر للأسمنت (قنا)';
    if (/orascom construction/i.test(key)) return 'أوراسكوم للإنشاءات';
    if (/orascom development/i.test(key)) return 'أوراسكوم للتنمية مصر';
    if (/orascom investment/i.test(key)) return 'أوراسكوم للاستثمار';
    if (/oriental weavers/i.test(key)) return 'النساجون الشرقيون';
    if (/qalaa/i.test(key)) return 'القلعة للاستشارات المالية';
    if (/raya/i.test(key)) return 'راية القابضة';
    if (/rameda/i.test(key)) return 'راميدا للأدوية';
    if (/valmore/i.test(key)) return 'فالمور القابضة';
    if (/housing & development|hdbk/i.test(key)) return 'بنك التعمير والإسكان';
    if (/alexandria container/i.test(key)) return 'الإسكندرية لتداول الحاويات';

    // Indices & Core
    if (/egx30/i.test(key)) return 'مؤشر إيجي إكس 30';
    if (/egx70/i.test(key)) return 'مؤشر إيجي إكس 70 متساوي الأوزان';
    if (/egx100/i.test(key)) return 'مؤشر إيجي إكس 100 متساوي الأوزان';
    if (/gold\s*24k/i.test(key)) return 'ذهب 24ق';
    if (/certificates|nbe cert/i.test(key)) return 'شهادات البنك الأهلي';
  }

  return key;
}

export const SECTOR_MAP: Record<string, { en: string; ar: string }> = {
  'real estate': { en: 'Real Estate', ar: 'العقارات' },
  'banks/financial': { en: 'Banks/Financial', ar: 'البنوك والخدمات المالية' },
  'export & industry': { en: 'Export & Industry', ar: 'التصدير والصناعة' },
  'telecom/tech': { en: 'Telecom/Tech', ar: 'الاتصالات والتكنولوجيا' },
  'consumer & basic needs': { en: 'Consumer & Basic Needs', ar: 'السلع الاستهلاكية والاحتياجات الأساسية' },
  'sharia-compliant equity': { en: 'Sharia-Compliant Equity', ar: 'الأسهم المتوافقة مع الشريعة' },
  'new issuances/ipos': { en: 'New Issuances/IPOs', ar: 'الطروحات الجديدة والاكتتابات' },
  'broad index/diversified': { en: 'Broad Index/Diversified', ar: 'المؤشرات العامة والأسهم المتنوعة' },
  'precious metals': { en: 'Precious Metals', ar: 'المعادن النفيسة' },
  'pharma/healthcare': { en: 'Pharma/Healthcare', ar: 'الأدوية والرعاية الصحية' },
  'chemicals & fertilizers': { en: 'Chemicals & Fertilizers', ar: 'البتروكيماويات والأسمدة' },
  'oil & gas': { en: 'Oil & Gas', ar: 'النفط والغاز' },
  'building materials': { en: 'Building Materials', ar: 'مواد البناء' },
  'transportation': { en: 'Transportation', ar: 'النقل واللوجستيات' },
};

export function translateSector(sector?: string | null, lang: Lang = 'en'): string {
  if (!sector) return lang === 'ar' ? 'غير مصنف' : 'Unclassified';
  const key = sector.trim().toLowerCase();
  if (SECTOR_MAP[key]) {
    return lang === 'ar' ? SECTOR_MAP[key].ar : SECTOR_MAP[key].en;
  }
  return sector;
}

export function translateEntityType(type?: string | null, lang: Lang = 'en'): string {
  if (!type) return '';
  if (lang === 'ar') {
    switch (type.toLowerCase()) {
      case 'fund': return 'صندوق';
      case 'stock': return 'سهم';
      case 'index': return 'مؤشر';
      case 'funds': return 'صناديق';
      case 'stocks': return 'أسهم';
      case 'indices': return 'مؤشرات';
      default: return type;
    }
  }
  switch (type.toLowerCase()) {
    case 'fund': return 'Fund';
    case 'stock': return 'Stock';
    case 'index': return 'Index';
    case 'funds': return 'Funds';
    case 'stocks': return 'Stocks';
    case 'indices': return 'Indices';
    default: return type;
  }
}

