# Vercel Environment Variables

This document describes the required environment variables for Vercel preview and production deployments.

## Required GitHub Secrets

These secrets must be configured in GitHub repository settings under **Settings > Secrets and variables > Actions**.

### Vercel Authentication

| Variable | Description | Required | Where to Find |
|----------|-------------|----------|---------------|
| `VERCEL_TOKEN` | Personal access token for Vercel CLI authentication | Yes | [Vercel Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Organization/Team ID for deployment | Yes | Project Settings > General > Team ID |
| `VERCEL_PROJECT_ID` | Project ID for deployment | Yes | Project Settings > General > Project ID |

### How to Obtain Vercel Credentials

1. **VERCEL_TOKEN**:
   - Go to [Vercel Tokens](https://vercel.com/account/tokens)
   - Create a new token with appropriate scope
   - Copy the token value (shown only once)

2. **VERCEL_ORG_ID** and **VERCEL_PROJECT_ID**:
   - Run `vercel link` in your project directory
   - Check `.vercel/project.json` for the IDs
   - Or find them in Vercel Dashboard > Project Settings

## Optional Build Variables

These can be set in GitHub Secrets or Vercel project settings.

| Variable | Description | Default |
|----------|-------------|---------|
| `TURBO_TOKEN` | Turborepo remote cache token | - |
| `TURBO_TEAM` | Turborepo team name | - |
| `NODE_VERSION` | Node.js version for builds | 20 |
| `PNPM_VERSION` | pnpm version for builds | 8 |

## Preview Deployment Variables

Preview deployments automatically use the following:

- **Environment**: `preview`
- **Branch-based URLs**: Each PR gets a unique preview URL
- **Isolation**: Preview deployments are isolated from production

### Preview URL Pattern

Preview URLs follow the pattern:
```
https://<project>-<unique-hash>-<team>.vercel.app
```

## Production Deployment Variables

Production deployments on the `main` branch use:

- **Environment**: `production`
- **Domain**: Configured custom domain or default Vercel domain

## Setting Up GitHub Secrets

### Via GitHub CLI

```bash
# Set Vercel secrets
gh secret set VERCEL_TOKEN --body "your-vercel-token"
gh secret set VERCEL_ORG_ID --body "your-org-id"
gh secret set VERCEL_PROJECT_ID --body "your-project-id"

# Optional: Turborepo cache
gh secret set TURBO_TOKEN --body "your-turbo-token"
```

### Via GitHub Web UI

1. Go to repository **Settings**
2. Navigate to **Secrets and variables > Actions**
3. Click **New repository secret**
4. Add each required secret

## Vercel Project Configuration

The `vercel.json` file in the project root configures:

```json
{
  "buildCommand": "pnpm turbo build --filter=@rtv/web",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": "apps/web/.next"
}
```

## Security Notes

1. **Never commit secrets** to the repository
2. **Rotate tokens regularly** (recommended: every 90 days)
3. **Use scoped tokens** with minimum required permissions
4. **Review access** periodically in Vercel Dashboard

## Troubleshooting

### Common Issues

1. **"VERCEL_TOKEN is not set"**
   - Ensure the secret is added to GitHub repository settings
   - Check the secret name matches exactly (case-sensitive)

2. **"Project not found"**
   - Verify `VERCEL_PROJECT_ID` matches your project
   - Ensure the token has access to the project

3. **"Unauthorized"**
   - Token may be expired or revoked
   - Token may not have sufficient permissions

### Verifying Configuration

```bash
# Test Vercel CLI authentication
vercel whoami

# List projects
vercel projects list

# Pull project settings
vercel pull --yes
```

## Related Documentation

- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Turborepo Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
