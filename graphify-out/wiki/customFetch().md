# customFetch()

> God node · 16 connections · [G:\AI\portofolio-dashbaord\lib\api-client-react\src\custom-fetch.ts](file:///G:/AI/portofolio-dashbaord/lib/api-client-react/src/custom-fetch.ts#L325)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as customFetch()
    participant P1 as parseErrorBody()
    participant P2 as hasNoBody()
    participant P3 as parseSuccessBody()
    participant P4 as getMediaType()
    participant P5 as inferResponseType()
    participant P6 as isJsonMediaType()
    participant P7 as isTextMediaType()
    participant P8 as stripBom()
    participant P9 as looksLikeJson()
    participant P10 as applyBaseUrl()
    participant P11 as resolveUrl()
    participant P12 as resolveMethod()
    participant P13 as isRequest()
    participant P14 as healthCheck()
    participant P15 as getPortfolio()
    participant P16 as updateGoldSettings()
    participant P17 as createGoldTransaction()
    participant P18 as updateFund()
    participant P19 as createGrowthSnapshot()
    participant P20 as mergeHeaders()
    participant P21 as _authTokenGetter
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
    P1->>+ P4: calls
    P4-->>- P1: return
    P4->>+ P1: calls
    P1-->>- P4: return
    P4->>+ P5: calls
    P5-->>- P4: return
    P1->>+ P6: calls
    P6-->>- P1: return
    P6->>+ P1: calls
    P1-->>- P6: return
    P6->>+ P5: calls
    P5-->>- P6: return
    P1->>+ P7: calls
    P7-->>- P1: return
    P7->>+ P1: calls
    P1-->>- P7: return
    P7->>+ P5: calls
    P5-->>- P7: return
    P1->>+ P8: calls
    P8-->>- P1: return
    P1->>+ P9: calls
    P9-->>- P1: return
    P0->>+ P3: calls
    P3-->>- P0: return
    P0->>+ P10: calls
    P10-->>- P0: return
    P0->>+ P11: calls
    P11-->>- P0: return
    P0->>+ P12: calls
    P12-->>- P0: return
    P0->>+ P13: calls
    P13-->>- P0: return
    P0->>+ P9: calls
    P9-->>- P0: return
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
    P0->>+ P20: calls
    P20-->>- P0: return
    P0->>+ P21: calls
    P21-->>- P0: return
```

## Connections by Relation

### calls
- [[parseErrorBody()]] `EXTRACTED`
- [[parseSuccessBody()]] `EXTRACTED`
- [[applyBaseUrl()]] `EXTRACTED`
- [[resolveUrl()]] `EXTRACTED`
- [[resolveMethod()]] `EXTRACTED`
- [[isRequest()]] `EXTRACTED`
- [[looksLikeJson()]] `EXTRACTED`
- [[healthCheck()]] `INFERRED`
- [[getPortfolio()]] `INFERRED`
- [[updateGoldSettings()]] `INFERRED`
- [[createGoldTransaction()]] `INFERRED`
- [[updateFund()]] `INFERRED`
- [[createGrowthSnapshot()]] `INFERRED`
- [[mergeHeaders()]] `EXTRACTED`
- [[_authTokenGetter]] `EXTRACTED`

### contains
- [[custom-fetch.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*