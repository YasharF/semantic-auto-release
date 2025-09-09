# Token Experiments Matrix

Purpose: Empirically capture which repository info fields resolve to `unknown` per token variation. These token variations are instrumentation aids for data gathering; they are NOT product-surfaced classifications.

We’re building a ground‑truth dataset from raw GitHub API fixture captures to drive future tests, without trusting current implementation logic. For each token independently we must separate two questions: (a) what the repository’s actual state is (e.g., protection type none/classic/rules) and (b) whether that token can conclusively observe it.

## Repository Info Fields Tracked

| Field                       | Values                                   | Notes                                             |
| --------------------------- | ---------------------------------------- | ------------------------------------------------- |
| branchProtection            | none/classic/rules/classic+rules/unknown | Derived from classic + rules endpoints            |
| defaultBranch               | <name>/unknown                           | Fallback is `main` if metadata missing            |
| visibility                  | public/private/unknown                   | From repo metadata                                |
| autoMergeEnabled            | true/false/unknown                       | `allow_auto_merge`                                |
| allowSquashMerge            | true/false/unknown                       | `allow_squash_merge`                              |
| requiredStatusChecksEnabled | true/false/unknown                       | true only if contexts read & non-empty            |
| requiredStatusCheckContexts | list/unknown                             | Only populated if enabled and contexts accessible |
| prRequired                  | true/false/unknown                       | From classic or rules protection data             |

## Token Variations Under Test

```
PAT_ADMIN               # broad permissions
PAT_CONTENT_PR_STATUS   # contents + pull requests + statuses (read)
PAT_CONTENT_PR          # contents + pull requests (no explicit statuses permission)
PAT_MIN                 # minimal contents + pull requests (same as above if no further reduction)
PAT_BAD                 # intentionally insufficient (no push / PR write)
GH_TOKEN v1             # default actions token (baseline permissions)
GH_TOKEN v2             # actions token with reduced workflow/PR permissions
```

## Raw Fixture-Derived Matrix (Per Scenario / Token)

This supersedes the earlier matrix and now explicitly separates classic vs rules protection readability before collapsing to a branchProtection Y/N/U signal. Rows are produced directly from raw HTTP capture JSON (no use of assessment logic) via `scripts/derive-token-experiments.js`.

Legend (per-column meanings)

- classicState / rulesState: present | absent | unreadable (endpoint-level evidence)
- combinedProtection: none | classic | rules | classic+rules | unknown (derived purely from present/absent signals; unreadable endpoints do not force "none")
- branchProtectionYN: Y if combinedProtection != none and at least one endpoint present; N if combinedProtection == none; U if both endpoints unreadable or absent vs unreadable such that combinedProtection == unknown.
- reqStatusChecks: Y/N/U based on ability to read contexts & rule presence.
- statusCtxs: Y if non-empty list accessible; N if accessible but empty/disabled; U if unreadable.
- prRequired: Y if PR requirement surfaced (classic PR requirement flags OR rules includes pull_request); N if accessible and absent; U otherwise.
- defaultBranch / visibility / autoMerge / allowSquash: Y when the repo metadata value is readable (and for booleans true => Y, false => N); N for readable negative booleans; U when metadata unreadable.

