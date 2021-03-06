const core = require("@actions/core");
const github = require("@actions/github");

module.exports = async (token) => {
  const target = core.getInput("target-branch");
  const majorBranch = core.getInput("major-branch");
  const minorBranch = core.getInput("minor-branch");
  const patchBranch = core.getInput("patch-branch");

  const octokit = github.getOctokit(token);

  const query = `query ($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
            refs(refPrefix: "refs/tags/", last: 1) {
            nodes {name}
            }
        }
    }`;

  const result = await octokit.graphql(query, {
    owner: github.context.repo.owner,
    name: github.context.repo.repo,
  });

  if (result.repository.refs.nodes.length === 0) {
    let initialTag = "";
    switch (target) {
      case majorBranch:
        initialTag = "v1.0.0";
        break;
      case minorBranch:
        initialTag = "v0.1.0";
        break;
      case patchBranch:
        initialTag = "v0.0.1";
        break;
      default:
        throw new Error(`Unknown target branch: ${target}`);
    }
    core.info(`No tag found, creating initial tag: ${initialTag}`);
    return initialTag;
  }

  const latestTag = result.repository.refs.nodes[0].name;
  core.info(`Tag found: ${latestTag}`);

  const versionPart = latestTag.substring(1);
  const versionNumbers = versionPart.split(".");
  var major = versionNumbers[0];
  var minor = versionNumbers[1];
  var patch = versionNumbers[2];

  switch (target) {
    case majorBranch:
      major++;
      minor = 0;
      patch = 0;
      break;
    case minorBranch:
      minor++;
      patch = 0;
      break;
    case patchBranch:
      patch++;
      break;
    default:
      throw new Error(`Unknown target branch: ${target}`);
  }

  return `v${major}.${minor}.${patch}`;
};
