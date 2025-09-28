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
  let scopeRefreshAttempted = false;
  const WORKFLOW_PATH = ".github/workflows/start-release.yml";
  const GH_API_ACCEPT_HEADER = "Accept: application/vnd.github+json";

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

  function handleWorkflowScopeError(error) {
    const message = error?.message || "";
    if (
      /workflow scope/i.test(message) ||
      /HTTP 403/.test(message) ||
      /Resource not accessible/i.test(message)
    ) {
      const scopeError = new Error(
        "GitHub CLI token is missing the `workflow` scope. Attempted to request it automatically. If the prompt was declined, run `gh auth refresh -h github.com -s workflow` manually and retry.",
      );
      scopeError.code = "MISSING_WORKFLOW_SCOPE";
      return scopeError;
    }
    return error;
  }

  function requestWorkflowScope() {
    if (scopeRefreshAttempted) {
      return false;
    }
    scopeRefreshAttempted = true;
    logger.log(
      "Requesting GitHub CLI workflow scope (`gh auth refresh -h github.com -s workflow`)...",
    );
    try {
      run("gh", ["auth", "refresh", "-h", "github.com", "-s", "workflow"], {
        stdio: "inherit",
      });
      logger.log("Workflow scope added. Continuing...");
      return true;
    } catch (refreshError) {
      logger.error("Automatic workflow scope request failed.");
      logger.error(refreshError.message || refreshError);
      throw new Error(
        "Automatic attempt to grant workflow scope failed. Run `gh auth refresh -h github.com -s workflow` manually and retry.",
      );
    }
  }

  function fetchLatestWorkflowRun(repo, ref) {
    const { owner, name } = parseRepo(repo);
    let output;
    try {
      const query = `per_page=20&branch=${encodeURIComponent(ref)}`;
      output = run("gh", [
        "api",
        `repos/${owner}/${name}/actions/runs?${query}`,
        "-H",
        GH_API_ACCEPT_HEADER,
      ]);
    } catch (error) {
      const scopeError = handleWorkflowScopeError(error);
      if (scopeError?.code === "MISSING_WORKFLOW_SCOPE") {
        if (requestWorkflowScope()) {
          return fetchLatestWorkflowRun(repo, ref);
        }
      }
      throw scopeError;
    }
    const data = JSON.parse(output);
    if (!data.workflow_runs || data.workflow_runs.length === 0) {
      return null;
    }
    const match = data.workflow_runs.find(
      (runInfo) => runInfo.path === WORKFLOW_PATH,
    );
    return match || null;
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
        if (error?.code === "MISSING_WORKFLOW_SCOPE") {
          throw error;
        }
        const detail = error?.message ? ` ${error.message}` : "";
        logger.warn(
          `Unable to fetch workflow run metadata (attempt ${attempt + 1}/${pollAttempts}).${detail}`,
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
        "-H",
        GH_API_ACCEPT_HEADER,
      ]);
      const data = JSON.parse(summary);
      return {
        status: data.status,
        conclusion: data.conclusion,
        url: data.html_url,
        title: data.display_title,
      };
    } catch (error) {
      const scopeError = handleWorkflowScopeError(error);
      if (scopeError?.code === "MISSING_WORKFLOW_SCOPE") {
        if (requestWorkflowScope()) {
          return viewSummary(runId, repo);
        }
        throw scopeError;
      }
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
