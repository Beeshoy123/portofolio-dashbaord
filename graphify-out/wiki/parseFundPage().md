# parseFundPage()

> God node · 9 connections · [G:\AI\portofolio-dashbaord\attached_assets\parseFund_1785599325894.ts](file:///G:/AI/portofolio-dashbaord/attached_assets/parseFund_1785599325894.ts#L90)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as parseFundPage()
    participant P1 as main()
    participant P2 as parseStockPage()
    participant P3 as tryPlainFetch()
    participant P4 as tryOptimizedBrowser()
    participant P5 as main()
    participant P6 as tryNextData()
    participant P7 as emptySnapshot()
    participant P8 as parseIndexPage()
    participant P9 as main()
    participant P10 as saveSnapshot()
    participant P11 as query
    participant P12 as getWatchlist()
    participant P13 as sleep()
    participant P14 as extractPriceNear()
    participant P15 as extractPercentNear()
    participant P16 as extractCagr()
    participant P17 as extractScoreNear()
    participant P18 as emptySnapshot()
    participant P19 as extractRiskLevel()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P3: calls
    P3-->>- P2: return
    P2->>+ P4: calls
    P4-->>- P2: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P2->>+ P5: calls
    P5-->>- P2: return
    P2->>+ P6: calls
    P6-->>- P2: return
    P2->>+ P7: calls
    P7-->>- P2: return
    P1->>+ P8: calls
    P8-->>- P1: return
    P8->>+ P1: calls
    P1-->>- P8: return
    P8->>+ P5: calls
    P5-->>- P8: return
    P8->>+ P9: calls
    P9-->>- P8: return
    P1->>+ P10: calls
    P10-->>- P1: return
    P10->>+ P11: calls
    P11-->>- P10: return
    P10->>+ P1: calls
    P1-->>- P10: return
    P1->>+ P12: calls
    P12-->>- P1: return
    P1->>+ P13: calls
    P13-->>- P1: return
    P0->>+ P5: calls
    P5-->>- P0: return
    P0->>+ P14: calls
    P14-->>- P0: return
    P0->>+ P15: calls
    P15-->>- P0: return
    P0->>+ P16: calls
    P16-->>- P0: return
    P0->>+ P17: calls
    P17-->>- P0: return
    P0->>+ P18: calls
    P18-->>- P0: return
    P0->>+ P19: calls
    P19-->>- P0: return
```

## Connections by Relation

### calls
- [[main()]] `INFERRED`
- [[main()]] `INFERRED`
- [[extractPriceNear()]] `EXTRACTED`
- [[extractPercentNear()]] `EXTRACTED`
- [[extractCagr()]] `EXTRACTED`
- [[extractScoreNear()]] `EXTRACTED`
- [[emptySnapshot()]] `EXTRACTED`
- [[extractRiskLevel()]] `EXTRACTED`

### contains
- [[parseFund_1785599325894.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*