| Scenario                        | Token                 | classicState | rulesState | combinedProtection | branchProtectionYN | reqStatusChecks | statusCtxs | prRequired | defaultBranch | visibility | autoMerge | allowSquash |
| ------------------------------- | --------------------- | ------------ | ---------- | ------------------ | ------------------ | --------------- | ---------- | ---------- | ------------- | ---------- | --------- | ----------- |
| automerge_enabled               | PAT_ADMIN             | absent       | absent     | none               | N                  | N               | N          | N          | Y             | Y          | Y         | U           |
| automerge_real                  | PAT_BAD               | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | U             | U          | U         | U           |
| automerge_real                  | PAT_ADMIN             | absent       | present    | rules              | Y                  | Y               | Y          | N          | Y             | Y          | Y         | Y           |
| automerge_real                  | PAT_CONTENT_PR_STATUS | unreadable   | present    | rules              | Y                  | Y               | Y          | N          | Y             | Y          | Y         | Y           |
| automerge_real                  | PAT_CONTENT_PR        | unreadable   | present    | rules              | Y                  | Y               | Y          | N          | Y             | Y          | Y         | Y           |
| automerge_real                  | PAT_MIN               | unreadable   | present    | rules              | Y                  | Y               | Y          | N          | Y             | Y          | U         | U           |
| classic_real                    | PAT_BAD               | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | U             | U          | U         | U           |
| classic_real                    | PAT_ADMIN             | present      | absent     | classic            | Y                  | Y               | Y          | Y          | Y             | Y          | N         | Y           |
| classic_real                    | PAT_CONTENT_PR_STATUS | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| classic_real                    | PAT_CONTENT_PR        | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| classic_real                    | PAT_MIN               | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | U         | U           |
| classic_rules_codescan_signed   | PAT_BAD               | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | U             | U          | U         | U           |
| classic_rules_codescan_signed   | PAT_ADMIN             | present      | absent     | classic            | Y                  | Y               | Y          | Y          | Y             | Y          | Y         | Y           |
| classic_rules_codescan_signed   | PAT_CONTENT_PR_STATUS | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | Y         | Y           |
| classic_rules_codescan_signed   | PAT_CONTENT_PR        | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | Y         | Y           |
| classic_rules_codescan_signed   | PAT_MIN               | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | U         | U           |
| classic_rules_real              | PAT_BAD               | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | U             | U          | U         | U           |
| classic_rules_real              | PAT_ADMIN             | present      | present    | classic+rules      | Y                  | Y               | Y          | Y          | Y             | Y          | Y         | Y           |
| classic_rules_real              | PAT_CONTENT_PR_STATUS | unreadable   | present    | rules              | Y                  | Y               | Y          | N          | Y             | Y          | Y         | Y           |
| classic_rules_real              | PAT_CONTENT_PR        | unreadable   | present    | rules              | Y                  | Y               | Y          | N          | Y             | Y          | Y         | Y           |
| classic_rules_real              | PAT_MIN               | unreadable   | present    | rules              | Y                  | Y               | Y          | N          | Y             | Y          | U         | U           |
| classic_signed                  | PAT_BAD               | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | U             | U          | U         | U           |
| classic_signed                  | PAT_ADMIN             | present      | absent     | classic            | Y                  | Y               | Y          | Y          | Y             | Y          | Y         | Y           |
| classic_signed                  | PAT_CONTENT_PR_STATUS | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | Y         | Y           |
| classic_signed                  | PAT_CONTENT_PR        | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | Y         | Y           |
| classic_signed                  | PAT_MIN               | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | U         | U           |
| classic_with_checks             | PAT_ADMIN             | present      | absent     | classic            | Y                  | Y               | Y          | Y          | Y             | Y          | N         | U           |
| no_usable_token                 | PAT_READONLY          | absent       | absent     | none               | N                  | N               | N          | N          | Y             | Y          | N         | U           |
| private_free                    | GH_TOKEN_ADMIN        | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| private_free                    | GH_TOKEN              | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| private_free                    | PAT_ADMIN             | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| private_free                    | PAT_CONTENT_PR_STATUS | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| private_free                    | PAT_CONTENT_PR        | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| private_free                    | PAT_MIN               | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | Y             | Y          | U         | U           |
| private_free                    | PAT_BAD               | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | U             | U          | U         | U           |
| private_free_readonly           | PAT_READ              | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| public_free_classicprotection   | GH_TOKEN_ADMIN        | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| public_free_classicprotection   | GH_TOKEN              | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| public_free_classicprotection   | PAT_ADMIN             | present      | absent     | classic            | Y                  | Y               | Y          | Y          | Y             | Y          | N         | Y           |
| public_free_classicprotection   | PAT_CONTENT_PR_STATUS | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| public_free_classicprotection   | PAT_CONTENT_PR        | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| public_free_classicprotection   | PAT_MIN               | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | U         | U           |
| public_free_classicprotection   | PAT_BAD               | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | U             | U          | U         | U           |
| public_free_noprotection        | GH_TOKEN              | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| public_free_noprotection        | PAT_ADMIN             | absent       | absent     | none               | N                  | N               | N          | N          | Y             | Y          | N         | Y           |
| public_free_noprotection        | PAT_CONTENT_PR_STATUS | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| public_free_noprotection        | PAT_CONTENT_PR        | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | N         | Y           |
| public_free_noprotection        | PAT_MIN               | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | U         | U           |
| public_free_noprotection        | PAT_BAD               | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | U             | U          | U         | U           |
| public_free_ruleprotection      | GH_TOKEN              | unreadable   | present    | rules              | Y                  | Y               | Y          | Y          | Y             | Y          | N         | Y           |
| public_free_ruleprotection      | PAT_ADMIN             | absent       | present    | rules              | Y                  | Y               | Y          | Y          | Y             | Y          | N         | Y           |
| public_free_ruleprotection      | PAT_CONTENT_PR_STATUS | unreadable   | present    | rules              | Y                  | Y               | Y          | Y          | Y             | Y          | N         | Y           |
| public_free_ruleprotection      | PAT_CONTENT_PR        | unreadable   | present    | rules              | Y                  | Y               | Y          | Y          | Y             | Y          | N         | Y           |
| public_free_ruleprotection      | PAT_MIN               | unreadable   | present    | rules              | Y                  | Y               | Y          | Y          | Y             | Y          | U         | U           |
| public_free_ruleprotection      | PAT_BAD               | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | U             | U          | U         | U           |
| rules_codescan_signed           | PAT_BAD               | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | U             | U          | U         | U           |
| rules_codescan_signed           | PAT_ADMIN             | absent       | absent     | none               | N                  | N               | N          | N          | Y             | Y          | Y         | Y           |
| rules_codescan_signed           | PAT_CONTENT_PR_STATUS | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | Y         | Y           |
| rules_codescan_signed           | PAT_CONTENT_PR        | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | Y         | Y           |
| rules_codescan_signed           | PAT_MIN               | unreadable   | absent     | unknown            | U                  | U               | U          | U          | Y             | Y          | U         | U           |
| rules_real                      | PAT_BAD               | unreadable   | unreadable | unknown            | U                  | U               | U          | U          | U             | U          | U         | U           |
| rules_real                      | PAT_ADMIN             | absent       | present    | rules              | Y                  | Y               | Y          | N          | Y             | Y          | N         | Y           |
| rules_real                      | PAT_CONTENT_PR_STATUS | unreadable   | present    | rules              | Y                  | Y               | Y          | N          | Y             | Y          | N         | Y           |
| rules_real                      | PAT_CONTENT_PR        | unreadable   | present    | rules              | Y                  | Y               | Y          | N          | Y             | Y          | N         | Y           |
| rules_real                      | PAT_MIN               | unreadable   | present    | rules              | Y                  | Y               | Y          | N          | Y             | Y          | U         | U           |
| rules_with_checks_and_approvals | PAT_ADMIN             | absent       | present    | rules              | Y                  | Y               | Y          | Y          | Y             | Y          | N         | U           |
| squash_disabled                 | PAT_ADMIN             | absent       | absent     | none               | N                  | N               | N          | N          | Y             | Y          | Y         | N           |

