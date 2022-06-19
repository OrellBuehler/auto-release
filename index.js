const core = require("@actions/core");
const github = require("@actions/github");

const changelog = require("./changelog");
const version = require("./version");
const release = require("./release");

// most @actions toolkit packages have async methods
async function run() {
  try {
    const token = core.getInput("token");
    const target = core.getInput("target");
    const majorBranch = core.getInput("major-branch");
    const minorBranch = core.getInput("minor-branch");
    const patchBranch = core.getInput("patch-branch");
    const branch = github.context.ref.replace("refs/heads/", "");

    core.debug(new Date().toTimeString());

    const changes = await changelog(token, branch);

    core.debug(changes);

    const tagName = await version(token, target, {
      majorBranch: majorBranch,
      minorBranch: minorBranch,
      patchBranch: patchBranch,
    });

    core.debug(`Tag name: ${tagName}`);

    await release(token, tagName, tagName, changes);

    core.info(new Date().toTimeString());
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
