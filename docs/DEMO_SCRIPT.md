# Demo Video Script (1–2 minutes)

A tight shot list beats a meandering walkthrough. Aim for ~90 seconds.

## Shot list

1. **(0:00–0:10) Hook** — Show the home page. Say what this is in one
   sentence: "Vaulted is milestone-gated crowdfunding on Stellar — pledges
   sit in escrow and earn yield until creators prove their work."

2. **(0:10–0:25) Architecture, fast** — Cut to the README architecture
   diagram or draw it live: Registry → Escrow → Vault. One sentence each:
   "Escrow holds the campaign's money and talks to Vault to earn yield.
   Registry is the public listing and reads live status straight from
   Escrow." This is the moment that proves inter-contract communication
   isn't just claimed, it's the backbone of the app.

3. **(0:25–0:55) Live interaction** — This is the core of the video:
   - Connect Freighter wallet.
   - Open a campaign, show the funding progress bar and milestone list.
   - Make a pledge; show the loading state, then the confirmed transaction
     hash.
   - Switch to the **Live activity** panel and show the `pledge_made` event
     arrive within a few seconds — this is the event-streaming feature.
   - As the arbiter, approve a milestone, then release funds; show the
     milestone timeline update from "pending" → "approved" → "released".

4. **(0:55–1:10) Mobile** — Resize the browser (or show a phone) to prove
   the responsive layout holds up: progress bar, pledge form, and timeline
   all still usable single-column.

5. **(1:10–1:25) CI/CD** — Quick cut to the GitHub Actions tab: green checks
   on the latest commit, then expand the test step to show passing test
   counts.

6. **(1:25–1:35) Close** — One sentence on what's next ("multisig arbiter,
   real yield strategy") and a thank-you / link to the repo.

## Recording tips

- Pre-fund your testnet wallet and pre-register at least one campaign before
  recording, so you're not waiting on faucet/funding delays on camera.
- Keep the pledge amount small and round (e.g. 50 XLM) so the math in the
  progress bar is easy to follow at a glance.
- If `getEvents` polling takes a few seconds to surface the new event, cut
  on the wait rather than narrating dead air.