### Evidence Mapping & Heuristics

Protection endpoint interpretation rules (applied per token independently):

1. classicState present if classic endpoint 200 with a non-empty protection object; absent if 404/"Branch not protected"/"Branch protection not enabled"; unreadable if 401 or 403 without an allow-list message implying plan absence.
2. rulesState present if rules endpoint 200 with non-empty array; absent if 200 with empty array OR 404; unreadable if 401 or 403.
3. combinedProtection assembled from present endpoints (both => classic+rules). If neither present and at least one unreadable => unknown; if both absent => none.
4. branchProtectionYN collapses combinedProtection: Y when combinedProtection not none/unknown; N when combinedProtection none; U when combinedProtection unknown.
5. reqStatusChecks Y if any readable endpoint shows status checks contexts >0 (classic) or a rules entry referencing required_status_checks; N if endpoints readable but none; U if unreadable.
6. statusCtxs Y if contexts list length >0; N if readable & length 0; U if unreadable.
7. prRequired Y if classic indicates PR requirement or rules include pull_request; N if readable absence; U otherwise.

403 message heuristics presently treated as absence (count as absent, not unreadable) only when they clearly indicate plan/feature unavailability and there is no contradictory rules presence:

- "Resource not accessible by integration" (Actions/GitHub App plan gating)
- "Upgrade to GitHub Pro" (plan gating)
- "Branch not protected" / "Branch protection not enabled" (explicit absence)

Ambiguous 403 texts default to unreadable.

### Coverage Gaps (Need Additional Captures)

- Classic protection present with 0 required status contexts (currently only rules 0-context cases; need a classic 200 with empty contexts scenario).
- Rules protection scenario with status checks rule but explicitly no pull_request rule is represented (rules_real) but confirm at least one where pull_request rule exists yet status checks absent (rules_with_checks_and_approvals currently shows both; need inverse combination).
- Additional tokens with partial scope (e.g., status-only) could further disambiguate minimal permission thresholds.

