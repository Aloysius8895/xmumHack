# Collection speed

Keep the existing 14 career queries, per-source detail quota, platform allowlist, deduplication, source quarantine, and last-good-publication rules. The most recent complete old-profile run took 166 seconds for 56 requests.

Use up to three source workers: both indexed platform views share one API response cache and pacing lane, while Ricebowl advances on its separate sequential browser tab. API requests retain a 2500 ms minimum interval. Public/browser sources use a 1000 ms minimum interval. Total request/record budgets and the common deadline still apply across all workers. Authentication failures stop further API role queries immediately. Each run records elapsed and per-source times.

Validate concurrent budget caps, per-provider pacing, cancellation, cache reuse, complete sample parity, and failure quarantine. Compare serial and parallel configurations on identical local synthetic responses without provider credits or publication. Activate the service only after the user's current run finishes.

Completed: 53 crawler tests and seven game-side sampling tests passed. The local benchmark retained the same 12 postings and 12 requests: 25.743 seconds serial versus 9.843 seconds parallel (62% less elapsed time). Actual website timing was not benchmarked.

The prior user-started run finished before service activation. The original terminal stopped the idle service normally, and the new service health check confirmed concurrency 3, public interval 1000 ms, JSearch interval 2500 ms, and configured JSearch credentials. No new market run was started for activation or verification.
