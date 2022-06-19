const core = require("@actions/core");
const github = require("@actions/github");

const version = require("./version");

// most @actions toolkit packages have async methods
async function run() {
  try {
    const majorBranch = core.getInput("major-branch");
    const minorBranch = core.getInput("minor-branch");
    const patchBranch = core.getInput("patch-branch");

    core.debug(new Date().toTimeString());

    const tagName = await version(github.ref_name, {
      majorBranch: majorBranch,
      minorBranch: minorBranch,
      patchBranch: patchBranch,
    });

    core.debug(`Tag name: ${tagName}`);

    core.info(new Date().toTimeString());
    core.setOutput("time", new Date().toTimeString());
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
