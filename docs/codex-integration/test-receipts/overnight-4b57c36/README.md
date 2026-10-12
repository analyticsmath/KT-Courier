# Overnight candidate receipts

Candidate source: 4b57c36cda111673bad1ea3689a8aafa66a01b03.
Candidate tree: 9497eba3a65fd68bfe842eaf3593fd70ac26f61d.
Migration tree: 1d0f1c9e100d2aace8fba5062ea5c0462ab62096.

These receipts cover the workflow/configuration repair, not the full application matrix. Existing application receipts under ../phase2-final-aa0a3af7 remain bound to aa0a3af7.

- workflow-regression.json and workflow-regression.stdout.txt record the six focused Node tests.
- lint.json and lint.stdout.txt record the repository ESLint command.
- vercel-schema.json records JSON parsing and official schema validation.
- git-diff-check.json records whitespace verification before commit.

No hosted job was triggered because platform-level preview isolation was not independently read back.
