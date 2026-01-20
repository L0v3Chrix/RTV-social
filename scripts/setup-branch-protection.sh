#!/usr/bin/env bash
#
# S0-C3: Branch Protection Setup Script
#
# Configures GitHub branch protection rules for the main branch using the gh CLI.
# This script implements the protection rules documented in:
#   docs/07-engineering-process/branch-protection-settings.md
#
# Prerequisites:
#   - gh CLI installed (https://cli.github.com/)
#   - Authenticated with: gh auth login
#   - Admin access to the repository
#
# Usage:
#   ./scripts/setup-branch-protection.sh [--dry-run]
#
# Options:
#   --dry-run    Show what would be configured without making changes
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

REPO_OWNER="raize-the-vibe"
REPO_NAME="rtv-social-automation"
BRANCH="main"
FULL_REPO="${REPO_OWNER}/${REPO_NAME}"

# Required status checks (from ci.yml)
# The "CI OK" job is the summary job that depends on all other CI jobs
REQUIRED_CHECKS=("CI OK")

# Number of required approving reviews
REQUIRED_REVIEWERS=1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if gh CLI is installed
    if ! command -v gh &> /dev/null; then
        log_error "gh CLI is not installed."
        echo ""
        echo "Install it from: https://cli.github.com/"
        echo ""
        echo "On macOS: brew install gh"
        echo "On Ubuntu: sudo apt install gh"
        exit 1
    fi

    # Check if authenticated
    if ! gh auth status &> /dev/null; then
        log_error "Not authenticated with gh CLI."
        echo ""
        echo "Run: gh auth login"
        exit 1
    fi

    # Check repository access
    if ! gh repo view "$FULL_REPO" &> /dev/null; then
        log_error "Cannot access repository: $FULL_REPO"
        echo ""
        echo "Make sure you have admin access to the repository."
        exit 1
    fi

    log_success "All prerequisites met."
}

show_current_settings() {
    log_info "Current branch protection settings for '$BRANCH':"
    echo ""

    # Try to get current settings
    if gh api "repos/${FULL_REPO}/branches/${BRANCH}/protection" 2>/dev/null; then
        echo ""
    else
        log_warning "No branch protection rules currently configured for '$BRANCH'"
        echo ""
    fi
}

show_planned_settings() {
    echo ""
    echo "============================================================================="
    echo "PLANNED BRANCH PROTECTION SETTINGS"
    echo "============================================================================="
    echo ""
    echo "Repository: $FULL_REPO"
    echo "Branch: $BRANCH"
    echo ""
    echo "Required Status Checks:"
    echo "  - Strict mode: YES (branch must be up-to-date)"
    for check in "${REQUIRED_CHECKS[@]}"; do
        echo "  - Required check: $check"
    done
    echo ""
    echo "Pull Request Reviews:"
    echo "  - Required approvals: $REQUIRED_REVIEWERS"
    echo "  - Dismiss stale reviews: YES"
    echo "  - Require code owner reviews: NO"
    echo "  - Last pusher cannot self-approve: YES"
    echo ""
    echo "Conversation Resolution:"
    echo "  - Required: YES"
    echo ""
    echo "Branch Integrity:"
    echo "  - Linear history required: YES"
    echo "  - Force pushes allowed: NO"
    echo "  - Deletions allowed: NO"
    echo ""
    echo "Admin Enforcement:"
    echo "  - Include administrators: YES"
    echo ""
    echo "============================================================================="
}

apply_branch_protection() {
    log_info "Applying branch protection rules..."

    # Build the required_status_checks JSON array
    local checks_json=""
    for check in "${REQUIRED_CHECKS[@]}"; do
        if [ -n "$checks_json" ]; then
            checks_json="$checks_json,"
        fi
        checks_json="$checks_json\"$check\""
    done

    # Apply branch protection using the GitHub API via gh
    # Documentation: https://docs.github.com/en/rest/branches/branch-protection
    gh api \
        --method PUT \
        "repos/${FULL_REPO}/branches/${BRANCH}/protection" \
        -H "Accept: application/vnd.github+json" \
        -f required_status_checks='{"strict":true,"contexts":['$checks_json']}' \
        -f enforce_admins=true \
        -f required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":'$REQUIRED_REVIEWERS',"require_last_push_approval":true}' \
        -f restrictions=null \
        -f required_linear_history=true \
        -f allow_force_pushes=false \
        -f allow_deletions=false \
        -f required_conversation_resolution=true \
        --silent

    if [ $? -eq 0 ]; then
        log_success "Branch protection rules applied successfully!"
    else
        log_error "Failed to apply branch protection rules."
        exit 1
    fi
}

