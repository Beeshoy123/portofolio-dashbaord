---
name: Long scraper requests
description: Runtime constraint for the comparison scraper and its refresh UI.
---

The comparison scraper must not be held open behind the browser request. Start it in the API background and expose a status endpoint for the client to poll until completion.

**Why:** The 60-entity run can exceed the preview proxy's request timeout even while the server continues successfully. A synchronous request makes the UI show a false failure, and a second click then gets a misleading already-running response.

**How to apply:** Keep the server response non-blocking, preserve the in-memory lock, return an explicit running state, and have the dashboard poll with a generous client-side timeout before loading snapshots.