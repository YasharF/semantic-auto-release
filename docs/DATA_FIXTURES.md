# Recorded API Snapshots & Usage

The project includes recorded GitHub API scenario responses intended for offline tests and deterministic validation. These are not a guaranteed stable schema; they can evolve as required endpoints change.

## Locations

All scenario JSON fixtures now reside under: `test/fixtures/scenarios/`

| Subdirectory                     | Scenario Type                                     |
| -------------------------------- | ------------------------------------------------- |
| `private_free/`                  | Private repo (Free plan) protections & metadata   |
| `public_free_classicprotection/` | Public repo (Free) with classic branch protection |
| `public_free_noprotection/`      | Public repo (Free) with no protection             |
| `public_free_ruleprotection/`    | Public repo (Free) with rules-based protection    |
| `classic_real/`                  | Real capture: classic protection (status checks)  |
| `rules_real/`                    | Real capture: rules protection (status checks)    |
| `automerge_real/`                | Real capture: auto-merge enabled flag             |
| `classic_rules_real/`            | Real capture: classic + rules simultaneously      |

## File Sequence per Scenario

1. `step1_main_branch.json`
2. `step2_classic_protection.json`
3. `step3_rules_protection.json`
4. `step4_branch_metadata.json`
5. `step5_permissions_info.json`
6. `step6_branch_list.json`

## Test Usage Pattern

- Unit tests import only minimal pieces needed.
- Integration tests may load a directory into an in-memory map keyed by step.
- A helper may expose `loadScenario(name)` returning:

```
{
  mainBranch,
  classicProtection,
  rulesProtection,
  branchMetadata,
  permissionsInfo,
  branchList
}
```

## Future Enhancements

- Regenerate fixtures script (`scripts/record-fixture.js`).
- Optional checksum file for integrity.
- Optional schema validation.

---

Updated after relocation (2025-09-08)
