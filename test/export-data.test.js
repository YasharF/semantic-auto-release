const fs = require("fs");
const sinon = require("sinon");
const { expect } = require("chai");
const { verifyConditions, generateNotes } = require("../plugins/export-data");

describe("plugins/export-data", function () {
  let writeFileSyncStub;
  beforeEach(function () {
    writeFileSyncStub = sinon.stub(fs, "writeFileSync");
  });
  afterEach(function () {
    sinon.restore();
  });

  it("verifyConditions should export published=false", function () {
    verifyConditions();
    expect(writeFileSyncStub.called).to.be.false;
  });

  it("generateNotes should export release data", function () {
    const notes = generateNotes(
      {},
      {
        nextRelease: { version: "1.2.3", notes: "Release notes" },
        branch: { name: "main" },
      },
    );
    expect(writeFileSyncStub.callCount).to.equal(3);
    expect(writeFileSyncStub.getCall(0).args[0]).to.equal("version.txt");
    expect(writeFileSyncStub.getCall(0).args[1]).to.equal("1.2.3");
    expect(writeFileSyncStub.getCall(1).args[0]).to.equal("notes.md");
    expect(writeFileSyncStub.getCall(1).args[1]).to.equal("Release notes");
    expect(writeFileSyncStub.getCall(2).args[0]).to.equal("branch.txt");
    expect(writeFileSyncStub.getCall(2).args[1]).to.equal("main");
    expect(notes).to.equal("Release notes");
  });
});
