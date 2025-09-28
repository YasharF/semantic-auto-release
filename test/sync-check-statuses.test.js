const sinon = require("sinon");
const { expect } = require("chai");

const {
  syncCheckStatuses,
  determineState,
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
});
