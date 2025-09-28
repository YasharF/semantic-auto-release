const fs = require("fs");
const path = require("path");
const { expect } = require("chai");
const semanticReleaseModule = require("semantic-release");
const {
  EXPORT_PLUGIN_PATH,
  createTempRepo,
  createLogger,
  createSemanticEnv,
  hasExportPlugin,
  cleanupAllTempRepos,
} = require("./helpers/semanticReleaseFixture");

const runSemanticRelease =
  typeof semanticReleaseModule === "function"
    ? semanticReleaseModule
    : semanticReleaseModule.default;

if (typeof runSemanticRelease !== "function") {
  throw new Error("semantic-release module did not export a function");
}

describe("semantic-release integration", function () {
  this.timeout(30000);

  afterEach(function () {
    if (this.repo) {
      this.repo.cleanup();
      this.repo = undefined;
    }
  });

  after(function () {
    cleanupAllTempRepos();
  });

  describe("export-release-data plugin", function () {
    it("writes release artifacts during dry run", async function () {
      const repo = createTempRepo();
      this.repo = repo;
      const logger = createLogger();
      const originalCwd = process.cwd();
      process.chdir(repo.dir);

      try {
        const result = await runSemanticRelease(
          {
            ci: false,
            dryRun: true,
            branches: [{ name: "main" }],
            repositoryUrl: repo.remote,
            plugins: [
              [
                "@semantic-release/commit-analyzer",
                { preset: "conventionalcommits" },
              ],
              "@semantic-release/release-notes-generator",
              EXPORT_PLUGIN_PATH,
            ],
            logger,
          },
          { env: createSemanticEnv("main"), cwd: repo.dir },
        );

        expect(result).to.be.an("object");
        expect(result.nextRelease).to.include({ version: "1.1.0" });

        const versionTxt = fs
          .readFileSync(path.join(repo.dir, "version.txt"), "utf8")
          .trim();
        const notesTxt = fs.readFileSync(
          path.join(repo.dir, "release-notes.txt"),
          "utf8",
        );
        const branchTxt = fs
          .readFileSync(path.join(repo.dir, "branch.txt"), "utf8")
          .trim();

        expect(versionTxt).to.equal("1.1.0");
        expect(notesTxt).to.include("### Features");
        expect(notesTxt).to.include("add new capability");
        expect(branchTxt).to.equal("main");
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe("release.config.js", function () {
    let originalCwd;

    beforeEach(function () {
      originalCwd = process.cwd();
    });

    afterEach(function () {
      process.chdir(originalCwd);
      delete process.env.release_step;
      if (this.configPath && this.configPath in require.cache) {
        delete require.cache[this.configPath];
      }
      this.configPath = undefined;
    });

    it("omits export plugin when release_step is unset", async function () {
      const repo = createTempRepo({ includeProjectFiles: true });
      this.repo = repo;
      process.chdir(repo.dir);

      const logger = createLogger();
      const configPath = path.join(repo.dir, "release.config.js");
      this.configPath = configPath;
      const config = require(configPath);

      expect(hasExportPlugin(config.plugins)).to.be.false;

      const result = await runSemanticRelease(
        {
          ci: false,
          dryRun: true,
          branches: [{ name: "main" }],
          repositoryUrl: config.repositoryUrl,
          plugins: config.plugins,
          tagFormat: config.tagFormat,
          logger,
        },
        { env: createSemanticEnv("main"), cwd: repo.dir },
      );

      expect(result.nextRelease).to.include({ version: "1.1.0" });
      expect(fs.existsSync(path.join(repo.dir, "version.txt"))).to.be.false;
    });

    it("includes export plugin when release_step=create_release_files", async function () {
      const repo = createTempRepo({ includeProjectFiles: true });
      this.repo = repo;
      process.chdir(repo.dir);

      process.env.release_step = "create_release_files";
      const configPath = path.join(repo.dir, "release.config.js");
      if (configPath in require.cache) {
        delete require.cache[configPath];
      }

      const logger = createLogger();
      this.configPath = configPath;
      const config = require(configPath);

      expect(hasExportPlugin(config.plugins)).to.be.true;

      const result = await runSemanticRelease(
        {
          ci: false,
          dryRun: true,
          branches: [{ name: "main" }],
          repositoryUrl: config.repositoryUrl,
          plugins: config.plugins,
          tagFormat: config.tagFormat,
          logger,
        },
        { env: createSemanticEnv("main"), cwd: repo.dir },
      );

      expect(result.nextRelease).to.include({ version: "1.1.0" });
      const versionTxt = fs
        .readFileSync(path.join(repo.dir, "version.txt"), "utf8")
        .trim();
      expect(versionTxt).to.equal("1.1.0");
    });
  });
});
