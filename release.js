const github = require("@actions/github");

module.exports = async (token, name, tagName, body) => {
  const octokit = github.getOctokit(token);

  octokit.rest.repos.createRelease({
    draft: false,
    generate_release_notes: false,
    name: name,
    owner: github.context.repo.owner,
    prerelease: false,
    repo: github.context.repo.repo,
    tag_name: tagName,
    body: body,
  });
};
