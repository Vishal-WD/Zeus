# Implementation Plan

## Goal Description
We need to finalize the two‑application experience:
1. **Admin Dashboard** – already largely implemented (AdminTwin3D) but we will add a dock list with wait‑time, queue length, and realtime metrics.
2. **Driver App** – enhance the DriverMobile view to fetch the nearest dock via the `/api/nearest` endpoint, display a list of ranked docks, and show a simple route line on the map.

Both apps share the same codebase; routing is handled by React Router. The server already provides the necessary REST endpoints.

## User Review Required
- **Mapbox/MapLibre routing**: We will use a simple straight‑line polyline between driver location and the selected dock (no external routing API). This keeps the demo self‑contained.
- **UI design**: The new dock list will use the existing glass‑panel UI components. Confirm that the simple list meets the “premium” aesthetic requirements.
- **Performance**: The driver view will poll the `/api/nearest` endpoint every 15 seconds. Acceptable?

> [!IMPORTANT] Please confirm the polling interval and whether a real routing service (e.g., OSRM) is desired.

## Open Questions
- Do you want a dedicated “Nearest Dock” page separate from the driver console, or embed the list within `DriverMobile`?
- Should the admin dashboard also allow manual injection of jams and swaps from this new dock list?
- Should we include a “Copy route” button that copies lat/lng coordinates?

## Proposed Changes
---
### Frontend
#### Components
- **src/components/NearestDockList.tsx** – fetches `/api/nearest` with driver location, shows a ranked list, and raises a `onSelect` event.
- **src/components/RouteLine.tsx** – draws a simple line on the DeckGL map between two points.

#### Views
- **src/views/DriverMobile.tsx** – integrate `NearestDockList` and display selected dock details; use `RouteLine` over the map.
- **src/views/AdminTwin3D.tsx** – add a dock table below the metric panel showing each hub’s current wait‑time, queue, and utilization (using `station_queue_snapshot` API via `/api/queue_metrics/{hub_id}`).

#### Styling
- Use existing `glass-panel` and `zeus-card` utilities; add a scrollable table with sticky header.

#### Routing
- Update `src/App.tsx` to include a new route `/driver/nearest` if a separate page is needed.

---
### Backend (minor)
- Ensure `/api/nearest` returns `ranked_docks` with fields required for UI (distance_km, travel_mins, expected_wait_mins, total_cost_score).
- No code changes required; already present.

## Verification Plan
### Automated Tests
- Run `npm run dev` and verify the admin page loads with dock list and metrics.
- Verify the driver page loads nearest dock list and displays a polyline on the map.
- Ensure WebSocket connection remains active.

### Manual Verification
- Open `http://localhost:5173` in a browser, log in as Admin, see the dock table and metrics.
- Switch to Driver view, confirm nearest dock list appears and clicking a dock draws a line on the map.
- Trigger jam via admin button and watch driver view update metrics.

---
*Please review the open questions and approve the plan so we can implement the changes.*
