# buildDashboardHtml()

> God node · 15 connections · [G:\AI\portofolio-dashbaord\artifacts\portfolio\src\lib\dashboardHtml.ts](file:///G:/AI/portofolio-dashbaord/artifacts/portfolio/src/lib/dashboardHtml.ts#L510)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as buildDashboardHtml()
    participant P1 as buildUsdRealityCard()
    participant P2 as fmt2()
    participant P3 as toLocaleString()
    participant P4 as initDashboardBehavior()
    participant P5 as buildGoldCohortAnalysis()
    participant P6 as buildInsights()
    participant P7 as realUSDReturn()
    participant P8 as analyzeGold()
    participant P9 as analyzeCerts()
    participant P10 as runVerificationTests()
    participant P11 as analyzeAsset()
    participant P12 as toUSD()
    participant P13 as requiredEGPReturn()
    participant P14 as egpPriceForTargetUSD()
    participant P15 as fmt1()
    participant P16 as fmt()
    participant P17 as signedFmt()
    participant P18 as pctStr()
    participant P19 as buildCohortAnalysis()
    participant P20 as buildAnnualizedReturnCard()
    participant P21 as heatColor()
    participant P22 as attribBar()
    participant P23 as healthGrade()
    participant P24 as buildDonutRing()
    participant P25 as allocInsight()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P0: calls
    P0-->>- P2: return
    P2->>+ P3: calls
    P3-->>- P2: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P2->>+ P4: calls
    P4-->>- P2: return
    P2->>+ P5: calls
    P5-->>- P2: return
    P2->>+ P6: calls
    P6-->>- P2: return
    P1->>+ P7: calls
    P7-->>- P1: return
    P7->>+ P1: calls
    P1-->>- P7: return
    P7->>+ P8: calls
    P8-->>- P7: return
    P7->>+ P9: calls
    P9-->>- P7: return
    P7->>+ P10: calls
    P10-->>- P7: return
    P7->>+ P11: calls
    P11-->>- P7: return
    P1->>+ P12: calls
    P12-->>- P1: return
    P1->>+ P13: calls
    P13-->>- P1: return
    P1->>+ P14: calls
    P14-->>- P1: return
    P1->>+ P15: calls
    P15-->>- P1: return
    P0->>+ P16: calls
    P16-->>- P0: return
    P0->>+ P2: calls
    P2-->>- P0: return
    P0->>+ P5: calls
    P5-->>- P0: return
    P0->>+ P6: calls
    P6-->>- P0: return
    P0->>+ P17: calls
    P17-->>- P0: return
    P0->>+ P18: calls
    P18-->>- P0: return
    P0->>+ P19: calls
    P19-->>- P0: return
    P0->>+ P20: calls
    P20-->>- P0: return
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
```

## Connections by Relation

### calls
- [[buildUsdRealityCard()]] `EXTRACTED`
- [[fmt()]] `INFERRED`
- [[fmt2()]] `INFERRED`
- [[buildGoldCohortAnalysis()]] `EXTRACTED`
- [[buildInsights()]] `EXTRACTED`
- [[signedFmt()]] `EXTRACTED`
- [[pctStr()]] `EXTRACTED`
- [[buildCohortAnalysis()]] `EXTRACTED`
- [[buildAnnualizedReturnCard()]] `EXTRACTED`
- [[heatColor()]] `EXTRACTED`
- [[attribBar()]] `EXTRACTED`
- [[healthGrade()]] `EXTRACTED`
- [[buildDonutRing()]] `EXTRACTED`
- [[allocInsight()]] `EXTRACTED`

### contains
- [[dashboardHtml.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*