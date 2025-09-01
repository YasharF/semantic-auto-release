const { expect } = require("chai");

describe("export-data plugin API", function () {
  it("should load and export required hooks", function () {
    const plugin = require("../plugins/export-data");
    expect(plugin).to.be.an("object");
    expect(plugin).to.have.property("verifyConditions").that.is.a("function");
    expect(plugin).to.have.property("generateNotes").that.is.a("function");
  });
});
