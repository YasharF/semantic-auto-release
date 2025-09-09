These tests exercised the old shell-script based release pipeline (run-release.sh, update-version.js, write-changes-md.js).

They are retained for historical reference but are excluded from active test runs after the TypeScript orchestrator refactor.

Files:

- run-release-sh.integration.test.js
- update-version.integration.test.js
- write-changes-md.integration.test.js

If you need to re-run them temporarily, you can copy them back under the root `test/` directory or invoke mocha directly pointing at this folder.
