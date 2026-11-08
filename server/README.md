# Kyron Coach API

Existing Kyron backend plus the Akiles onboarding integration.

## Runtime

Use Node.js 22 LTS and npm 10.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `AKILES_INTEGRATION_KEY` to a long random secret; use the exact same value in Akiles backend.
3. Fill in the `KYRON_COACH_*` fields with the real coach identity and contact details. Set `KYRON_COACH_VERIFIED=true` only after verifying the coach.
4. Run `npm install`, then `npm run dev`.

## Added integration endpoints

- `GET /api/integrations/coaches` — server-to-server protected coach profile/contact data.
- `POST /api/integrations/onboarding-invitations` — create an invitation for an Akiles athlete email from the Kyron athlete detail screen.
- `GET /api/integrations/onboarding-invitations?email=...` — protected invitation lookup for Akiles.
- `POST /api/integrations/onboarding-invitations/:id/respond` — protected athlete accept/decline response.
- `GET /api/integrations/relationship?email=...` — protected active relationship lookup.
- `POST /api/integrations/workout-completions` — protected workout sync from Akiles.
- `GET /api/integrations/athletes/:email/workouts` — protected shared workout history for Kyron.

The integration creates SQLite tables using safe `CREATE TABLE IF NOT EXISTS` migrations. Existing Kyron athlete/training tables are retained.

**Security limitation:** the supplied Kyron frontend/backend has no coach authentication middleware. The invitation-creation route is therefore available to the Kyron app's existing trusted UI, but must be protected with coach authentication before public deployment. The other integration endpoints require the shared bearer secret.
