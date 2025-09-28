#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const readline = require("readline");

const PROJECT_ROOT = process.cwd();
const HUSKY_DIR = path.join(PROJECT_ROOT, ".husky");
const WORKFLOW_DIR = path.join(PROJECT_ROOT, ".github", "workflows");
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, "package.json");

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);

const options = {
  yes: args.has("-y") || args.has("--yes"),
  includeWorkflows: args.has("--include-workflows") || args.has("--workflows"),
  legacyWorkflow: args.has("--create-workflow"),
  workflowName:
    rawArgs
      .find((value) => value.startsWith("--workflow-name="))
      ?.split("=")[1] || "auto-release.yml",
};

function resolveTemplate(name) {
  const templatePath = path.join(__dirname, "..", ".github", "workflows", name);
  try {
    return fs.readFileSync(templatePath, "utf8");
  } catch {
    return null;
  }
}

function defaultAutoReleaseTemplate() {
  return `# semantic-auto-release
# This is a placeholder because the workflow template was not bundled with the package.
# Copy the latest auto-release workflow from:
# https://github.com/YasharF/semantic-auto-release/blob/main/.github/workflows/auto-release.yml
`;
}

function defaultChecksTemplate() {
  return `# semantic-auto-release
# This is a placeholder because the checks workflow template was not bundled with the package.
# Copy the latest checks workflow from:
# https://github.com/YasharF/semantic-auto-release/blob/main/.github/workflows/checks.yml
`;
}

function buildWorkflowTargets() {
  if (options.includeWorkflows) {
    return [
      {
        filename: "auto-release.yml",
        description: "Auto-release workflow",
        content:
          resolveTemplate("auto-release.yml") || defaultAutoReleaseTemplate(),
      },
      {
        filename: "checks.yml",
        description: "Reusable checks workflow",
        content: resolveTemplate("checks.yml") || defaultChecksTemplate(),
      },
    ];
  }

  if (options.legacyWorkflow) {
    const filename = options.workflowName || "auto-release.yml";
    return [
      {
        filename,
        description: `Auto-release workflow (${filename})`,
        content:
          resolveTemplate("auto-release.yml") || defaultAutoReleaseTemplate(),
      },
    ];
  }

  return [];
}

const WORKFLOW_TARGETS = buildWorkflowTargets();

const ACTIONS = [
  "Ensure Husky is installed and initialized",
  "Add semantic-auto-release commit-msg hook",
  "Add commitlint configuration extending semantic-auto-release defaults",
];

if (WORKFLOW_TARGETS.length > 0) {
  for (const target of WORKFLOW_TARGETS) {
    ACTIONS.push(`Create ${target.filename} (${target.description})`);
  }
}

const COMMIT_MSG_TEMPLATE = `#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Checking commit message format (Conventional Commits enforced)"
echo "💥 Reminder: For breaking changes, include 'BREAKING CHANGE:' in the commit body to trigger major version bumps"
npx --no-install commitlint --edit "$1"
`;

function runCommand(command) {
  try {
    execSync(command, { stdio: "inherit", shell: true });
  } catch (error) {
    const message = error && error.stderr ? `\n${error.stderr.toString()}` : "";
    throw new Error(`Command failed: ${command}${message}`);
  }
}

