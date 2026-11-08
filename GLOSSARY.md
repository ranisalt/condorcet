# Glossary

**Participation journey**: the ordered steps a signed-in voter moves through for the current election: acknowledgment → ballot → thanks. A voter's stage is derived from their participation row (absent, acknowledged, submitted). `enterStep` in `src/lib/server/participation.ts` admits a voter to a step or redirects them to the right one.

**Acknowledgment**: the voter's explicit acceptance of the election's rules. Creates the participation row; does not count as submission.

**Submission**: a saved ballot. An empty ballot is still a submission (it withdraws choices but keeps results eligibility); only nonempty ballots count as valid.

**Signed cookie**: an HMAC-signed, expiring cookie bound to a purpose, so a value issued for one purpose is never valid for another. Implemented once in `src/lib/server/signed-cookie.ts`; the voter session and the OIDC login transaction are its two users.

**Voter session**: the signed cookie that carries the voter's opaque `sub` for one day.

**Results gate**: the rule that hides results until the voter has submitted and the valid-ballot count reaches the `RESULTS_THRESHOLD` deployment setting. Checked on a cheap precheck, then again on the snapshot the outcome is computed from.
