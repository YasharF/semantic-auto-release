const fs = require("fs");

function exportData(name, value) {
  console.log(`semantic-release-data: ${name}=${value}`);
  if (name === "new-release-version") {
    fs.writeFileSync("version.txt", value);
  }
  if (name === "new-release-notes") {
    fs.writeFileSync("release-notes.txt", value);
  }
  if (name === "branch-name") {
    fs.writeFileSync("branch.txt", value);
  }
}

function verifyConditions() {
  exportData("new-release-published", "false");
}

function generateNotes(_pluginConfig, { nextRelease, branch }) {
  exportData("new-release-published", "true");
  exportData("new-release-version", nextRelease.version);
  exportData("new-release-notes", nextRelease.notes);
  exportData("branch-name", branch.name);
  return nextRelease.notes;
}

module.exports = {
  verifyConditions,
  generateNotes,
};
