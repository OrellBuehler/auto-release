const core = require("@actions/core");
const github = require("@actions/github");
const parser = require("conventional-commits-parser");

const groupBy = function (xs, key, subkey) {
  return xs.reduce(function (rv, x) {
    (rv[x[key][subkey]] = rv[x[key][subkey]] || []).push(x);
    return rv;
  }, {});
};

module.exports = async (token) => {
  const sourceBranch = core.getInput("source-branch");
  const withDescription = core.getBooleanInput("with-description");

  const octokit = github.getOctokit(token);

  const queryLatestTag = `query ($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
            refs(refPrefix: "refs/tags/", last: 1) {
            nodes {name}
            }
        }
    }`;

  const result = await octokit.graphql(queryLatestTag, {
    owner: github.context.repo.owner,
    name: github.context.repo.repo,
  });

  let startDate;

  if (result.repository.refs.nodes.length === 0) {
    const queryRepoCreationDate = `query ($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        createdAt
      }
    }`;

    const resultReporCreationDate = await octokit.graphql(
      queryRepoCreationDate,
      {
        owner: github.context.repo.owner,
        name: github.context.repo.repo,
      }
    );

    startDate = resultReporCreationDate.repository.createdAt;
  } else {
    const latestTag = result.repository.refs.nodes[0].name;
    const queryDateOfTag = `query ($owner: String!, $name: String!, $tag: String!) {
            repository(owner: $owner, name: $name) {
              object(expression: $tag) {
                ... on Commit {
                  committedDate
                }
              }
            }
          }`;

    const resultDateOfTag = await octokit.graphql(queryDateOfTag, {
      owner: github.context.repo.owner,
      name: github.context.repo.repo,
      tag: latestTag,
    });

    startDate = resultDateOfTag.repository.object.committedDate;
  }

  core.debug(`Loading commits since ${startDate} on branch ${sourceBranch}.`);

  const queryCommitsSinceDate = `query ($owner: String!, $name: String!, $branch: String! $date: GitTimestamp!) {
      repository(owner: $owner, name: $name) {
        object(expression: $branch) {
          ... on Commit {
            history(first: 100, since: $date) {
              totalCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                commitUrl
                message
              }
            }
          }
        }
      }
    }`;

  const resultCommitsSinceDate = await octokit.graphql(queryCommitsSinceDate, {
    owner: github.context.repo.owner,
    name: github.context.repo.repo,
    branch: sourceBranch,
    date: startDate,
  });

  if (resultCommitsSinceDate.repository.object.history.totalCount === 0) {
    core.warning(
      `No commits found since ${startDate} on branch ${sourceBranch}. Returning empty changelog!`
    );
    return "";
  }

  let commits = resultCommitsSinceDate.repository.object.history.nodes;

  let hasNextPage =
    resultCommitsSinceDate.repository.object.history.pageInfo.hasNextPage;

  let cursor =
    resultCommitsSinceDate.repository.object.history.pageInfo.endCursor;

  while (hasNextPage) {
    const queryCommitsSinceDateAfterCursor = `query ($owner: String!, $name: String!, $branch: String!, $date: GitTimestamp!, $cursor: String!) {
        repository(owner: $owner, name: $name) {
          object(expression: $branch) {
            ... on Commit {
              history(first: 100, since: $date, after: $cursor) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  commitUrl
                  message
                }
              }
            }
          }
        }
      }`;

    let resultCommitsSinceDateAfterCursor = await octokit.graphql(
      queryCommitsSinceDateAfterCursor,
      {
        owner: github.context.repo.owner,
        name: github.context.repo.repo,
        branch: sourceBranch,
        date: startDate,
        cursor: cursor,
      }
    );

    commits = [
      ...commits,
      ...resultCommitsSinceDateAfterCursor.repository.object.history.nodes,
    ];

    hasNextPage =
      resultCommitsSinceDateAfterCursor.repository.object.history.pageInfo
        .hasNextPage;
    cursor =
      resultCommitsSinceDateAfterCursor.repository.object.history.pageInfo
        .endCursor;
  }

  commits.forEach((commit) => (commit["parsed"] = parser.sync(commit.message)));

  const grouped = groupBy(commits, "parsed", "type");
  delete grouped["null"]; //remove all commits without type

  if (Object.keys(grouped).length === 0) {
    core.warning(
      `No commits matching the convention template found since ${startDate} on branch ${sourceBranch}. Returning empty changelog!`
    );
    return "";
  }

  const ordered = Object.keys(grouped)
    .sort()
    .reduce((obj, key) => {
      obj[key] = grouped[key];
      return obj;
    }, {});

  core.debug(`Parsed and ordered commit data:\n${JSON.stringify(ordered)}`);

  let changelog = "";

  for (const [key, value] of Object.entries(ordered)) {
    switch (key) {
      case "build":
        changelog += `## Build\n\n`;
        break;
      case "ci":
        changelog += `## CI\n\n`;
        break;
      case "docs":
        changelog += `## Documentation\n\n`;
        break;
      case "feat":
        changelog += `## Features\n\n`;
        break;
      case "fix":
        changelog += `## Bug Fixes\n\n`;
        break;
      case "perf":
        changelog += `## Performance\n\n`;
        break;
      case "refactor":
        changelog += `## Refactoring\n\n`;
        break;
      case "revert":
        changelog += `## Revert\n\n`;
        break;
      case "style":
        changelog += `## Style\n\n`;
        break;
      case "test":
        changelog += `## Tests\n\n`;
        break;
      default:
        changelog += `## Other\n\n`;
        break;
    }
    value.forEach((c) => {
      if (c.parsed.footer && c.parsed.footer.includes("BREAKING CHANGE")) {
        changelog += `* [${c.parsed.subject}](${c.commitUrl}) - BREAKING CHANGE :bangbang:\n`;
      } else {
        changelog += `* [${c.parsed.subject}](${c.commitUrl})\n`;
      }
      if (withDescription && c.parsed.body) {
        changelog += `\t> ${c.parsed.body}\n\n`;
      }
    });
    changelog += "\n\n";
  }

  core.debug(`Changelog:\n ${changelog}`);
  return changelog;
};
