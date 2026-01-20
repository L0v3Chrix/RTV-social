# Build Prompt: S0-C4 — Preview Deployment Configuration

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-C4 |
| **Sprint** | 0 — Foundation |
| **Agent** | C — CI/CD Pipeline |
| **Complexity** | Medium |
| **Estimated Effort** | 2 hours |
| **Dependencies** | S0-C1 |
| **Blocks** | None |

---

## Context

### What We're Building

Configure Vercel preview deployments for pull requests, allowing reviewers to see changes in a real environment before merging.

### Why This Matters

- **Visual review**: See changes live, not just in code
- **Testing**: Test functionality in a real environment
- **Stakeholder feedback**: Non-developers can review
- **Confidence**: Catch issues before they hit production

### Spec References

- `/docs/07-engineering-process/ci-cd-spec.md#5-preview-deployments`

---

## Prerequisites

### Completed Tasks

- [x] S0-C1: GitHub Actions workflow

### Required Access

- Vercel account with project created
- GitHub integration enabled in Vercel
- Repository connected to Vercel

---

## Instructions

### Phase 1: Test First (TDD)

**File: `scripts/verify-vercel-config.test.ts`**

```typescript
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('Vercel Configuration', () => {
  const rootDir = resolve(__dirname, '..');

  test('vercel.json exists', () => {
    const vercelPath = resolve(rootDir, 'vercel.json');
    expect(existsSync(vercelPath)).toBe(true);
  });

  test('vercel.json has valid structure', () => {
    const vercelPath = resolve(rootDir, 'vercel.json');
    const content = readFileSync(vercelPath, 'utf-8');
    const config = JSON.parse(content);

    expect(config.$schema).toBeDefined();
    expect(config.framework).toBe('nextjs');
  });

  test('vercel.json has build settings', () => {
    const vercelPath = resolve(rootDir, 'vercel.json');
    const config = JSON.parse(readFileSync(vercelPath, 'utf-8'));

    expect(config.buildCommand).toBeDefined();
    expect(config.installCommand).toBeDefined();
  });

  test('vercel.json has environment variables', () => {
    const vercelPath = resolve(rootDir, 'vercel.json');
    const config = JSON.parse(readFileSync(vercelPath, 'utf-8'));

    expect(config.env).toBeDefined();
  });
});
```

### Phase 2: Implementation

#### Step 1: Create Vercel Configuration

**File: `vercel.json`**

```bash
cat > vercel.json << 'EOF'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "pnpm install",
  "buildCommand": "pnpm turbo build --filter=@rtv/web",
  "outputDirectory": "apps/web/.next",
  "ignoreCommand": "git diff HEAD^ HEAD --quiet -- . ':(exclude)docs' ':(exclude)*.md'",
  "git": {
    "deploymentEnabled": {
      "main": true,
      "preview": true
    }
  },
  "env": {
    "TURBO_TEAM": "@rtv",
    "TURBO_REMOTE_ONLY": "true"
  },
  "build": {
    "env": {
      "NEXT_TELEMETRY_DISABLED": "1"
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
EOF
```

#### Step 2: Create GitHub Deployment Workflow

**File: `.github/workflows/preview.yml`**

```bash
cat > .github/workflows/preview.yml << 'EOF'
name: Preview Deployment

on:
  pull_request:
    types: [opened, synchronize, reopened]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  deploy-preview:
    name: Deploy Preview
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install Vercel CLI
        run: pnpm add -g vercel@latest

      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build Project Artifacts
        run: vercel build --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy Preview to Vercel
        id: deploy
        run: |
          url=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
          echo "url=$url" >> $GITHUB_OUTPUT

      - name: Comment PR with Preview URL
        uses: actions/github-script@v7
        with:
          script: |
            const url = '${{ steps.deploy.outputs.url }}';
            const body = `## 🚀 Preview Deployment

            Your preview is ready!

            | Environment | URL |
            |------------|-----|
            | Preview | ${url} |

            <sub>Deployed by GitHub Actions</sub>`;

            // Find existing comment
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });

            const botComment = comments.find(c =>
              c.user.type === 'Bot' && c.body.includes('Preview Deployment')
            );

            if (botComment) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: botComment.id,
                body,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body,
              });
            }
EOF
```

#### Step 3: Create Web App Scaffold (for Vercel)

Since Vercel expects a web app, create a minimal Next.js app structure.

