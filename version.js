const github = require("@actions/github");

module.exports = async (
  token,
  target,
  { majorBranch, minorBranch, patchBranch }
) => {
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

  const latestTag = result.repository.refs.nodes[0].name;
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
