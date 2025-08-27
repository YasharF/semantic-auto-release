# @yasharf/semantic-autorelease

Self‑contained semantic‑release + Conventional Commits automation, with a reusable GitHub Actions workflow for org‑wide zero‑drift releases.

## 🚀 Features
- Fully bundled semantic‑release toolchain (no extra installs needed in consumers)
- Commitlint rules for Conventional Commits
- Auto‑bump `package.json`, update `CHANGELOG.md`, publish to npm, create GitHub release
- Reusable workflow for any repo in your org
- Self‑dogfoods — this package releases itself using its own workflow

## 📦 Installation (for consuming repos)
npm install --save-dev @sinonjs/semantic-autorelease  
*(Replace scope with @yasharf if testing before transfer.)*

## ⚡ Usage (in a consumer repo)
1. Create `.github/workflows/auto_release.yml`:

   name: Org Release  
   on:  
     workflow_dispatch:  
     schedule:  
       - cron: '0 0 1 * *'  

   jobs:  
     release:  
       uses: sinonjs/semantic-autorelease/.github/workflows/release.yml@v1  
       secrets: inherit

2. Ensure the repo has `GITHUB_TOKEN` (default) and `NPM_TOKEN` secrets set.

## 🔒 Branch Protection Setup

### Option 1 — Allow Direct Push from Workflow
- In branch protection for your release branch:
  - Enable "Allow GitHub Actions to bypass required pull requests" **or**  
    "Allow specified actors to push" (and choose workflows).
- This allows the workflow to commit version/changelog changes directly.

### Option 2 — PR Mode (No Direct Push Rights)
If you cannot allow direct pushes:
1. Use a `bump_and_pr.yml` workflow that:
   - Runs semantic‑release in prepare‑only mode.
   - Creates a branch with updated version and changelog.
   - Opens a PR to your protected release branch.
2. Review and merge the PR.
3. A `publish_after_merge.yml` workflow runs semantic‑release in publish‑only mode after merge, creating the GitHub release and publishing to npm.

## 🛠 Local Development
- Lint: `npm run lint`
- Format: `npm run prettier:write`
- Dry‑run release: `npx semantic-release --dry-run`


## 📄 License
[LICENSE]
