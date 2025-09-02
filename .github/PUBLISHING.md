# GitHub Action Setup for NPM Publishing

This repository includes a GitHub Action that automatically builds and publishes the `ngx-json-visualizer` library to NPM when a version tag is pushed.

## Setup Instructions

### 1. NPM Token Setup

1. Go to [npmjs.com](https://www.npmjs.com) and log in to your account
2. Click on your profile picture → "Access Tokens"
3. Click "Generate New Token" → "Automation" (for GitHub Actions)
4. Copy the generated token
5. In your GitHub repository, go to Settings → Secrets and Variables → Actions
6. Click "New repository secret"
7. Name: `NPM_TOKEN`
8. Value: Paste your NPM token

### 2. Publishing a New Version

To publish a new version of the library:

1. Update the version in `projects/ngx-json-visualizer/package.json`
2. Commit your changes
3. Create and push a version tag:
   ```bash
   git tag v1.0.0  # Replace with your version
   git push origin v1.0.0
   ```

The GitHub Action will automatically:
- Build the library
- Run tests and linting
- Update the package version based on the tag
- Publish to NPM
- Create a GitHub release

### 3. Manual Triggering

You can also manually trigger the workflow from the GitHub Actions tab by clicking "Run workflow".

### 4. Workflow Features

- ✅ Installs dependencies with pnpm
- ✅ Runs ESLint for code quality
- ✅ Runs tests in headless Chrome
- ✅ Builds the library in production mode
- ✅ Updates package version from Git tag
- ✅ Publishes to NPM with public access
- ✅ Creates a GitHub release

### 5. Requirements

- Node.js 20
- pnpm package manager
- Valid NPM account and token
- Properly configured Angular library structure

The workflow will only run on:
- Push events to version tags (e.g., `v1.0.0`, `v2.1.3`)
- Manual workflow dispatch
