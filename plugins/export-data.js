const fs = require("fs");

function exportData(name, value) {
  console.log(`semantic-release-export-data: ${name}=${value}`);
  if (name === "new-release-version") {
    fs.writeFileSync("version.txt", value);
  }
  if (name === "new-release-notes") {
    fs.writeFileSync("notes.md", value);
  }
}

function verifyConditions() {
  exportData("new-release-published", "false");
}

function generateNotes(_pluginConfig, { nextRelease }) {
  exportData("new-release-published", "true");
  exportData("new-release-version", nextRelease.version);
  exportData("new-release-notes", nextRelease.notes);
  return nextRelease.notes;
}

module.exports = {
  verifyConditions,
  generateNotes,
};
