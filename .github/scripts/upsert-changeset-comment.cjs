'use strict';

const MARKER = '<!-- changeset-check-required -->';

const BODY = `${MARKER}

## Changeset required

This PR is missing a changeset. Please add one before merging.

**For a code change that should bump a package version:**
\`\`\`bash
pnpm exec changeset add
\`\`\`
Select the packages that changed and the bump type (\`patch\` / \`minor\` / \`major\`).

**For a chore, CI change, or other non-version-bumping change:**
\`\`\`bash
pnpm exec changeset add --empty
\`\`\``;

module.exports = async ({ github, context, passed }) => {
  const { owner, repo } = context.repo;
  const issue_number = context.payload.pull_request.number;

  // Fetch all comments, handling pagination automatically
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number
  });

  const existing = comments.find((c) => c.body.startsWith(MARKER));

  if (passed) {
    // Changeset found — delete any lingering nag comment
    if (existing) {
      await github.rest.issues.deleteComment({
        owner,
        repo,
        comment_id: existing.id
      });
    }
    return;
  }

  // No changeset — post or update the nag comment
  if (existing) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: BODY
    });
  } else {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: BODY
    });
  }
};
