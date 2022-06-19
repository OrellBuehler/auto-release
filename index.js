const core = require("@actions/core");

const changelog = require("./changelog");
const version = require("./version");
const release = require("./release");

// most @actions toolkit packages have async methods
async function run() {
  try {
    const token = core.getInput("token");
    const target = core.getInput("target-branch");
    const sourceBranch = core.getInput("source-branch");
    const withDescription = core.getBooleanInput("with-description");
    const majorBranch = core.getInput("major-branch");
    const minorBranch = core.getInput("minor-branch");
    const patchBranch = core.getInput("patch-branch");

    core.debug(new Date().toTimeString());

    const changes = await changelog(token, sourceBranch, withDescription);

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
