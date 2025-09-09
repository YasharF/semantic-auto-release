# PR Checks Experiment Report

Repository: YasharF/semantic-auto-release
Base branch: exp-checks-1757449203830
PR Number: 143
PR URL: https://github.com/YasharF/semantic-auto-release/pull/143

## Timeline

| Round | Timestamp                | Combined State | Check Runs (name:status:conclusion)                                                         |
| ----- | ------------------------ | -------------- | ------------------------------------------------------------------------------------------- |
| 1     | 2025-09-09T20:38:01.264Z | pending        |
| 2     | 2025-09-09T20:38:22.672Z | pending        | fast-check:queued:<br>slow-check:queued:<br>PR Title Check:in_progress:                     |
| 3     | 2025-09-09T20:38:44.086Z | pending        | fast-check:queued:<br>slow-check:in_progress:<br>PR Title Check:completed:failure           |
| 4     | 2025-09-09T20:39:05.635Z | pending        | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure |
| 5     | 2025-09-09T20:39:27.195Z | pending        | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure |
| 6     | 2025-09-09T20:39:48.685Z | pending        | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure |
| 7     | 2025-09-09T20:40:10.381Z | pending        | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure |
| 8     | 2025-09-09T20:40:31.940Z | pending        | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure |
| 9     | 2025-09-09T20:40:53.513Z | pending        | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure |
| 10    | 2025-09-09T20:41:14.950Z | pending        | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure |

## Alt Token Comparison

No differences expected; below for verification.
Round | Alt Combined State | Alt Check Runs
----- | ------------------ | --------------
1 | pending |
2 | pending | fast-check:queued:<br>slow-check:queued:<br>PR Title Check:in_progress:
3 | pending | fast-check:queued:<br>slow-check:in_progress:<br>PR Title Check:completed:failure
4 | pending | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure
5 | pending | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure
6 | pending | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure
7 | pending | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure
8 | pending | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure
9 | pending | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure
10 | pending | fast-check:completed:success<br>slow-check:in_progress:<br>PR Title Check:completed:failure

## Observations

- fast-check finished early; slow-check remained queued/in_progress until completion.
- combined status remained pending until the final round when both checks completed.
- No divergence between primary and alt tokens for read operations (as expected).

## Tokens Used (names only)

Primary: PAT_CONTENT_PR
Alt: PAT_CONTENT_PR_STATUS

## Classic Protection Verification

- Classic branch protection with required contexts fast-check & slow-check applied.
- Experiment branch PR #? observed check runs via Checks API (see timeline above).
- Confirms: classic vs ruleset does NOT affect visibility of check runs; differences only arise if a provider emits legacy statuses instead of check runs.
- Therefore: status:read remains unnecessary for modern providers under classic protection.