async function confirmOrAbort() {
  if (options.yes) {
    return true;
  }

  console.log("This setup will perform the following actions:");
  for (const action of ACTIONS) {
    console.log(`  • ${action}`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Proceed? (y/N): ", (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

function ensurePackageJson() {
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    throw new Error("package.json not found in the current directory.");
  }
}

function ensureHusky() {
  try {
    require.resolve("husky");
    console.log("✅ Husky already installed");
  } catch {
    console.log("📦 Installing Husky...");
    runCommand("npm install --save-dev husky");
  }

  if (!fs.existsSync(HUSKY_DIR)) {
    console.log("📂 Initializing Husky...");
    runCommand("npx husky init");
  } else {
    console.log("✅ Husky directory already exists");
  }
}

function ensureCommitMsgHook() {
  if (!fs.existsSync(HUSKY_DIR)) {
    throw new Error("Husky directory is missing. Run husky init first.");
  }

  const hookPath = path.join(HUSKY_DIR, "commit-msg");
  if (!fs.existsSync(hookPath)) {
    console.log("✍️  Creating .husky/commit-msg hook...");
    fs.writeFileSync(hookPath, COMMIT_MSG_TEMPLATE);
    fs.chmodSync(hookPath, 0o755);
    return;
  }

  const currentContent = fs.readFileSync(hookPath, "utf8");
  if (currentContent.trim() === COMMIT_MSG_TEMPLATE.trim()) {
    console.log("✅ commit-msg hook already configured");
    return;
  }

  console.error(
    "❌ Existing commit-msg hook found. Please merge the following content manually:\n",
  );
  console.error(COMMIT_MSG_TEMPLATE);
  throw new Error(
    ".husky/commit-msg was left unchanged to avoid overwriting custom logic.",
  );
}

function ensureCommitlintConfig() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  const desired = {
    extends: ["@yasharf/semantic-auto-release/commitlint"],
  };

  if (!pkg.commitlint) {
    console.log("📝 Adding commitlint configuration to package.json...");
    pkg.commitlint = desired;
  } else if (JSON.stringify(pkg.commitlint) !== JSON.stringify(desired)) {
    console.error(
      "❌ Existing commitlint configuration differs from expected.",
    );
    console.error("Please update your package.json commitlint section to:");
    console.error(JSON.stringify(desired, null, 2));
    throw new Error("Commitlint configuration not updated automatically.");
  } else {
    console.log("✅ commitlint configuration already matches expectations");
    return;
  }

  fs.writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(pkg, null, 2)}\n`);
}

function ensureWorkflowFiles() {
  if (WORKFLOW_TARGETS.length === 0) {
    return [];
  }

  fs.mkdirSync(WORKFLOW_DIR, { recursive: true });
  const created = [];

  for (const target of WORKFLOW_TARGETS) {
    const destination = path.join(WORKFLOW_DIR, target.filename);

    if (fs.existsSync(destination)) {
      console.log(`⚠️  ${target.filename} already exists — skipped`);
      continue;
    }

    fs.writeFileSync(destination, target.content);
    created.push(target.filename);
    console.log(`🛠  Created .github/workflows/${target.filename}`);
  }

  return created;
}

function printNextSteps(createdWorkflows) {
  console.log("\n🎉 Setup complete!");
  console.log("Next steps:");
  console.log(
    "  1. Enable GitHub Actions workflow permissions (Settings → Actions → General → Workflow permissions → Read and write, then enable PR approvals).",
  );
  if (createdWorkflows.length > 0) {
    console.log(
      `  2. Review the generated workflow file(s): ${createdWorkflows
        .map((name) => `.github/workflows/${name}`)
        .join(", ")}.`,
    );
    console.log(
      "     • Confirm the schedule and referenced npm scripts match your project.",
    );
    console.log(
      "     • If placeholders were created, replace them with the latest templates from the semantic-auto-release repository.",
    );
  }
  console.log(
    "  3. Protect your default branch (require pull requests, status checks, and administrators).",
  );
  console.log("  4. Commit and push the changes produced by this script.");
  console.log(
    "  5. When ready, trigger the auto-release workflow via GitHub's UI to verify your configuration.",
  );
  console.log("");
}

(async function main() {
  try {
    ensurePackageJson();
    const proceed = await confirmOrAbort();
    if (!proceed) {
      console.log("Setup cancelled.");
      process.exit(0);
    }

    ensureHusky();
    ensureCommitMsgHook();
    ensureCommitlintConfig();
    const created = ensureWorkflowFiles();
    printNextSteps(created);
  } catch (error) {
    console.error("\n❌ Setup failed:");
    console.error(error.message || error);
    process.exit(1);
  }
})();
