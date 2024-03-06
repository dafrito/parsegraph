# Deploying

Github Actions will try to deploy all pushes to main.

## Prerequisites

For deployments to work, all you need to do is change the version number and push to main.

If linting, testing, building, and generating coverage and docs all work, the build is published to NPM. The docs are published to parsegraph.com/docs

## Secrets

### PARSEGRAPH_SSH_HOST

Format: user@example.com

The SSH host used for ssh commands. Do not include a trailing colon.

### PARSEGRAPH_SSH_TOKEN

Format: pasted contents of SSH private key

The next token must be kept in sync with this one.

### PARSEGRAPH_SSH_TOKEN_SHA1SUM

Format: only the SHA1 hash string; do not include the filename or spaces

This is the SHA1 hash of the token used for PARSEGRAPH_SSH_TOKEN.

### PARSEGRAPH_SSH_KNOWN_HOST

Format: The lines from ~/.ssh/known_hosts corresponding to the PARSEGRAPH_SSH_HOST

### NPM_PUBLISH_TOKEN

The NPM token used for yarn deploy
