# PR Checks Experiment Report

Repository: YasharF/semantic-auto-release
Base branch: nextVer
PR Number: 142
PR URL: https://github.com/YasharF/semantic-auto-release/pull/142

## Timeline

| Round | Timestamp                | Combined State | Check Runs (name:status:conclusion)                                                              |
| ----- | ------------------------ | -------------- | ------------------------------------------------------------------------------------------------ |
| 1     | 2025-09-09T20:20:11.150Z | pending        |
| 2     | 2025-09-09T20:20:32.676Z | pending        | PR Title Check:in_progress:<br>fast-check:completed:success<br>slow-check:in_progress:           |
| 3     | 2025-09-09T20:20:54.426Z | pending        | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:      |
| 4     | 2025-09-09T20:21:15.958Z | pending        | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:      |
| 5     | 2025-09-09T20:21:37.580Z | pending        | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:      |
| 6     | 2025-09-09T20:21:59.093Z | pending        | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:      |
| 7     | 2025-09-09T20:22:20.711Z | pending        | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:      |
| 8     | 2025-09-09T20:22:42.250Z | pending        | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:      |
| 9     | 2025-09-09T20:23:03.734Z | pending        | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:      |
| 10    | 2025-09-09T20:23:25.312Z | pending        | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:completed:success |

## Alt Token Comparison

No differences expected; below for verification.
Round | Alt Combined State | Alt Check Runs
----- | ------------------ | --------------
1 | pending |
2 | pending | PR Title Check:in_progress:<br>fast-check:completed:success<br>slow-check:in_progress:
3 | pending | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:
4 | pending | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:
5 | pending | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:
6 | pending | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:
7 | pending | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:
8 | pending | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:
9 | pending | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:in_progress:
10 | pending | PR Title Check:completed:failure<br>fast-check:completed:success<br>slow-check:completed:success

## Observations

- fast-check finished early; slow-check remained queued/in_progress until completion.
- combined status remained pending until the final round when both checks completed.
- No divergence between primary and alt tokens for read operations (as expected).

## Tokens Used (names only)

Primary: PAT_CONTENT_PR
Alt: PAT_CONTENT_PR_STATUS
