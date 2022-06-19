const core = require("@actions/core");
const github = require("@actions/github");
const parser = require("conventional-commits-parser");

const groupBy = function (xs, key, subkey) {
  return xs.reduce(function (rv, x) {
    (rv[x[key][subkey]] = rv[x[key][subkey]] || []).push(x);
    return rv;
  }, {});
};

module.exports = async (token, branch, withDescription) => {
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

  if (result.repository.refs.nodes.length === 0) {
    throw new Error("No tags found");
  }

  const latestTag = result.repository.refs.nodes[0].name;

  core.debug(`Latest tag: ${latestTag}`);

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
    owner: "OrellBuehler",
    name: "github-changelog",
    tag: latestTag,
  });

  const dateOfTag = resultDateOfTag.repository.object.committedDate;

  core.debug(`Date of last tag: ${dateOfTag}`);

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
    branch: branch,
    date: dateOfTag,
  });

  if (resultCommitsSinceDate.repository.object.history.totalCount === 0) {
    throw new Error("No commits found since last tag");
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
                  oid
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
        branch: branch,
        date: dateOfTag,
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

  core.debug(commits);

  const grouped = groupBy(commits, "parsed", "type");

  core.debug(grouped);

  const ordered = Object.keys(grouped)
    .sort()
    .reduce((obj, key) => {
      obj[key] = grouped[key];
      return obj;
    });

  core.debug(ordered);

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
        changelog += `* [${c.parsed.subject}](${c.commitUrl}) :bangbang:\n`;
      } else {
        changelog += `* [${c.parsed.subject}](${c.commitUrl})\n`;
      }
      if (withDescription && c.body !== undefined && c.body.length > 0) {
        changelog += `\t> ${c.body}\n\n`;
      }
    });
    changelog += "\n\n";
  }

  return changelog;
};