### Next Possible Enhancements

- Add requiredApprovals tri-state column once raw evidence for review requirements is consistently captured.
- Provide an aggregated per-token capability summary generated mechanically from this table.
- Automate heuristic pattern unit tests to lock classification stability.

## Recording Guidelines

1. Run capability assessment once per token (isolated) to avoid cross-token contamination.
2. Mark branchProtection as U only if both endpoints deny (403/404) and no successful 200 observed.
3. Mark requiredStatusChecksEnabled = F when endpoints accessible and either disabled or no contexts; mark U only if protection unreadable.
4. Leave requiredStatusCheckContexts blank (U) unless an actual non-empty list is obtained.
5. prRequired = U if neither classic nor rules data surfaces PR requirement.

## Notes / Anomalies

## Minimal Test Targets (Ground Truth Oriented)

This condensed table lists only the lean scenarios required to exercise protection type, status checks presence, PR requirement, and mutation flags. Rows marked TODO are not yet captured.

| Scenario                        | ProtectionType | StatusChecks | PRRequired | AutoMerge | Squash | Present? | Notes                                                       |
| ------------------------------- | -------------- | ------------ | ---------- | --------- | ------ | -------- | ----------------------------------------------------------- |
| public_free_noprotection        | none           | NA           | N          | N         | Y      | Yes      | Public none baseline                                        |
| automerge_enabled               | none           | NA           | N          | Y         | (U)    | Yes      | Auto-merge true without protection (allowSquash unreadable) |
| squash_disabled                 | none           | NA           | N          | Y         | N      | Yes      | Squash disabled independent of protection                   |
| classic_real                    | classic        | >0           | Y          | N         | Y      | Yes      | Classic with checks & PR requirement                        |
| classic_no_checks               | classic        | 0            | N          | (TBD)     | (TBD)  | TODO     | Need classic with 0 contexts and PR not required            |
| rules_real                      | rules          | >0           | N          | N         | Y      | Yes      | Rules checks only (no pull_request rule)                    |
| rules_pr_no_checks              | rules          | 0            | Y          | (TBD)     | (TBD)  | TODO     | Rules PR only, 0 contexts                                   |
| rules_with_checks_and_approvals | rules          | >0           | Y          | N         | (U)    | Yes      | Rules both PR + checks (approvals incidental)               |
| classic_rules_real              | classic+rules  | >0           | Y          | Y         | Y      | Yes      | Combined protection (both endpoints present)                |
| private_none_clean              | none           | NA           | N          | (TBD)     | (TBD)  | TODO     | Private explicit none (clean 404s)                          |

- PAT_BAD rows expected to remain unreadable across protection fields (credential gating).
- GH_TOKEN rows reflect GitHub Actions token permission model; variations show unreadable protection endpoints in these fixtures.
- Rows with combinedProtection classic despite rulesState absent verify that absence of rules data does not suppress classic detection.

## Ground Truth vs Token Observability Matrix

Purpose: Directly answer the two required questions per scenario & token without relying on implementation logic.

Definitions

- GroundTruthProtection: Scenario-level intended state (from manifest or TBD if not yet captured).
- ObservedProtection: Protection type the token can assert from raw endpoints (classic/rules/classic+rules/none/unknown/rules*). `rules*`indicates token sees rules present but cannot rule out classic due to unreadable classic endpoint (similarly`classic\*` if inverse were to appear).
- Conclusive: Yes only if token has fully observed all relevant endpoints to distinguish its ObservedProtection from other possibilities (see criteria below).

Conclusive Criteria

1. none: classic=absent AND rules=absent (both accessible).
2. classic: classic=present AND rules=absent (accessible) OR rules endpoint accessible & empty.
3. rules: rules=present AND classic=absent (accessible) OR classic endpoint 404/absent.
4. classic+rules: both present.
   Anything with unreadable endpoint blocking a necessary absence check => Not Conclusive.

Lean Scenarios (captured & TODO) — Tokens: PAT_ADMIN (anchor), PAT_CONTENT_PR_STATUS (intermediate), PAT_CONTENT_PR (reduced), PAT_MIN (minimal), PAT_BAD (invalid).

