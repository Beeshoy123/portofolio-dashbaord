# query

> God node · 13 connections · [G:\AI\portofolio-dashbaord\artifacts\api-server\src\routes\verdicts.ts](file:///G:/AI/portofolio-dashbaord/artifacts/api-server/src/routes/verdicts.ts#L39)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as query
    participant P1 as judgeHolding()
    participant P2 as judgeAllHoldingsUncached()
    participant P3 as judgeAllHoldings()
    participant P4 as getWatchlistRows()
    participant P5 as getPortfolioValueBreakdown()
    participant P6 as getLatestSnapshots()
    participant P7 as getTechnicalSignals()
    participant P8 as getLatestFundamentals()
    participant P9 as judgeOneHolding()
    participant P10 as isEmergencyReserveFund()
    participant P11 as computeFinancialHealthGrade()
    participant P12 as computeFundQualityGrade()
    participant P13 as numeric()
    participant P14 as returnFor()
    participant P15 as assetRole()
    participant P16 as buildFundamentalsSnapshot()
    participant P17 as groupFor()
    participant P18 as computeTechnicalGrade()
    participant P19 as combineIntoFinalLabel()
    participant P20 as riskTier()
    participant P21 as loadPersistedVerdicts()
    participant P22 as runBot()
    participant P23 as runMigration()
    participant P24 as releaseAdvisoryLock()
    participant P25 as saveSnapshot()
    participant P26 as saveSnapshot()
    participant P27 as saveSnapshot()
    participant P28 as capturePortfolioValue()
    participant P29 as persistRunDiagnostics()
    participant P30 as syncFundNav()
    participant P31 as saveFundamentals()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P2->>+ P3: calls
    P3-->>- P2: return
    P2->>+ P4: calls
    P4-->>- P2: return
    P2->>+ P5: calls
    P5-->>- P2: return
    P2->>+ P6: calls
    P6-->>- P2: return
    P2->>+ P7: calls
    P7-->>- P2: return
    P2->>+ P8: calls
    P8-->>- P2: return
    P1->>+ P9: calls
    P9-->>- P1: return
    P9->>+ P1: calls
    P1-->>- P9: return
    P9->>+ P4: calls
    P4-->>- P9: return
    P9->>+ P5: calls
    P5-->>- P9: return
    P9->>+ P6: calls
    P6-->>- P9: return
    P9->>+ P7: calls
    P7-->>- P9: return
    P9->>+ P10: calls
    P10-->>- P9: return
    P9->>+ P8: calls
    P8-->>- P9: return
    P1->>+ P11: calls
    P11-->>- P1: return
    P1->>+ P12: calls
    P12-->>- P1: return
    P1->>+ P13: calls
    P13-->>- P1: return
    P1->>+ P14: calls
    P14-->>- P1: return
    P1->>+ P15: calls
    P15-->>- P1: return
    P1->>+ P16: calls
    P16-->>- P1: return
    P1->>+ P17: calls
    P17-->>- P1: return
    P1->>+ P18: calls
    P18-->>- P1: return
    P1->>+ P19: calls
    P19-->>- P1: return
    P1->>+ P20: calls
    P20-->>- P1: return
    P0->>+ P21: calls
    P21-->>- P0: return
    P0->>+ P22: calls
    P22-->>- P0: return
    P0->>+ P23: calls
    P23-->>- P0: return
    P0->>+ P24: calls
    P24-->>- P0: return
    P0->>+ P25: calls
    P25-->>- P0: return
    P0->>+ P26: calls
    P26-->>- P0: return
    P0->>+ P27: calls
    P27-->>- P0: return
    P0->>+ P28: calls
    P28-->>- P0: return
    P0->>+ P29: calls
    P29-->>- P0: return
    P0->>+ P30: calls
    P30-->>- P0: return
    P0->>+ P31: calls
    P31-->>- P0: return
```

## Connections by Relation

### calls
- [[judgeHolding()]] `INFERRED`
- [[loadPersistedVerdicts()]] `INFERRED`
- [[runBot()]] `INFERRED`
- [[runMigration()]] `INFERRED`
- [[releaseAdvisoryLock()]] `INFERRED`
- [[saveSnapshot()]] `INFERRED`
- [[saveSnapshot()]] `INFERRED`
- [[saveSnapshot()]] `INFERRED`
- [[capturePortfolioValue()]] `INFERRED`
- [[persistRunDiagnostics()]] `INFERRED`
- [[syncFundNav()]] `INFERRED`
- [[saveFundamentals()]] `INFERRED`

### contains
- [[verdicts.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*