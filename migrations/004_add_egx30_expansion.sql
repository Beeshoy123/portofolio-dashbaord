-- Comparison Judge: add 24 EGX30 constituents not previously tracked
-- Run this BEFORE 005_yahoo_ticker_mapping.sql

INSERT INTO "comparison_watchlist" ("ticker", "name", "entity_type", "source_code", "sector", "manager", "is_held") VALUES
('ABUK', 'Abou Kir Fertilizers',                          'stock', NULL, 'Chemicals & Fertilizers', NULL, false),
('ADIB', 'Abu Dhabi Islamic Bank-Egypt',                   'stock', NULL, 'Banks/Financial',         NULL, false),
('AMOC', 'Alexandria Mineral Oils',                        'stock', NULL, 'Oil & Gas',               NULL, false),
('ARCC', 'Arabian Cement Company',                         'stock', NULL, 'Building Materials',      NULL, false),
('BTFH', 'Beltone Holding',                                'stock', NULL, 'Banks/Financial',         NULL, false),
('EAST', 'Eastern Company',                                'stock', NULL, 'Consumer & Basic Needs',  NULL, false),
('HRHO', 'EFG Holding',                                    'stock', NULL, 'Banks/Financial',         NULL, false),
('EFIH', 'E-finance For Digital and Financial Investments','stock', NULL, 'Telecom/Tech',            NULL, false),
('EGAL', 'Egypt Aluminum',                                 'stock', NULL, 'Export & Industry',       NULL, false),
('EGCH', 'Egyptian Chemical Industries (Kima)',            'stock', NULL, 'Chemicals & Fertilizers', NULL, false),
('EMFD', 'Emaar Misr for Development',                     'stock', NULL, 'Real Estate',             NULL, false),
('GBCO', 'GB Corp',                                        'stock', NULL, 'Consumer & Basic Needs',  NULL, false),
('HELI', 'Heliopolis Housing',                             'stock', NULL, 'Real Estate',             NULL, false),
('MCQE', 'Misr Cement (Qena)',                              'stock', NULL, 'Building Materials',      NULL, false),
('ORAS', 'Orascom Construction PLC',                       'stock', NULL, 'Export & Industry',       NULL, false),
('ORHD', 'Orascom Development Egypt',                      'stock', NULL, 'Real Estate',             NULL, false),
('OIH',  'Orascom Investment Holding',                     'stock', NULL, 'Banks/Financial',         NULL, false),
('ORWE', 'Oriental Weavers',                                'stock', NULL, 'Export & Industry',       NULL, false),
('CCAP', 'QALAA Holdings',                                  'stock', NULL, 'Banks/Financial',         NULL, false),
('RAYA', 'Raya Holding',                                    'stock', NULL, 'Telecom/Tech',            NULL, false),
('RMDA', 'Rameda (10th of Ramadan Pharmaceutical)',        'stock', NULL, 'Pharma/Healthcare',       NULL, false),
('VLMR', 'Valmore Holding',                                 'stock', NULL, 'Banks/Financial',         NULL, false),
('HDBK', 'Housing & Development Bank',                     'stock', NULL, 'Banks/Financial',         NULL, false),
('ALCN', 'Alexandria Container & Cargo Handling',          'stock', NULL, 'Transportation',          NULL, false)
ON CONFLICT ("ticker") DO NOTHING;
