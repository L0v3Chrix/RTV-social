# Build Prompt Template

This is the canonical template for all 121 build prompts in the RTV Social Automation PRD v2.

---

## Template Structure

```markdown
# Build Prompt: S[sprint]-[agent][task] — [Task Name]

## Metadata

| Field | Value |
|-------|-------|
| **Task ID** | S0-A1 |
| **Sprint** | 0 - Foundation |
| **Agent** | A (Repository & Core Packages) |
| **Complexity** | Low / Medium / High |
| **Estimated Hours** | 2 |
| **Status** | pending |

---

## Context

[2-4 sentences explaining WHAT this task builds and WHY it matters in the larger system. Reference specific architectural decisions or PRD requirements.]

**Spec References:**
- `/docs/[path]` — Section [X]: [Brief description]
- `/docs/[path]` — Section [Y]: [Brief description]

---

## Prerequisites

### Completed Tasks (Hard Dependencies)
- [ ] None (first task in track) OR
- [ ] S[sprint]-[agent][n-1] — [Previous task name]

### Required Tools/Packages
- Node.js 20+
- pnpm 9+
- [Other tools]

### Required Accounts/Access
- [Access requirements]

---

## Instructions

### Phase 1: Test First (TDD)

**CRITICAL: Write tests BEFORE implementation.**

1. Create test file at `[path]/__tests__/[name].test.ts`

2. Write failing tests for:
   - [ ] [Specific behavior 1]
   - [ ] [Specific behavior 2]
   - [ ] [Specific behavior 3]

3. Example test structure:
   ```typescript
   import { describe, it, expect } from 'vitest';

   describe('[Module Name]', () => {
     it('should [behavior 1]', () => {
       // Arrange
       // Act
       // Assert
       expect(result).toBe(expected);
     });

     it('should [behavior 2]', () => {
       // Test implementation
     });
   });
   ```

4. Run tests to confirm they fail:
   ```bash
   pnpm test [path]
   ```

### Phase 2: Implementation

**Step 1: [First action]**

[Detailed description of what to do]

```bash
[command if applicable]
```

**Step 2: [Second action]**

[Detailed description]

Create file at `[path]`:
```typescript
// File content with actual implementation code
```

**Step 3: [Continue pattern...]**

[More steps as needed]

### Phase 3: Verification

1. Run tests:
   ```bash
   pnpm test
   ```

2. Run type check:
   ```bash
   pnpm typecheck
   ```

3. Run lint:
   ```bash
   pnpm lint
   ```

4. Verify each acceptance criterion manually (see below)

---

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| CREATE | `path/to/new/file.ts` | [Description] |
| MODIFY | `path/to/existing/file.ts` | [What changes] |
| DELETE | `path/to/remove/file.ts` | [Why removing] |

---

## Acceptance Criteria

**All criteria must pass before marking task complete:**

- [ ] [Specific, testable criterion with exact command/check]
- [ ] [Specific, testable criterion with exact command/check]
- [ ] [Specific, testable criterion with exact command/check]
- [ ] `pnpm test` passes with 100% of new tests green
- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm lint` passes with no errors

---

## Test Requirements

### Unit Tests
- **Test file:** `[path].test.ts`
- **Coverage:** [List specific functions/modules to cover]
- **Edge cases:** [List edge cases that must have tests]

### Integration Tests (if applicable)
- **Test file:** `[path].integration.test.ts`
- **Dependencies:** [What systems are tested together]
- **Setup:** [Any required test fixtures or mocks]

### Contract Tests (if applicable)
- **Schema validation:** [What schemas to validate]
- **API contracts:** [What API contracts to verify]

---

## Security & Safety Checklist

**Verify all applicable items:**

- [ ] No secrets hardcoded (use environment variables)
- [ ] No PII logged (redact sensitive data)
- [ ] Tenant isolation enforced (client_id scoping)
- [ ] Audit events emitted (if side effects)
- [ ] Kill switches checked (if side effects)
- [ ] Idempotency implemented (if side effects)
- [ ] Error handling doesn't leak internal details

---

## JSON Task Block