verify_settings() {
    log_info "Verifying applied settings..."
    echo ""

    local protection
    protection=$(gh api "repos/${FULL_REPO}/branches/${BRANCH}/protection" 2>/dev/null)

    if [ -z "$protection" ]; then
        log_error "Could not retrieve branch protection settings for verification."
        return 1
    fi

    echo "Verification Results:"
    echo ""

    # Check required status checks
    local strict_mode
    strict_mode=$(echo "$protection" | jq -r '.required_status_checks.strict // false')
    if [ "$strict_mode" = "true" ]; then
        echo -e "  ${GREEN}[OK]${NC} Strict mode enabled"
    else
        echo -e "  ${RED}[FAIL]${NC} Strict mode not enabled"
    fi

    # Check enforce admins
    local enforce_admins
    enforce_admins=$(echo "$protection" | jq -r '.enforce_admins.enabled // false')
    if [ "$enforce_admins" = "true" ]; then
        echo -e "  ${GREEN}[OK]${NC} Admin enforcement enabled"
    else
        echo -e "  ${RED}[FAIL]${NC} Admin enforcement not enabled"
    fi

    # Check required reviews
    local review_count
    review_count=$(echo "$protection" | jq -r '.required_pull_request_reviews.required_approving_review_count // 0')
    if [ "$review_count" -ge "$REQUIRED_REVIEWERS" ]; then
        echo -e "  ${GREEN}[OK]${NC} Required reviewers: $review_count"
    else
        echo -e "  ${RED}[FAIL]${NC} Required reviewers: $review_count (expected $REQUIRED_REVIEWERS)"
    fi

    # Check dismiss stale reviews
    local dismiss_stale
    dismiss_stale=$(echo "$protection" | jq -r '.required_pull_request_reviews.dismiss_stale_reviews // false')
    if [ "$dismiss_stale" = "true" ]; then
        echo -e "  ${GREEN}[OK]${NC} Dismiss stale reviews enabled"
    else
        echo -e "  ${RED}[FAIL]${NC} Dismiss stale reviews not enabled"
    fi

    # Check linear history
    local linear_history
    linear_history=$(echo "$protection" | jq -r '.required_linear_history.enabled // false')
    if [ "$linear_history" = "true" ]; then
        echo -e "  ${GREEN}[OK]${NC} Linear history required"
    else
        echo -e "  ${RED}[FAIL]${NC} Linear history not required"
    fi

    # Check force pushes blocked
    local force_pushes
    force_pushes=$(echo "$protection" | jq -r '.allow_force_pushes.enabled // true')
    if [ "$force_pushes" = "false" ]; then
        echo -e "  ${GREEN}[OK]${NC} Force pushes blocked"
    else
        echo -e "  ${RED}[FAIL]${NC} Force pushes not blocked"
    fi

    # Check deletions blocked
    local deletions
    deletions=$(echo "$protection" | jq -r '.allow_deletions.enabled // true')
    if [ "$deletions" = "false" ]; then
        echo -e "  ${GREEN}[OK]${NC} Deletions blocked"
    else
        echo -e "  ${RED}[FAIL]${NC} Deletions not blocked"
    fi

    # Check conversation resolution
    local conversation_resolution
    conversation_resolution=$(echo "$protection" | jq -r '.required_conversation_resolution.enabled // false')
    if [ "$conversation_resolution" = "true" ]; then
        echo -e "  ${GREEN}[OK]${NC} Conversation resolution required"
    else
        echo -e "  ${RED}[FAIL]${NC} Conversation resolution not required"
    fi

    echo ""
    log_success "Verification complete."
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    echo ""
    echo "============================================================================="
    echo "RTV Social Automation - Branch Protection Setup"
    echo "============================================================================="
    echo ""

    local dry_run=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                dry_run=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [--dry-run]"
                echo ""
                echo "Options:"
                echo "  --dry-run    Show what would be configured without making changes"
                echo "  -h, --help   Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information."
                exit 1
                ;;
        esac
    done

    check_prerequisites

    if [ "$dry_run" = true ]; then
        log_warning "DRY RUN MODE - No changes will be made"
        echo ""
        show_current_settings
        show_planned_settings
        echo ""
        log_info "To apply these settings, run without --dry-run flag."
    else
        show_planned_settings
        echo ""
        read -p "Do you want to apply these settings? (y/N) " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            apply_branch_protection
            echo ""
            verify_settings
        else
            log_info "Operation cancelled."
        fi
    fi

    echo ""
    echo "============================================================================="
    echo "For manual configuration, see:"
    echo "  docs/07-engineering-process/branch-protection-settings.md"
    echo "============================================================================="
    echo ""
}

main "$@"
