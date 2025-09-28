const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
const { pathToFileURL } = require("url");

const tempRepos = new Set();

const EXPORT_PLUGIN_PATH = path.resolve(
  __dirname,
  "../../plugins/export-release-data.js",
);
const RELEASE_CONFIG_PATH = path.resolve(__dirname, "../../release.config.js");
const EXPORT_PLUGIN_IDENTIFIER = "./plugins/export-release-data.js";

function runGit(command, options = {}) {
  execSync(command, {
    stdio: "ignore",
    ...options,
  });
}

function cleanupTempRepo(entry) {
  if (!entry) return;
  try {
    fs.rmSync(entry.dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
  try {
    fs.rmSync(entry.remoteDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
  tempRepos.delete(entry);
}

function registerTempRepo(dir, remoteDir) {
  const entry = { dir, remoteDir };
  tempRepos.add(entry);
  return entry;
}

function cleanupAllTempRepos() {
  for (const entry of Array.from(tempRepos)) {
    cleanupTempRepo(entry);
  }
}

function copyProjectAssets(destination) {
  const pluginDest = path.join(destination, "plugins");
  fs.mkdirSync(pluginDest, { recursive: true });
  fs.copyFileSync(
    EXPORT_PLUGIN_PATH,
    path.join(pluginDest, "export-release-data.js"),
  );
  fs.copyFileSync(
    RELEASE_CONFIG_PATH,
    path.join(destination, "release.config.js"),
  );
}

function createTempRepo({ includeProjectFiles = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "semantic-release-repo-"));
  const remoteDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "semantic-release-remote-"),
  );
  const remoteUrl = pathToFileURL(remoteDir).href;
  const entry = registerTempRepo(dir, remoteDir);

  try {
    runGit("git init --bare", { cwd: remoteDir });
    runGit("git symbolic-ref HEAD refs/heads/main", { cwd: remoteDir });

    const git = (cmd) => runGit(cmd, { cwd: dir });

    git("git init");
    git('git config user.name "Test User"');
    git('git config user.email "test@example.com"');

    const pkgJson = {
      name: "semantic-release-fixture",
      version: "0.0.0-development",
      private: true,
    };
    fs.writeFileSync(
      path.join(dir, "package.json"),
      `${JSON.stringify(pkgJson, null, 2)}\n`,
    );
    fs.writeFileSync(path.join(dir, "README.md"), "# Fixture\n");

    if (includeProjectFiles) {
      copyProjectAssets(dir);
    }

    git(`git remote add origin ${remoteUrl}`);
    git("git add .");
    git('git commit -m "feat: initial release"');
    git("git tag v1.0.0");

    const featureFile = path.join(dir, "feature.txt");
    fs.writeFileSync(featureFile, "New feature\n");
    git("git add feature.txt");
    git('git commit -m "feat: add new capability"');
    git("git branch -M main");
    git("git push --set-upstream origin main");
    git("git push origin v1.0.0");
    git("git fetch origin main --tags --prune");
    git("git branch --set-upstream-to=origin/main main");
    git("git reset --hard origin/main");

    return {
      dir,
      remote: remoteUrl,
      cleanup() {
        cleanupTempRepo(entry);
      },
    };
  } catch (error) {
    cleanupTempRepo(entry);
    throw error;
  }
}

function createLogger() {
  const noop = () => {};
  return {
    log: noop,
    error: noop,
    success: noop,
    info: noop,
    warn: noop,
  };
}

function hasExportPlugin(plugins) {
  return plugins.some((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name === EXPORT_PLUGIN_IDENTIFIER;
  });
}

function createSemanticEnv(branch = "main") {
  const env = { ...process.env };
  env.CI = "false";
  env.GITHUB_ACTIONS = "false";
  env.GITHUB_REF_NAME = branch;
  env.GITHUB_REF = `refs/heads/${branch}`;
  env.GITHUB_HEAD_REF = "";
  env.GITHUB_BASE_REF = "";
  return env;
}

module.exports = {
  EXPORT_PLUGIN_PATH,
  EXPORT_PLUGIN_IDENTIFIER,
  copyProjectAssets,
  createLogger,
  createSemanticEnv,
  createTempRepo,
  cleanupAllTempRepos,
  runGit,
  hasExportPlugin,
};