```json
{
  "task_id": "S0-A1",
  "name": "[Task Name]",
  "sprint": 0,
  "agent": "A",
  "status": "pending",
  "tests_status": "not_written",
  "dependencies": [],
  "blocks": ["S0-A2", "S0-A3"],
  "estimated_complexity": "medium",
  "estimated_hours": 2,
  "spec_references": [
    "/docs/01-architecture/system-architecture-v3.md#section",
    "/docs/07-engineering-process/engineering-handbook.md#section"
  ],
  "acceptance_criteria": [
    "Criterion 1",
    "Criterion 2"
  ],
  "test_files": [
    "packages/core/__tests__/module.test.ts"
  ],
  "created_files": [
    "packages/core/src/module.ts",
    "packages/core/src/types.ts"
  ]
}
```

---

## External Memory Section (Agent State)

```json
{
  "episode_id": null,
  "started_at": null,
  "completed_at": null,
  "agent_id": null,
  "pr_number": null,
  "blockers": [],
  "artifacts_created": [],
  "test_results": {
    "unit": null,
    "integration": null,
    "contract": null
  },
  "notes": ""
}
```

---

## Completion Protocol

When task is complete, update:

1. **JSON Task Block:**
   - `"status": "complete"`
   - `"tests_status": "passing"`

2. **External Memory:**
   - `"completed_at": "[ISO timestamp]"`
   - `"test_results": { "unit": true, ... }`
   - `"artifacts_created": [list of files]`

3. **Commit message format:**
   ```
   feat(S0-A1): [Task name]

   - [What was implemented]
   - [Key decisions made]

   Tests: [X] unit, [Y] integration
   Refs: #[issue number if applicable]
   ```
```

---

## Template Usage Notes

### Complexity Ratings

| Rating | Criteria |
|--------|----------|
| **Low** | Single file, well-defined scope, <2 hours |
| **Medium** | Multiple files, some decisions required, 2-4 hours |
| **High** | Cross-cutting concerns, architectural decisions, 4-8 hours |

### Spec Reference Format

Always include:
- Full path to spec document
- Specific section reference (anchor or heading)
- Brief description of what to look for

Example:
```markdown
- `/docs/05-policy-safety/multi-tenant-isolation.md#5-tenant-context-propagation` — TenantContext object schema
```

### Acceptance Criteria Guidelines

Good criteria are:
- **Specific:** Exact command or check to run
- **Measurable:** Pass/fail determination is objective
- **Automated:** Can be verified without manual inspection

Bad:
- "Code should be clean" (subjective)
- "Works correctly" (vague)

Good:
- "`pnpm test packages/core` passes with 0 failures"
- "`TenantContext.tenant_id` is required (TypeScript compile error if missing)"
- "Database query includes `WHERE client_id = ?` clause"

### Security Checklist Usage

Not all items apply to every task:

- **All tasks:** No hardcoded secrets, no PII in logs
- **Data operations:** Tenant isolation
- **Side effects (publish/engage):** Audit events, kill switches, idempotency
- **API routes:** Error handling doesn't leak internals

---

## Example: Minimal Prompt (Low Complexity)

```markdown
# Build Prompt: S0-A4 — ESLint + Prettier Setup

## Metadata
| Field | Value |
|-------|-------|
| **Task ID** | S0-A4 |
| **Sprint** | 0 - Foundation |
| **Agent** | A |
| **Complexity** | Low |
| **Estimated Hours** | 1 |

## Context
Configure ESLint and Prettier for consistent code style across the monorepo.

**Spec References:**
- `/docs/07-engineering-process/engineering-handbook.md#code-style`

## Prerequisites
- [ ] S0-A1 — Monorepo scaffold complete

## Instructions

### Phase 1: Test First
Create `.github/workflows/lint.yml` that runs `pnpm lint` — this acts as the "test."

### Phase 2: Implementation
1. Install: `pnpm add -Dw eslint prettier eslint-config-prettier @typescript-eslint/eslint-plugin`
2. Create `.eslintrc.js` with TypeScript rules
3. Create `.prettierrc` with standard config
4. Add `lint` script to root package.json

### Phase 3: Verification
- `pnpm lint` passes on all files

## Acceptance Criteria
- [ ] `pnpm lint` passes with no errors
- [ ] `.eslintrc.js` exists in root
- [ ] `.prettierrc` exists in root

## JSON Task Block
{
  "task_id": "S0-A4",
  "status": "pending",
  "dependencies": ["S0-A1"],
  "estimated_complexity": "low"
}
```

---

## Example: Full Prompt (High Complexity)

See any Sprint 1+ task for examples of high-complexity prompts with:
- Multiple spec references
- Detailed implementation steps
- Comprehensive test requirements
- Security checklists
- Integration considerations
