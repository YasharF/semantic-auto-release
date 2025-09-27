# Token Scenario Manifest

Purpose: Human-readable description of each fixture scenario capturing (a) intended repository ground-truth state and (b) which edge / distinction it is meant to cover. This isolates scenario intent from per‑token observability so we can detect drift and missing coverage.

Columns

- Scenario: Directory name under `test/fixtures/scenarios/`
- GroundTruthProtection: none | classic | rules | classic+rules
- KeySignals: Concise list of expected raw signals (e.g., classic:statusChecks>0, rules:pull_request+required_status_checks, squashDisabled, autoMergeOn)
- EdgeFocus: Why this scenario exists (unique rationale)
- Keep?: yes/no (mark `no` when eventually redundant after new scenarios added)
- GapsAddressed: Which coverage gap checklist items this scenario satisfies

| Scenario                        | GroundTruthProtection | KeySignals                                    | EdgeFocus                    | Keep? | GapsAddressed             |
| ------------------------------- | --------------------- | --------------------------------------------- | ---------------------------- | ----- | ------------------------- |
| public_free_noprotection        | none                  | endpoints absent                              | Public none baseline         | yes   | none-baseline             |
| automerge_enabled               | none                  | autoMergeEnabled=true                         | None + auto-merge positive   | yes   | auto-merge                |
| squash_disabled                 | none                  | allowSquashMerge=false                        | None + squash disabled       | yes   | squash-disabled           |
| classic_real                    | classic               | classic:checks>0, prRequired                  | Classic with checks + PR     | yes   | classic-baseline          |
| classic_no_checks (TODO)        | classic               | classic:checks=0, prRequired=false            | Classic minimal (0 contexts) | yes   | classic-zero-contexts     |
| rules_real                      | rules                 | rules:status_checks, no pull_request          | Rules checks only (no PR)    | yes   | rules-no-pr-rule          |
| rules_pr_no_checks (TODO)       | rules                 | rules:pull_request, no status_checks          | Rules PR only (0 contexts)   | yes   | rules-pr-no-checks        |
| rules_with_checks_and_approvals | rules                 | rules:pull_request+status_checks              | Rules both PR + checks       | yes   | rules-pr-and-checks       |
| classic_rules_real              | classic+rules         | both present, checks in both                  | Combined classic + rules     | yes   | combined-protection       |
| private_none_clean (TODO)       | none                  | private 404 both endpoints                    | Private none baseline        | yes   | private-none              |
| private_free                    | unknown               | 403 plan gating                               | Plan-gated unreadable sample | no    | plan-gating               |
| private_free_readonly           | unknown               | 403 read-only gating                          | Plan-gated read-only         | no    | plan-gating-readonly      |
| automerge_real                  | rules                 | rules:status_checks (duplicate of rules_real) | Redundant rules-only         | no    | duplicate                 |
| public_free_classicprotection   | classic               | classic present                               | Duplicate classic (public)   | no    | duplicate                 |
| public_free_ruleprotection      | rules                 | rules:pull_request+status_checks              | Duplicate rules both         | no    | duplicate                 |
| classic_with_checks             | classic               | classic:checks>0                              | Duplicate of classic_real    | no    | duplicate                 |
| classic_signed                  | classic               | classic:checks>0 + signatures meta            | Redundant (ignored signals)  | no    | redundant-signatures      |
| classic_rules_codescan_signed   | classic               | classic:checks>0 + ignored extras             | Redundant (ignored extras)   | no    | deprecated-extra-fields   |
| rules_codescan_signed           | none                  | absence + ignored extras                      | Redundant none variant       | no    | redundant-none            |
| no_usable_token                 | none                  | unreadable tokens scenario                    | Token unreadability baseline | no    | unreadable-token-baseline |

## Coverage Gap Checklist (Lean Objectives)

- [ ] classic 200 with 0 contexts (classic_no_checks)
- [ ] rules only with pull_request rule but NO required_status_checks (rules_pr_no_checks)
- [ ] private repo explicit none (private_none_clean) (both endpoints 404)
- [ ] optional: rules only minimal (neither pull_request nor status_checks) (future)
- [ ] optional: combined classic+rules where classic has 0 contexts (future)
- [ ] optional: token variant status-only (future)

## Next Steps (Minimal)

1. Capture only missing TODO scenarios (classic_no_checks, rules_pr_no_checks, private_none_clean).
2. Update matrix rows; verify PAT_ADMIN lines reflect ground truth for each.
3. Write minimal tests after capture to assert protection classification + observability (PAT_ADMIN vs reduced tokens).

## Drift Detection (Deferred)

Lightweight manual review sufficient for now; automated JSON export deferred.
