#!/usr/bin/env node

const { spawnSync, spawn } = require("child_process");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createReleaseRunner({
  spawnSyncImpl = spawnSync,
  spawnImpl = spawn,
  logger = console,
  exit = (code) => process.exit(code),
  pollAttempts = 15,
  pollIntervalMs = 2000,
} = {}) {
  function run(cmd, args, options = {}) {
    const result = spawnSyncImpl(cmd, args, {
      stdio: options.stdio || "pipe",
      encoding: "utf8",
      ...options,
    });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      const stderr = result.stderr?.trim() || "";
      throw new Error(
        `Command failed: ${cmd} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`,
      );
    }
    return result.stdout ? result.stdout.trim() : "";
  }

  function ensureGhAvailable() {
    run("gh", ["--version"]);
  }

  function ensureGhAuthenticated() {
    try {
      run("gh", ["auth", "status", "--hostname", "github.com"], {
        stdio: "inherit",
      });
    } catch (error) {
      logger.error(
        "GitHub CLI authentication required. Run `gh auth login --scopes workflow` and retry.",
      );
      exit(1);
    }
  }

  function getRepository() {
    try {
      const output = run("gh", [
        "repo",
        "view",
        "--json",
        "nameWithOwner",
        "--jq",
        ".nameWithOwner",
      ]);
      if (!output) {
        throw new Error("Empty repository value");
      }
      return output;
    } catch (error) {
      logger.error(
        "Unable to determine repository via `gh repo view`. Ensure you are in a cloned GitHub repository.",
      );
      throw error;
    }
  }

  function getCurrentBranch() {
    try {
      const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
      if (!branch) {
        throw new Error("No branch detected");
      }
      return branch;
    } catch (error) {
      logger.error(
        "Failed to determine current branch via git. Ensure you have a Git repository cloned.",
      );
      throw error;
    }
  }

  function triggerWorkflow(ref) {
    const args = ["workflow", "run", "start-release.yml", "--ref", ref];
    run("gh", args);
  }

  function parseRepo(repo) {
    try {
      const [owner, name] = repo.split("/");
      if (!owner || !name) {
        throw new Error("Invalid repository string");
      }
      return { owner, name };
    } catch (error) {
      logger.error("Unable to determine repository slug.");
      throw error;
    }
  }

  function fetchLatestWorkflowRun(repo, ref) {
    const { owner, name } = parseRepo(repo);
    const output = run("gh", [
      "api",
      `repos/${owner}/${name}/actions/workflows/start-release.yml/runs`,
      "-f",
      `per_page=1`,
      "-f",
      `branch=${ref}`,
    ]);
    const data = JSON.parse(output);
    if (!data.workflow_runs || data.workflow_runs.length === 0) {
      return null;
    }
    return data.workflow_runs[0];
  }

  async function waitForWorkflowRun(repo, ref, startedAt) {
    for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
      try {
        const runInfo = fetchLatestWorkflowRun(repo, ref);
        if (runInfo) {
          const createdAt = Date.parse(runInfo.created_at || 0);
          if (!Number.isNaN(createdAt) && createdAt >= startedAt - 5000) {
            return runInfo;
          }
        }
      } catch (error) {
        logger.warn(
          `Unable to fetch workflow run metadata (attempt ${attempt + 1}/${pollAttempts}).`,
        );
      }

      if (attempt < pollAttempts - 1) {
        await sleep(pollIntervalMs);
      }
    }

    throw new Error("Timed out waiting for workflow run to start.");
  }

  function watchWorkflow(runId) {
    return new Promise((resolve, reject) => {
      const watcher = spawnImpl("gh", ["run", "watch", String(runId)], {
        stdio: "inherit",
      });
      watcher.on("error", reject);
      watcher.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`gh run watch exited with code ${code}`));
        }
      });
    });
  }

  function viewSummary(runId, repo) {
    try {
      const { owner, name } = parseRepo(repo);
      const summary = run("gh", [
        "api",
        `repos/${owner}/${name}/actions/runs/${runId}`,
      ]);
      const data = JSON.parse(summary);
      return {
        status: data.status,
        conclusion: data.conclusion,
        url: data.html_url,
        title: data.display_title,
      };
    } catch (error) {
      logger.warn(
        "Unable to fetch run summary. The workflow run may have been deleted.",
      );
      return null;
    }
  }

  async function execute() {
    try {
      ensureGhAvailable();
      ensureGhAuthenticated();

      const repo = getRepository();
      const ref = getCurrentBranch();

      logger.log(`Triggering start-release.yml for ${repo}@${ref}...`);
      const startedAt = Date.now();
      triggerWorkflow(ref);
      const runInfo = await waitForWorkflowRun(repo, ref, startedAt);
      logger.log(`Workflow run started: ${runInfo.html_url}`);

      await watchWorkflow(runInfo.id);

      const summary = viewSummary(runInfo.id, repo);
      if (summary) {
        logger.log(
          `Workflow completed with status ${summary.status} (${summary.conclusion}). Details: ${summary.url}`,
        );
        if (summary.title) {
          logger.log(`Run title: ${summary.title}`);
        }
      }
    } catch (error) {
      logger.error("Failed to trigger release workflow:");
      logger.error(error.message || error);
      exit(1);
    }
  }

  return {
    run,
    ensureGhAvailable,
    ensureGhAuthenticated,
    getRepository,
    getCurrentBranch,
    triggerWorkflow,
    watchWorkflow,
    viewSummary,
    execute,
    fetchLatestWorkflowRun,
    waitForWorkflowRun,
  };
}

module.exports = { createReleaseRunner };

if (require.main === module) {
  const runner = createReleaseRunner();
  runner.execute();
}
