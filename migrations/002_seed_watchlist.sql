-- Comparison Judge: seed the fixed 35-entity watchlist
-- Run this once, after 001_create_comparison_snapshots.sql
--
-- funds_table_key for BRE and CFF must be updated to match your real
-- funds.key values before Comparison Judge can compute position sizes
-- (comparisonJudge.ts JOINs on this column to pull actual holding value).
-- Left NULL below; the join will silently return no match until filled in.

INSERT INTO "comparison_watchlist" ("ticker", "name", "entity_type", "source_code", "sector", "manager", "is_held") VALUES
-- CI Capital funds
('CEX',  'CI Exporters Fund',                'fund', 'MUB-6199', 'Export & Industry',      'CI Capital', false),
('CTI',  'CI Telecoms & IT Fund',             'fund', 'MUB-6198', 'Telecom/Tech',           'CI Capital', false),
('CRE',  'CI Real Estate Fund',               'fund', 'MUB-6197', 'Real Estate',            'CI Capital', false),
('CFF',  'CI Financial & Fintech Fund',       'fund', 'MUB-6201', 'Banks/Financial',        'CI Capital', false),
('CCB',  'CI Consumer & Basic Needs Fund',    'fund', 'MUB-6200', 'Consumer & Basic Needs', 'CI Capital', false),
('CMS',  'Misr Sharia Equity Fund',           'fund', 'MUB-6144', 'Sharia-Compliant Equity','CI Capital', false),
('CIP',  'CI IPOs Fund',                      'fund', 'SNDUK-CIP','New Issuances/IPOs',     'CI Capital', false),
('CI30', 'Misr Equity Fund',                  'fund', 'MUB-6403', 'Broad Index/Diversified','CI Capital', false),
('CGO',  'CI Gold Fund',                      'fund', 'MUB-6427', 'Precious Metals',        'CI Capital', false),
('C2O',  'CI 20HD Fund',                      'fund', 'SNDUK-124','Broad Index/Diversified','CI Capital', false),

-- Beltone funds
('B70',  'Beltone EGX70 Fund',                'fund', 'MUB-6466', 'Broad Index/Diversified','Beltone', false),
('BRE',  'Beltone Real Estate Fund',          'fund', 'MUB-6203', 'Real Estate',            'Beltone', true),
('BWA',  'Beltone Wafra Fund',                'fund', 'MUB-6149', 'Sharia-Compliant Equity','Beltone', false),
('BFI',  'Beltone Financial Fund',            'fund', 'MUB-6202', 'Banks/Financial',        'Beltone', false),
('BCO',  'Beltone Consumers Fund',            'fund', 'MUB-6205', 'Consumer & Basic Needs', 'Beltone', false),
('BIN',  'Beltone Industrial Fund',           'fund', 'MUB-6204', 'Export & Industry',      'Beltone', false),
('BSB',  'Beltone Sabayek Fund',              'fund', 'MUB-6061', 'Precious Metals',        'Beltone', false),
('BFA',  'Beltone Fadda Fund',                'fund', 'SNDUK-BSL','Precious Metals',        'Beltone', false),
('BMM',  'Beltone Meya Meya Fund',            'fund', 'MUB-6148', 'Broad Index/Diversified','Beltone', false),

-- Individual EGX stocks
('TMGH', 'Talaat Moustafa Group',             'stock', NULL, 'Real Estate',            NULL, false),
('PHDC', 'Palm Hills Developments',           'stock', NULL, 'Real Estate',            NULL, false),
('MASR', 'Madinet Nasr for Housing',          'stock', NULL, 'Real Estate',            NULL, false),
('COMI', 'Commercial International Bank',     'stock', NULL, 'Banks/Financial',        NULL, false),
('QNBE', 'QNB Egypt',                         'stock', NULL, 'Banks/Financial',        NULL, false),
('SWDY', 'Elsewedy Electric',                 'stock', NULL, 'Export & Industry',      NULL, false),
('ESRS', 'Ezz Steel',                         'stock', NULL, 'Export & Industry',      NULL, false),
('ETEL', 'Telecom Egypt',                     'stock', NULL, 'Telecom/Tech',           NULL, false),
('FWRY', 'Fawry',                             'stock', NULL, 'Telecom/Tech',           NULL, false),
('PHAR', 'EIPICO',                            'stock', NULL, 'Pharma/Healthcare',      NULL, false),
('CLHO', 'Cleopatra Hospitals Group',         'stock', NULL, 'Pharma/Healthcare',      NULL, false),
('ISPH', 'Ibn Sina Pharma',                   'stock', NULL, 'Pharma/Healthcare',      NULL, false),
('EFID', 'Edita Food Industries',             'stock', NULL, 'Consumer & Basic Needs', NULL, false),
('JUFO', 'Juhayna',                           'stock', NULL, 'Consumer & Basic Needs', NULL, false),

-- Indices (all 3 live on one shared page: /en/indices)
('EGX30',  'EGX30 Index',       'index', NULL, 'Broad Index/Diversified', NULL, false),
('EGX70',  'EGX70 EWI Index',   'index', NULL, 'Broad Index/Diversified', NULL, false),
('EGX100', 'EGX100 EWI Index',  'index', NULL, 'Broad Index/Diversified', NULL, false)

ON CONFLICT ("ticker") DO NOTHING;
