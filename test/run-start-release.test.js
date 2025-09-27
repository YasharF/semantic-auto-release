const { expect } = require("chai");
const sinon = require("sinon");
const EventEmitter = require("events");

const { createReleaseRunner } = require("../scripts/run-start-release");

function createSpawnSyncStub(responses) {
  const stub = sinon.stub();
  responses.forEach((response, index) => {
    stub.onCall(index).returns({
      status: response.status ?? 0,
      stdout: response.stdout ?? "",
      stderr: response.stderr ?? "",
      error: response.error ?? null,
    });
  });
  return stub;
}

describe("run-start-release", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("executes the release workflow via GitHub CLI", async () => {
    const createdAt = new Date().toISOString();
    const spawnSyncStub = createSpawnSyncStub([
      { stdout: "gh version" },
      { stdout: "auth ok" },
      { stdout: "owner/repo" },
      { stdout: "main" },
      { stdout: "" },
      {
        stdout: JSON.stringify({
          workflow_runs: [
            {
              id: 321,
              html_url: "https://example.com/run/321",
              status: "queued",
              conclusion: null,
              display_title: "Release",
              created_at: createdAt,
            },
          ],
        }),
      },
      {
        stdout: JSON.stringify({
          status: "completed",
          conclusion: "success",
          html_url: "https://example.com/run/321",
          display_title: "Release",
        }),
      },
    ]);

    const watcher = new EventEmitter();
    const spawnStub = sinon.stub().returns(watcher);

    const logs = [];
    const logger = {
      log: (msg) => logs.push({ level: "log", msg }),
      error: (msg) => logs.push({ level: "error", msg }),
      warn: (msg) => logs.push({ level: "warn", msg }),
    };

    const exitStub = sinon.stub();

    const runner = createReleaseRunner({
      spawnSyncImpl: spawnSyncStub,
      spawnImpl: spawnStub,
      logger,
      exit: exitStub,
      pollAttempts: 1,
    });

    const execution = runner.execute();
    setImmediate(() => {
      watcher.emit("close", 0);
    });
    await execution;

    expect(spawnSyncStub.callCount).to.equal(7);

    const ghVersionCall = spawnSyncStub.getCall(0);
    expect(ghVersionCall.args[0]).to.equal("gh");
    expect(ghVersionCall.args[1]).to.deep.equal(["--version"]);
    expect(ghVersionCall.args[2]).to.include({
      stdio: "pipe",
      encoding: "utf8",
    });

    const authCall = spawnSyncStub.getCall(1);
    expect(authCall.args[0]).to.equal("gh");
    expect(authCall.args[1]).to.deep.equal([
      "auth",
      "status",
      "--hostname",
      "github.com",
    ]);
    expect(authCall.args[2]).to.include({ stdio: "inherit" });

    const workflowRunCall = spawnSyncStub.getCall(4);
    expect(workflowRunCall.args[0]).to.equal("gh");
    expect(workflowRunCall.args[1]).to.deep.equal([
      "workflow",
      "run",
      "start-release.yml",
      "--ref",
      "main",
    ]);

    const listRunCall = spawnSyncStub.getCall(5);
    expect(listRunCall.args[0]).to.equal("gh");
    expect(listRunCall.args[1]).to.deep.equal([
      "api",
      "repos/owner/repo/actions/workflows/start-release.yml/runs",
      "-f",
      "per_page=1",
      "-f",
      "branch=main",
    ]);

    const summaryCall = spawnSyncStub.getCall(6);
    expect(summaryCall.args[0]).to.equal("gh");
    expect(summaryCall.args[1]).to.deep.equal([
      "api",
      "repos/owner/repo/actions/runs/321",
    ]);

    const watchCall = spawnStub.getCall(0);
    expect(watchCall.args[0]).to.equal("gh");
    expect(watchCall.args[1]).to.deep.equal(["run", "watch", "321"]);
    expect(watchCall.args[2]).to.include({ stdio: "inherit" });

    expect(logs.map((entry) => entry.msg)).to.include(
      "Workflow run started: https://example.com/run/321",
    );
    expect(logs.map((entry) => entry.msg)).to.include(
      "Workflow completed with status completed (success). Details: https://example.com/run/321",
    );
    expect(exitStub.called).to.be.false;
  });

  it("exits when GitHub authentication is missing", async () => {
    const spawnSyncStub = sinon.stub();
    spawnSyncStub.onCall(0).returns({ status: 0, stdout: "gh version" });
    spawnSyncStub.onCall(1).returns({ status: 1, stderr: "auth required" });

    const exitStub = sinon.stub().throws(new Error("exit"));
    const logger = {
      log: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    };

    const runner = createReleaseRunner({
      spawnSyncImpl: spawnSyncStub,
      spawnImpl: sinon.stub(),
      logger,
      exit: exitStub,
    });

    let caughtError;
    try {
      await runner.execute();
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).to.be.instanceOf(Error);
    expect(caughtError.message).to.equal("exit");

    expect(exitStub.callCount).to.be.greaterThan(0);
    expect(exitStub.firstCall.args[0]).to.equal(1);

    const firstError = logger.error.getCall(0)?.args[0];
    expect(firstError).to.match(/GitHub CLI authentication required/);
    expect(spawnSyncStub.callCount).to.equal(2);
  });

  it("returns null when run summary cannot be fetched", () => {
    const spawnSyncStub = sinon.stub();
    spawnSyncStub.throws(new Error("failed"));
    const logger = {
      log: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    };

    const runner = createReleaseRunner({
      spawnSyncImpl: spawnSyncStub,
      spawnImpl: sinon.stub(),
      logger,
      exit: sinon.stub(),
    });

    const summary = runner.viewSummary(123, "owner/repo");
    expect(summary).to.equal(null);
    expect(logger.warn.calledOnce).to.be.true;
  });
});