| Scenario                        | GroundTruthProtection | Token                 | ObservedProtection | Conclusive   | StatusChecks Seen | PRRequired Seen |
| ------------------------------- | --------------------- | --------------------- | ------------------ | ------------ | ----------------- | --------------- |
| public_free_noprotection        | none                  | PAT_ADMIN             | none               | Yes          | N                 | N               |
| public_free_noprotection        | none                  | PAT_CONTENT_PR_STATUS | unknown            | No           | U                 | U               |
| public_free_noprotection        | none                  | PAT_CONTENT_PR        | unknown            | No           | U                 | U               |
| public_free_noprotection        | none                  | PAT_MIN               | unknown            | No           | U                 | U               |
| public_free_noprotection        | none                  | PAT_BAD               | unknown            | No           | U                 | U               |
| automerge_enabled               | none                  | PAT_ADMIN             | none               | Yes          | N                 | N               |
| automerge_enabled               | none                  | PAT_CONTENT_PR_STATUS | (no capture)       | -            | -                 | -               |
| squash_disabled                 | none                  | PAT_ADMIN             | none               | Yes          | N                 | N               |
| classic_real                    | classic               | PAT_ADMIN             | classic            | Yes          | >0                | Y               |
| classic_real                    | classic               | PAT_CONTENT_PR_STATUS | unknown            | No           | U                 | U               |
| classic_real                    | classic               | PAT_CONTENT_PR        | unknown            | No           | U                 | U               |
| classic_real                    | classic               | PAT_MIN               | unknown            | No           | U                 | U               |
| classic_real                    | classic               | PAT_BAD               | unknown            | No           | U                 | U               |
| classic_no_checks (TODO)        | classic               | PAT_ADMIN             | (pending)          | -            | 0                 | N               |
| rules_real                      | rules                 | PAT_ADMIN             | rules              | Yes          | >0                | N               |
| rules_real                      | rules                 | PAT_CONTENT_PR_STATUS | rules              | No (rules\*) | >0                | N               |
| rules_real                      | rules                 | PAT_CONTENT_PR        | rules              | No (rules\*) | >0                | N               |
| rules_real                      | rules                 | PAT_MIN               | rules              | No (rules\*) | >0                | N               |
| rules_real                      | rules                 | PAT_BAD               | unknown            | No           | U                 | U               |
| rules_pr_no_checks (TODO)       | rules                 | PAT_ADMIN             | (pending)          | -            | 0                 | Y               |
| rules_with_checks_and_approvals | rules                 | PAT_ADMIN             | rules              | Yes          | >0                | Y               |
| rules_with_checks_and_approvals | rules                 | PAT_CONTENT_PR_STATUS | rules              | No (rules\*) | >0                | Y               |
| rules_with_checks_and_approvals | rules                 | PAT_CONTENT_PR        | rules              | No (rules\*) | >0                | Y               |
| rules_with_checks_and_approvals | rules                 | PAT_MIN               | rules              | No (rules\*) | >0                | Y               |
| classic_rules_real              | classic+rules         | PAT_ADMIN             | classic+rules      | Yes          | >0                | Y               |
| classic_rules_real              | classic+rules         | PAT_CONTENT_PR_STATUS | rules\*            | No           | >0                | Y               |
| classic_rules_real              | classic+rules         | PAT_CONTENT_PR        | rules\*            | No           | >0                | Y               |
| classic_rules_real              | classic+rules         | PAT_MIN               | rules\*            | No           | >0                | Y               |
| private_none_clean (TODO)       | none                  | PAT_ADMIN             | (pending)          | -            | NA                | N               |

Observations

- No current captures show a token misclassifying (producing an incorrect positive); limited tokens yield unknown or partial (rules\*).
- `rules*` rows highlight the necessity of classic endpoint readability to distinguish rules vs classic+rules.
- Missing scenarios (classic_no_checks, rules_pr_no_checks, private_none_clean) block completion of coverage for zero-context and private-none cases.

Action to Finish Dataset

1. Capture the three TODO scenarios (each with PAT_ADMIN + at least one reduced token) and fill pending cells.
2. Re-run derivation script; update this matrix only (other large tables can remain static for now).
3. Freeze lean scenario set; begin authoring tests directly from this matrix (ground truth vs token expectations).

## Per-Token Capability Summary (Aligned to Repository Info Fields)

Purpose: One row per token showing ability (not scenario outcomes) to conclusively read each tracked repository info field plus classic/rules endpoint visibility needed for branchProtection derivation.

Legend

