#!/usr/bin/env node

const { Octokit } = require("@octokit/rest");

function parseOptions(argv, env) {
  const args = argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (!key.startsWith("--")) {
      continue;
    }
    const value = args[i + 1]?.startsWith("--") ? undefined : args[i + 1];
    const normalized = key.slice(2);
    options[normalized] = value ?? true;
    if (value !== undefined) {
      i += 1;
    }
  }

  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required.");
  }

  const repository = env.GITHUB_REPOSITORY;
  if (!repository || !repository.includes("/")) {
    throw new Error("GITHUB_REPOSITORY must be set to <owner>/<repo>.");
  }

  const [owner, repo] = repository.split("/");
  const apiBase = (env.GITHUB_API_URL || "https://api.github.com").replace(
    /\/$/,
    "",
  );
  const runId = options["run-id"] || options.runId || env.GITHUB_RUN_ID;
  if (!runId) {
    throw new Error(
      "Unable to determine workflow run id. Pass --run-id or set GITHUB_RUN_ID.",
    );
  }

  const sha = options.sha || env.GITHUB_SHA;
  if (!sha) {
    throw new Error(
      "Target commit SHA is required. Pass --sha or set GITHUB_SHA.",
    );
  }

  return {
    token,
    owner,
    repo,
    apiBase,
    runId,
    sha,
  };
}

async function listJobs(octokit, { owner, repo, runId }) {
  const iterator = octokit.paginate.iterator(
    octokit.actions.listJobsForWorkflowRun,
    {
      owner,
      repo,
      run_id: runId,
      per_page: 100,
    },
  );

  const jobs = [];
  for await (const { data } of iterator) {
    if (!data) {
      throw new Error("Unexpected response shape when listing workflow jobs.");
    }

    const pageJobs = Array.isArray(data)
      ? data
      : Array.isArray(data.jobs)
        ? data.jobs
        : Array.isArray(data.workflow_jobs)
          ? data.workflow_jobs
          : null;

    if (!pageJobs) {
      throw new Error("Unexpected response shape when listing workflow jobs.");
    }

    jobs.push(...pageJobs);
  }
  return jobs;
}

function determineState(job) {
  if (!job) return "error";
  if (job.status && job.status !== "completed") {
    return "pending";
  }
  if (!job.conclusion) {
    return "pending";
  }
  const normalized = job.conclusion.toLowerCase();
  const mapping = {
    success: "success",
    skipped: "success",
    neutral: "success",
    action_required: "pending",
    failure: "failure",
    timed_out: "failure",
    startup_failure: "failure",
    stale: "failure",
    cancelled: "error",
  };
  return mapping[normalized] || "error";
}

function describe(job, state) {
  if (!job) return "Unable to locate reusable Checks job";
  if (state === "pending") {
    if (job.status && job.status !== "completed") {
      return `Run currently ${job.status}`;
    }
    return "Run action required";
  }
  const conclusion = job.conclusion ?? job.status ?? "unknown";
  return `Run ${conclusion}`;
}

async function publishStatus(
  octokit,
  { owner, repo, sha },
  context,
  state,
  description,
) {
  await octokit.repos.createCommitStatus({
    owner,
    repo,
    sha,
    state,
    context,
    description,
  });
}

async function syncCheckStatuses({
  env = process.env,
  argv = process.argv,
  octokit,
} = {}) {
  const options = parseOptions(argv, env);

  const client =
    octokit ||
    new Octokit({
      auth: options.token,
      userAgent: "semantic-auto-release-script",
      baseUrl: options.apiBase,
    });

  console.log(`Fetching jobs for workflow run ${options.runId}...`);
  const jobs = await listJobs(client, options);
  if (jobs.length === 0) {
    console.log(`No jobs found for workflow run ${options.runId}.`);
  } else {
    console.log(
      `Found ${jobs.length} job${jobs.length === 1 ? "" : "s"} for workflow run ${options.runId}.`,
    );
  }
  const matching = jobs.filter(
    (job) => typeof job?.name === "string" && job.name.startsWith("Checks"),
  );

  if (!matching.length) {
    console.warn(
      'No reusable "Checks" jobs found when computing commit statuses.',
    );
    return {
      published: 0,
      jobs,
    };
  }

  for (const job of matching) {
    const state = determineState(job);
    const description = describe(job, state);
    const context = job.name;
    console.log(`Publishing status for ${context}: ${state} (${description})`);
    await publishStatus(client, options, context, state, description);
  }
  console.log("Finished publishing commit statuses.");
  return {
    published: matching.length,
    jobs,
  };
}

async function runCli() {
  try {
    await syncCheckStatuses();
  } catch (error) {
    console.error("Failed to publish commit statuses:");
    console.error(error.message || error);
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  syncCheckStatuses,
  determineState,
  describe,
  parseOptions,
  listJobs,
  publishStatus,
};
