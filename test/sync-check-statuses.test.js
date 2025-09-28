const sinon = require("sinon");
const { expect } = require("chai");

const {
  syncCheckStatuses,
  determineState,
  parseOptions,
  describe: describeJob,
  listJobs,
  publishStatus,
  createOctokitClient,
  runCli,
} = require("../scripts/sync-check-statuses.js");

function createOctokitStub(pages) {
  const iterator = async function* () {
    for (const data of pages) {
      yield { data };
    }
  };

  const paginateIterator = sinon.stub().returns(iterator());

  return {
    stub: {
      paginate: { iterator: paginateIterator },
      actions: { listJobsForWorkflowRun: sinon.stub() },
      repos: { createCommitStatus: sinon.stub().resolves() },
    },
    paginateIterator,
  };
}

describe("scripts/sync-check-statuses", function () {
  const baseEnv = {
    GITHUB_TOKEN: "test-token",
    GITHUB_REPOSITORY: "octo/repo",
    GITHUB_RUN_ID: "42",
    GITHUB_SHA: "abc123",
  };

  beforeEach(function () {
    sinon.stub(console, "log");
    sinon.stub(console, "warn");
  });

  afterEach(function () {
    sinon.restore();
  });

  it("publishes commit statuses for each matching Checks job", async function () {
    const jobs = [
      { name: "Checks / Build", status: "completed", conclusion: "success" },
      { name: "evaluate-release", status: "completed", conclusion: "success" },
      { name: "Checks / Tests", status: "completed", conclusion: "failure" },
    ];
    const { stub: octokit } = createOctokitStub([{ jobs }]);

    const result = await syncCheckStatuses({
      env: baseEnv,
      argv: ["node", "script"],
      octokit,
    });

    expect(result.published).to.equal(2);
    expect(octokit.repos.createCommitStatus.callCount).to.equal(2);
    expect(octokit.repos.createCommitStatus.firstCall.args[0]).to.include({
      context: "Checks / Build",
      state: "success",
    });
    expect(octokit.repos.createCommitStatus.secondCall.args[0]).to.include({
      context: "Checks / Tests",
      state: "failure",
    });
  });

  it("warns when no matching Checks jobs are found", async function () {
    const jobs = [
      { name: "evaluate-release", status: "completed", conclusion: "success" },
    ];
    const { stub: octokit } = createOctokitStub([{ jobs }]);

    const result = await syncCheckStatuses({
      env: baseEnv,
      argv: ["node", "script"],
      octokit,
    });

    expect(result.published).to.equal(0);
    expect(octokit.repos.createCommitStatus.called).to.be.false;
    expect(console.warn.calledOnce).to.be.true;
  });

  it("maps in-progress or action-required jobs to pending state", function () {
    expect(
      determineState({ status: "in_progress", conclusion: null }),
    ).to.equal("pending");
    expect(
      determineState({ status: "completed", conclusion: "action_required" }),
    ).to.equal("pending");
    expect(determineState({ status: "completed", conclusion: null })).to.equal(
      "pending",
    );
  });

  it("determineState returns error for missing job or unknown conclusion", function () {
    expect(determineState(undefined)).to.equal("error");
    expect(
      determineState({ status: "completed", conclusion: "mystery" }),
    ).to.equal("error");
  });

  it("supports array-shaped pagination responses from Octokit", async function () {
    const jobs = [
      { name: "Checks / Build", status: "completed", conclusion: "success" },
    ];
    const arrayPage = Object.assign([...jobs], {
      total_count: jobs.length,
      workflow_jobs: jobs,
    });
    const { stub: octokit } = createOctokitStub([arrayPage]);

    const result = await syncCheckStatuses({
      env: baseEnv,
      argv: ["node", "script"],
      octokit,
    });

    expect(result.published).to.equal(1);
    expect(octokit.repos.createCommitStatus.calledOnce).to.be.true;
  });

  it("parseOptions respects GH_TOKEN fallback and CLI overrides", function () {
    const env = {
      GH_TOKEN: "alt-token",
      GITHUB_REPOSITORY: "octo/repo",
      GITHUB_SHA: "base-sha",
    };
    const argv = ["node", "script", "--run-id", "123", "--sha", "deadbeef"];

    const options = parseOptions(argv, env);

    expect(options).to.include({
      token: "alt-token",
      owner: "octo",
      repo: "repo",
      runId: "123",
      sha: "deadbeef",
      apiBase: "https://api.github.com",
    });
  });

  it("parseOptions throws when authentication is missing", function () {
    const env = {
      GITHUB_REPOSITORY: "octo/repo",
      GITHUB_RUN_ID: "19",
      GITHUB_SHA: "ff00ff",
    };

    expect(() => parseOptions(["node", "script"], env)).to.throw(
      "GITHUB_TOKEN environment variable is required.",
    );
  });

  it("parseOptions ignores positional arguments and trims base URL", function () {
    const env = {
      GITHUB_TOKEN: "token",
      GITHUB_REPOSITORY: "octo/repo",
      GITHUB_RUN_ID: "run-env",
      GITHUB_SHA: "sha-env",
      GITHUB_API_URL: "https://example.com/git/",
    };
    const argv = [
      "node",
      "script",
      "positional",
      "--sha",
      "cli-sha",
      "--run-id",
      "77",
    ];

    const result = parseOptions(argv, env);

    expect(result).to.include({
      sha: "cli-sha",
      runId: "77",
      apiBase: "https://example.com/git",
    });
  });

  it("parseOptions throws when repository is malformed", function () {
    const env = {
      GITHUB_TOKEN: "token",
      GITHUB_REPOSITORY: "octo",
      GITHUB_RUN_ID: "1",
      GITHUB_SHA: "abc",
    };

    expect(() => parseOptions(["node", "script"], env)).to.throw(
      "GITHUB_REPOSITORY must be set to <owner>/<repo>.",
    );
  });

  it("parseOptions throws when run id is missing", function () {
    const env = {
      GITHUB_TOKEN: "token",
      GITHUB_REPOSITORY: "octo/repo",
      GITHUB_SHA: "abc",
    };

    expect(() => parseOptions(["node", "script"], env)).to.throw(
      "Unable to determine workflow run id.",
    );
  });

  it("parseOptions throws when sha is missing", function () {
    const env = {
      GITHUB_TOKEN: "token",
      GITHUB_REPOSITORY: "octo/repo",
      GITHUB_RUN_ID: "7",
    };

    expect(() => parseOptions(["node", "script"], env)).to.throw(
      "Target commit SHA is required.",
    );
  });

  it("parseOptions skips boolean flags without values", function () {
    const env = {
      GITHUB_TOKEN: "token",
      GITHUB_REPOSITORY: "octo/repo",
      GITHUB_RUN_ID: "5",
      GITHUB_SHA: "abc",
    };

    const options = parseOptions(
      ["node", "script", "--dry-run", "--run-id", "55", "--sha", "def"],
      env,
    );

    expect(options.runId).to.equal("55");
    expect(options.sha).to.equal("def");
  });

  it("describe surfaces useful messaging for pending and missing jobs", function () {
    const pendingJob = { name: "Checks / Build", status: "in_progress" };
    expect(describeJob(pendingJob, "pending")).to.equal(
      "Run currently in_progress",
    );
    expect(describeJob(undefined, "error")).to.equal(
      "Unable to locate reusable Checks job",
    );
    expect(
      describeJob({ name: "Checks / Build", status: "completed" }, "pending"),
    ).to.equal("Run action required");
    expect(describeJob({ status: "queued" }, "error")).to.equal("Run queued");
    expect(describeJob({ name: "Checks" }, "success")).to.equal("Run unknown");
  });

  it("listJobs throws when Octokit returns an unexpected payload", async function () {
    const { stub: octokit } = createOctokitStub([{ unexpected: true }]);

    try {
      await listJobs(octokit, { owner: "octo", repo: "repo", runId: "1" });
      throw new Error("Expected listJobs to throw");
    } catch (error) {
      expect(error.message).to.include(
        "Unexpected response shape when listing workflow jobs.",
      );
    }
  });

  it("listJobs throws when iterator yields missing data", async function () {
    const { stub: octokit } = createOctokitStub([undefined]);

    try {
      await listJobs(octokit, { owner: "octo", repo: "repo", runId: "1" });
      throw new Error("Expected listJobs to throw");
    } catch (error) {
      expect(error.message).to.include(
        "Unexpected response shape when listing workflow jobs.",
      );
    }
  });

  it("listJobs accepts workflow_jobs shaped responses", async function () {
    const jobs = [
      { name: "Checks / Docs", status: "completed", conclusion: "success" },
    ];
    const { stub: octokit } = createOctokitStub([{ workflow_jobs: jobs }]);

    const result = await listJobs(octokit, {
      owner: "octo",
      repo: "repo",
      runId: "1",
    });

    expect(result).to.deep.equal(jobs);
  });

  it("syncCheckStatuses handles empty job list", async function () {
    const { stub: octokit } = createOctokitStub([[]]);

    const result = await syncCheckStatuses({
      env: {
        ...baseEnv,
        GITHUB_RUN_ID: "100",
      },
      argv: ["node", "script"],
      octokit,
    });

    expect(result).to.deep.equal({ published: 0, jobs: [] });
    expect(octokit.repos.createCommitStatus.called).to.be.false;
    expect(console.warn.calledOnce).to.be.true;
    expect(console.warn.firstCall.args[0]).to.include('No reusable "Checks"');
  });

  it("publishStatus forwards payload to Octokit", async function () {
    const octokit = {
      repos: {
        createCommitStatus: sinon.stub().resolves(),
      },
    };

    await publishStatus(
      octokit,
      { owner: "octo", repo: "repo", sha: "deadbeef" },
      "Checks / Build",
      "success",
      "Run success",
    );

    expect(octokit.repos.createCommitStatus.calledOnce).to.be.true;
    expect(octokit.repos.createCommitStatus.firstCall.args[0]).to.deep.equal({
      owner: "octo",
      repo: "repo",
      sha: "deadbeef",
      state: "success",
      context: "Checks / Build",
      description: "Run success",
    });
  });

  it("createOctokitClient constructs a GitHub client", function () {
    const client = createOctokitClient({
      token: "token",
      apiBase: "https://api.github.com",
    });

    expect(client).to.have.property("paginate");
    expect(client).to.have.property("repos");
  });

  it("syncCheckStatuses builds a client when one isn't provided", async function () {
    const client = createOctokitStub([{ jobs: [] }]).stub;
    const createClient = sinon.stub().returns(client);

    const result = await syncCheckStatuses({
      env: baseEnv,
      argv: ["node", "script"],
      createClient,
    });

    expect(createClient.calledOnce).to.be.true;
    expect(result.published).to.equal(0);
  });

  it("runCli exits with code 1 when syncCheckStatuses fails", async function () {
    const exitStub = sinon.stub(process, "exit").callsFake(() => {});
    const errorStub = sinon.stub(console, "error");
    const reason = { code: 500 };
    const sync = sinon.stub().rejects(reason);

    await runCli({ sync });

    expect(errorStub.firstCall.args[0]).to.equal(
      "Failed to publish commit statuses:",
    );
    expect(errorStub.secondCall.args[0]).to.equal(reason);
    expect(exitStub.calledWith(1)).to.be.true;
  });

  it("runCli returns successfully when syncCheckStatuses resolves", async function () {
    const exitStub = sinon.stub(process, "exit");
    const sync = sinon.stub().resolves();

    await runCli({ sync });

    expect(exitStub.called).to.be.false;
  });
});