- Y: Token can conclusively obtain this field’s value (at least one capture shows success and no structural scope barrier identified).
- N: Token cannot obtain (all captures unreadable/denied; scope inherently missing required endpoint).
- P: Partial / degraded: token can obtain a subset signal (e.g., rules only) but cannot distinguish all enum variants (applies only to branchProtection dimension).

Field Mapping

- branchProtection capability decomposed into: canSeeClassic, canDetectRulesProtection, canDistinguish (classic vs rules vs combined), canConfirmNoProtection (both endpoints readable and both absent so token can assert "no protection").
  Abbreviations in table: BP=branchProtection overall, Classic=canSeeClassic, Rules=canDetectRulesProtection, Dist=canDistinguish, None=canConfirmNoProtection, DefBr=defaultBranch, Vis=visibility (public/private), AutoM=autoMergeEnabled, Squash=allowSquashMerge, Checks=requiredStatusChecksEnabled, Ctxs=requiredStatusCheckContexts, PRReq=prRequired.
- requiredStatusCheckContexts: Y means token can list non-empty contexts when present; N if never readable; P if can detect enabled (via rule presence) but cannot list contexts (not used presently—no such case yet).

| Token                       | BP  | Classic | Rules | Dist | None | DefBr | Vis | AutoM | Squash | Checks         | Ctxs      | PRReq     | Notes                                                              |
| --------------------------- | --- | ------- | ----- | ---- | ---- | ----- | --- | ----- | ------ | -------------- | --------- | --------- | ------------------------------------------------------------------ |
| PAT_ADMIN                   | Y   | Y       | Y     | Y    | Y    | Y     | Y   | Y     | Y      | Y              | Y         | Y         | Full visibility; anchor token                                      |
| PAT_CONTENT_PR_STATUS       | P   | N       | Y     | N    | N    | Y     | Y   | Y     | Y      | Y (rules only) | Y (rules) | Y (rules) | Classic endpoint 403; rules readable; has statuses read permission |
| PAT_CONTENT_PR              | P   | N       | Y     | N    | N    | Y     | Y   | Y     | Y      | Y (rules only) | Y (rules) | Y (rules) | Same observable behavior; lacks explicit statuses permission       |
| PAT_MIN                     | P   | N       | Y     | N    | N    | Y     | Y   | (Y\*) | (Y\*)  | Y (rules only) | Y (rules) | Y (rules) | AutoMerge / Squash sometimes U; treat as generally readable -> Y\* |
| PAT_BAD                     | N   | N       | N     | N    | N    | N     | N   | N     | N      | N              | N         | N         | Invalid credentials / insufficient scopes                          |
| GH_TOKEN (non-admin)        | P   | N       | Y     | N    | N    | Y     | Y   | Y     | Y      | Y (rules)      | Y (rules) | Y (rules) | Public rules readable; classic 403                                 |
| GH_TOKEN_ADMIN (plan gated) | N   | N       | N     | N    | N    | Y     | Y   | N     | Y      | N              | N         | N         | Private plan gating blocks protection endpoints                    |

Clarifications

- Overall branchProtection: Y only if token can conclusively produce all enum outcomes; P if limited to subset (e.g., cannot separate rules vs classic+rules or confirm none); N if cannot read either endpoint.
- defaultBranch/visibility derived from repo metadata (always readable except for PAT_BAD). GH_TOKEN_ADMIN row still Y for these because metadata 200 even when protections gated.
- autoMergeEnabled / allowSquashMerge: Marked Y if at least one capture shows value readable; unresolved sporadic U does not downgrade unless consistently unreadable.
- PAT_MIN starred fields (Y\*) indicate partial evidence (one capture U, others Y); treat as Y for capability presence.

Test Guidance

1. Write tests asserting PAT_ADMIN positive for all Y fields.
2. Assert reduced tokens never return classic+rules classification nor confirm none.
3. Assert PAT_BAD yields all unknown/denied outcomes in assessment logic (resulting in undefined / false / gaps as appropriate).
4. Add future scenarios only if they could flip a current N/P to Y (scope improvement) or refine unknown vs absent heuristics.

### PAT_CONTENT_PR_STATUS vs PAT_CONTENT_PR

Current captured dataset shows no observable difference between these two tokens on the repository info fields tracked here. The only intended distinction is that PAT_CONTENT_PR_STATUS includes the GitHub fine‑grained "statuses" (read) permission, while PAT_CONTENT_PR does not. This permission does not affect any currently recorded endpoints, so they are treated as equivalent for capability evaluation.
