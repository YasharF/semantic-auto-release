#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import readline from "node:readline";

const run = (cmd) => execSync(cmd, { stdio: "inherit", shell: true });

const args = process.argv.slice(2);
const autoYes = args.includes("-y");
const createWorkflow = args.includes("--create-workflow");
const workflowNameArg = args.find((a) => a.startsWith("--workflow-name="));
const workflowName = workflowNameArg
  ? workflowNameArg.split("=")[1]
  : "semantic-auto-release.yml";

const plannedActions = [
  "Install and initialize husky if not present",
  "Add .husky/commit-msg hook pointing to @yasharf/semantic-auto-release/conventional-commits",
  "Add or verify commitlint config in package.json",
];
if (createWorkflow) {
  plannedActions.push(
    `Create GitHub Actions workflow: .github/workflows/${workflowName} with a monthly scheduled run`,
  );
}

const confirm = async () => {
  if (autoYes) return true;
  console.log("This setup will perform the following actions:");
  plannedActions.forEach((a) => console.log(`  - ${a}`));
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question("Proceed? (Y/N): ", (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
};

const ensureHusky = () => {
  try {
    require.resolve("husky");
    console.log("✅ husky is already installed");
  } catch {
    console.log("📦 Installing husky...");
    run("npm install --save-dev husky");
  }
  if (!fs.existsSync(".husky")) {
    console.log("📂 Initializing husky...");
    run("npx husky init");
  } else {
    console.log("✅ .husky directory already exists");
  }
};

const setupCommitMsgHook = () => {
  const hookPath = path.join(".husky", "commit-msg");
  const desiredLine =
    'npx @yasharf/semantic-auto-release/conventional-commits "$@"';
  if (!fs.existsSync(hookPath)) {
    console.log("✍️  Creating commit-msg hook...");
    fs.writeFileSync(hookPath, `#!/bin/sh\n${desiredLine}\n`);
    run(`chmod +x ${hookPath}`);
    return;
  }
  const content = fs.readFileSync(hookPath, "utf8");
  if (content.includes(desiredLine)) {
    console.log("✅ commit-msg hook already configured — no changes made");
    return;
  }
  console.error(`❌ Existing commit-msg hook found that does not reference semantic-auto-release.
Hook path: ${hookPath}
Script stopped to avoid overwriting your custom hook.
Actions completed so far:
  - Husky ensured
You will need to manually reconcile your commit-msg hook with:
  ${desiredLine}`);
  process.exit(1);
};

const setupCommitlintConfig = () => {
  const pkgPath = path.join(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const desiredConfig = {
    extends: ["@yasharf/semantic-auto-release/commitlint"],
  };
  if (!pkg.commitlint) {
    console.log("📝 Adding commitlint config...");
    pkg.commitlint = desiredConfig;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    return;
  }
  if (JSON.stringify(pkg.commitlint) === JSON.stringify(desiredConfig)) {
    console.log(
      "✅ commitlint config already matches expected settings — skipping",
    );
    return;
  }
  console.error(`❌ Existing commitlint config in package.json differs from semantic-auto-release defaults.
Script stopped to avoid overwriting your config.
Actions completed so far:
  - Husky is setup
  - commit-msg is setup
You will need to manually reconcile your commitlint config with:
${JSON.stringify(desiredConfig, null, 2)}`);
  process.exit(1);
};

const checkExistingWorkflowReference = () => {
  const workflowsDir = path.join(".github", "workflows");
  if (!fs.existsSync(workflowsDir)) return null;
  const files = fs
    .readdirSync(workflowsDir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  for (const file of files) {
    const fullPath = path.join(workflowsDir, file);
    const content = fs.readFileSync(fullPath, "utf8");
    if (content.includes("@yasharf/semantic-auto-release")) {
      return `.github/workflows/${file}`;
    }
  }
  return null;
};

const createWorkflowFile = (name) => {
  const workflowsDir = path.join(".github", "workflows");
  if (!fs.existsSync(workflowsDir))
    fs.mkdirSync(workflowsDir, { recursive: true });

  const existingRef = checkExistingWorkflowReference();
  if (existingRef) {
    console.log(`⚠️ Found existing workflow referencing @yasharf/semantic-auto-release: ${existingRef}
No new workflow created. Please review that file if you want to adjust its schedule or steps.`);
    return;
  }

  const workflowPath = path.join(workflowsDir, name);
  if (fs.existsSync(workflowPath)) {
    console.log(
      `⚠️ Workflow file ${workflowPath} already exists — skipping creation. Review it if you want to adjust schedule or steps.`,
    );
    return;
  }

  // Generate random schedule
  const randomDay = Math.floor(Math.random() * 28) + 1;
  const randomHour = Math.floor(Math.random() * 24);
  const randomMinute = Math.floor(Math.random() * 60);
  const cronExpr = `${randomMinute} ${randomHour} ${randomDay} * *`;

  console.log(`🛠 Creating workflow file: ${workflowPath}`);
  const yaml = `name: Semantic Auto Release

on:
  workflow_dispatch:
  schedule:
    - cron: "${cronExpr}"

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      packages: write
    env:
      HUSKY: 0
    steps:
      - name: Checkout
        uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: npm

      - name: Install dependencies
        run: npm ci

      # add other steps such as lint, test, type build, etc.

      - name: Run release script
        env:
          GITHUB_TOKEN: \${{ github.token }}
          GH_TOKEN: \${{ github.token }}
          NPM_TOKEN: \${{ secrets.NPM_TOKEN }}
          CHANGELOG_FILE: CHANGELOG.md
          RUN_PRETTIER_ON_CHANGELOG: true
        run: npx @yasharf/semantic-auto-release/run-release
`;

  fs.writeFileSync(workflowPath, yaml);
  console.log(`📅 Your release workflow is scheduled to run at ${String(randomHour).padStart(2, "0")}:${String(randomMinute).padStart(2, "0")} UTC on day ${randomDay} of each month.
You can edit your workflow file at ${workflowPath} to change the schedule or customize the workflow.`);
};

(async () => {
  const proceed = await confirm();
  if (!proceed) {
    console.log("❌ Setup aborted by user.");
    process.exit(0);
  }
  ensureHusky();
  setupCommitMsgHook();
  setupCommitlintConfig();
  if (createWorkflow) createWorkflowFile(workflowName);

  console.log("\n🎉 Setup complete!\n");
  console.log("Next steps:");
  console.log(
    "  1. Add NPM_TOKEN to your repository secrets (must have publish rights).",
  );
  console.log(
    "     GitHub → Settings → Secrets and variables → Actions → New repository secret",
  );
  console.log("     Name: NPM_TOKEN");
  console.log(
    "  2. Enable PR creation permissions in GitHub Actions settings:",
  );
  console.log(
    "     Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests",
  );
  console.log(
    "  3. (Optional) Protect your default branch and require pull requests to ensure only validated changes are merged.",
  );
  console.log("  4. Review the generated workflow file in .github/workflows/");
  console.log("     - Adjust schedule, steps, or job names if needed.");
  console.log(
    "  5. Commit and push the changes from this setup script to your GitHub repository.",
  );
})();
