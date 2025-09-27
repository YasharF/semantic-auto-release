#!/usr/bin/env node

const { env, argv } = process;

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
  console.error("GITHUB_TOKEN environment variable is required.");
  process.exit(1);
}

const repository = env.GITHUB_REPOSITORY;
if (!repository || !repository.includes("/")) {
  console.error("GITHUB_REPOSITORY must be set to <owner>/<repo>.");
  process.exit(1);
}

const [owner, repo] = repository.split("/");
const apiBase = (env.GITHUB_API_URL || "https://api.github.com").replace(
  /\/$/,
  "",
);
const runId = options["run-id"] || options.runId || env.GITHUB_RUN_ID;
if (!runId) {
  console.error(
    "Unable to determine workflow run id. Pass --run-id or set GITHUB_RUN_ID.",
  );
  process.exit(1);
}

const sha = options.sha || env.GITHUB_SHA;
if (!sha) {
  console.error("Target commit SHA is required. Pass --sha or set GITHUB_SHA.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "User-Agent": "semantic-auto-release-script",
  Accept: "application/vnd.github+json",
};

async function request(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    const message = text
      ? `${response.status} ${response.statusText}: ${text}`
      : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function listJobs() {
  const jobs = [];
  let page = 1;
  while (true) {
    const url = `${apiBase}/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=100&page=${page}`;
    const data = await request(url);
    if (!data || !Array.isArray(data.jobs)) {
      throw new Error("Unexpected response shape when listing workflow jobs.");
    }
    jobs.push(...data.jobs);
    if (
      !data.jobs.length ||
      !data.total_count ||
      jobs.length >= data.total_count
    ) {
      break;
    }
    page += 1;
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

async function publishStatus(context, state, description) {
  const url = `${apiBase}/repos/${owner}/${repo}/statuses/${sha}`;
  await request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      state,
      context,
      description,
    }),
  });
}

(async () => {
  try {
    console.log(`Fetching jobs for workflow run ${runId}...`);
    const jobs = await listJobs();
    console.log(`Jobs for workflow run ${runId}:`);
    if (!jobs.length) {
      console.log("- none");
    }
    jobs.forEach((job, index) => {
      const label =
        job && typeof job === "object"
          ? (job.name ?? `index ${index}`)
          : `index ${index}`;
      console.log(`- ${label}`);
      console.log(`  raw: ${JSON.stringify(job, null, 2)}`);
    });
    const matching = jobs.filter(
      (job) => typeof job?.name === "string" && job.name.startsWith("Checks"),
    );

    if (!matching.length) {
      console.warn(
        'No reusable "Checks" jobs found when computing commit statuses.',
      );
      return;
    }

    for (const job of matching) {
      const state = determineState(job);
      const description = describe(job, state);
      const context = job.name;
      console.log(
        `Publishing status for ${context}: ${state} (${description})`,
      );
      await publishStatus(context, state, description);
    }
    console.log("Finished publishing commit statuses.");
  } catch (error) {
    console.error("Failed to publish commit statuses:");
    console.error(error.message || error);
    process.exit(1);
  }
})();
