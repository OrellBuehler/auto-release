const github = require("@actions/github");
const parser = require("conventional-commits-parser");

module.exports = async (token, branch) => {
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

  let messages = resultCommitsSinceDate.repository.object.history.nodes.map(
    (commit) => commit.message
  );

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

    messages = [
      ...messages,
      ...resultCommitsSinceDateAfterCursor.repository.object.history.nodes.map(
        (commit) => commit.message
      ),
    ];

    hasNextPage =
      resultCommitsSinceDateAfterCursor.repository.object.history.pageInfo
        .hasNextPage;
    cursor =
      resultCommitsSinceDateAfterCursor.repository.object.history.pageInfo
        .endCursor;
  }

  const parsedMessages = [];

  messages.forEach((msg) => parsedMessages.push(parser.sync(msg)));

  return parsedMessages;
};
