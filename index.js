const core = require("@actions/core");

const changelog = require("./changelog");
const version = require("./version");
const release = require("./release");

async function run() {
  try {
    const token = core.getInput("token");

    core.debug(`Start time: ${new Date().toTimeString()}`);

    const changes = await changelog(token);
    const tagName = await version(token);
    await release(token, tagName, tagName, changes);

    core.debug(`Finish time: ${new Date().toTimeString()}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