```bash
# Create apps directory
mkdir -p apps/web

# Create package.json for web app
cat > apps/web/package.json << 'EOF'
{
  "name": "@rtv/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@rtv/core": "workspace:*",
    "next": "^14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "workspace:*"
  }
}
EOF

# Create tsconfig.json for web app
cat > apps/web/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.react.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

# Create next.config.js
cat > apps/web/next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@rtv/core', '@rtv/types', '@rtv/utils'],
  experimental: {
    typedRoutes: true,
  },
};

module.exports = nextConfig;
EOF

# Create minimal app structure
mkdir -p apps/web/src/app

cat > apps/web/src/app/layout.tsx << 'EOF'
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RTV Social Automation',
  description: 'Autonomous Social Media Operating System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
EOF

cat > apps/web/src/app/page.tsx << 'EOF'
export default function Home() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>RTV Social Automation</h1>
      <p>Platform is under construction.</p>
      <p>Sprint 0: Foundation</p>
    </main>
  );
}
EOF

# Create next-env.d.ts
cat > apps/web/next-env.d.ts << 'EOF'
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.
EOF
```

#### Step 4: Document Required Secrets

Create documentation for required Vercel secrets.

**File: `docs/00-overview/deployment-secrets.md`**

```bash
mkdir -p docs/00-overview

cat > docs/00-overview/deployment-secrets.md << 'EOF'
# Deployment Secrets

Required secrets for CI/CD and preview deployments.

## Vercel Secrets

These secrets must be configured in GitHub repository settings.

| Secret | Description | How to Get |
|--------|-------------|------------|
| `VERCEL_TOKEN` | Vercel API token | Vercel Dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel organization ID | Vercel Dashboard → Settings → General |
| `VERCEL_PROJECT_ID` | Vercel project ID | Vercel Dashboard → Project → Settings |

## Setup Instructions

1. **Get Vercel Token:**
   - Go to https://vercel.com/account/tokens
   - Create a new token with full access
   - Copy the token value

2. **Get Org and Project IDs:**
   - Link your project: `vercel link`
   - Check `.vercel/project.json` for IDs

3. **Add to GitHub:**
   - Go to Repository → Settings → Secrets and variables → Actions
   - Add each secret

## Turbo Remote Cache (Optional)

For faster builds, configure Turbo remote caching:

| Secret | Description |
|--------|-------------|
| `TURBO_TOKEN` | Vercel-generated Turbo token |
| `TURBO_TEAM` | Your Vercel team slug |

Enable in Vercel Dashboard → Project → Settings → Speed Insights.
EOF
```

### Phase 3: Verification

```bash
# Install dependencies
pnpm install

# Build web app locally
pnpm turbo build --filter=@rtv/web

# Verify Vercel config
cat vercel.json | python3 -c "import sys, json; json.load(sys.stdin)"

# Link to Vercel (interactive)
# vercel link

# Test preview deployment locally
# vercel

# Create a PR to test preview deployment
git checkout -b test/preview-deployment
git add .
git commit -m "ci: Add preview deployment configuration"
git push -u origin test/preview-deployment
# Create PR and verify preview URL appears in comment
```

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Create | `vercel.json` | Vercel configuration |
| Create | `.github/workflows/preview.yml` | Preview deployment workflow |
| Create | `apps/web/package.json` | Web app package |
| Create | `apps/web/tsconfig.json` | Web app TypeScript config |
| Create | `apps/web/next.config.js` | Next.js configuration |
| Create | `apps/web/src/app/layout.tsx` | Root layout |
| Create | `apps/web/src/app/page.tsx` | Home page |
| Create | `docs/00-overview/deployment-secrets.md` | Secrets documentation |
| Create | `scripts/verify-vercel-config.test.ts` | Config tests |

---

## Acceptance Criteria

- [ ] `vercel.json` exists with correct configuration
- [ ] Preview deployment workflow triggers on PR
- [ ] Preview URL posted as PR comment
- [ ] Web app builds successfully
- [ ] Preview deployment works on Vercel
- [ ] Deployment secrets documented

---

## Test Requirements

### Manual Tests

- Create PR → Preview deployment triggered
- Preview URL accessible and shows app
- New commit updates the preview

### Automated Tests

- vercel.json is valid JSON
- Workflow file has correct triggers

---

## Security & Safety Checklist

- [ ] Vercel token stored as secret (not in code)
- [ ] Security headers configured in vercel.json
- [ ] Preview deployments don't connect to production DB
- [ ] No secrets logged in workflow output

---

## JSON Task Block

```json
{
  "task_id": "S0-C4",
  "name": "Preview Deployment Configuration",
  "sprint": 0,
  "agent": "C",
  "status": "pending",
  "complexity": "medium",
  "estimated_hours": 2,
  "dependencies": ["S0-C1"],
  "blocks": [],
  "tags": ["ci", "vercel", "deployment", "preview"],
  "acceptance_criteria": [
    "vercel.json configured",
    "preview workflow triggers on PR",
    "preview URL in PR comment",
    "web app builds"
  ],
  "created_at": "2025-01-16T00:00:00Z",
  "updated_at": null,
  "completed_at": null
}
```

---

## External Memory Section

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "agent_id": null,
  "decisions": [],
  "artifacts": [],
  "notes": []
}
```

---

## Next Steps

After completing this task:

1. **S0-C5**: Set up environment variables management
