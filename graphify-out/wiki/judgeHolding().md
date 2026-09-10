# judgeHolding()

> God node · 9 connections · [G:\AI\portofolio-dashbaord\attached_assets\comparisonJudge_1785632070487.ts](file:///G:/AI/portofolio-dashbaord/attached_assets/comparisonJudge_1785632070487.ts#L725)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as judgeHolding()
    participant P1 as judgeAllHoldings()
    participant P2 as getWatchlist()
    participant P3 as main()
    participant P4 as printVerdict()
    participant P5 as suggestDepositAllocation()
    participant P6 as findOpportunities()
    participant P7 as main()
    participant P8 as printVerdict()
    participant P9 as getLatestSnapshots()
    participant P10 as getReturn()
    participant P11 as computeRiskTier()
    participant P12 as buildGroup()
    participant P13 as computeSignal()
    participant P14 as getHoldingCurrentValue()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P0: calls
    P0-->>- P2: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P1->>+ P3: calls
    P3-->>- P1: return
    P3->>+ P1: calls
    P1-->>- P3: return
    P3->>+ P4: calls
    P4-->>- P3: return
    P1->>+ P5: calls
    P5-->>- P1: return
    P5->>+ P1: calls
    P1-->>- P5: return
    P5->>+ P6: calls
    P6-->>- P5: return
    P1->>+ P7: calls
    P7-->>- P1: return
    P7->>+ P1: calls
    P1-->>- P7: return
    P7->>+ P8: calls
    P8-->>- P7: return
    P0->>+ P2: calls
    P2-->>- P0: return
    P0->>+ P9: calls
    P9-->>- P0: return
    P0->>+ P10: calls
    P10-->>- P0: return
    P0->>+ P11: calls
    P11-->>- P0: return
    P0->>+ P12: calls
    P12-->>- P0: return
    P0->>+ P13: calls
    P13-->>- P0: return
    P0->>+ P14: calls
    P14-->>- P0: return
```

## Connections by Relation

### calls
- [[judgeAllHoldings()]] `EXTRACTED`
- [[getWatchlist()]] `EXTRACTED`
- [[getLatestSnapshots()]] `EXTRACTED`
- [[getReturn()]] `EXTRACTED`
- [[computeRiskTier()]] `EXTRACTED`
- [[buildGroup()]] `EXTRACTED`
- [[computeSignal()]] `EXTRACTED`
- [[getHoldingCurrentValue()]] `EXTRACTED`

### contains
- [[comparisonJudge_1785632070487.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*