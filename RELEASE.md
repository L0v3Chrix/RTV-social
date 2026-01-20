# Release Process

## Overview

This document describes the release process for the Autonomous Social Media Operating System.

## Versioning

We use [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes to API or behavior
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

## Release Checklist

### Pre-Release

- [ ] All tests passing (`pnpm test`)
- [ ] Lint clean (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] CHANGELOG.md updated
- [ ] Documentation current
- [ ] Security audit passed

### Release

1. Create release branch: `git checkout -b release/vX.Y.Z`
2. Update version in `package.json`
3. Update CHANGELOG.md with release date
4. Create PR for review
5. Merge to main after approval
6. Tag release: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
7. Push tags: `git push origin --tags`
8. Create GitHub release with notes

### Post-Release

- [ ] Verify deployment succeeded
- [ ] Monitor for issues
- [ ] Announce release (if applicable)

## Hotfix Process

For critical production issues:

1. Create hotfix branch from main: `git checkout -b hotfix/vX.Y.Z`
2. Apply fix
3. Update CHANGELOG.md
4. Bump patch version
5. Fast-track review and merge
6. Tag and release immediately

## Rollback

If a release causes issues:

1. Identify the issue and severity
2. If critical: revert to previous version immediately
3. Document in incident log
4. Fix forward when possible
