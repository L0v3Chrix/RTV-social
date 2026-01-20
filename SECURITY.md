# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT** create a public GitHub issue
2. Email: security@raizethevibe.com (or your preferred contact)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Resolution Timeline**: Depends on severity
  - Critical: 24-48 hours
  - High: 1 week
  - Medium: 2 weeks
  - Low: Next release

### Security Measures

This project implements the following security measures:

#### Data Protection

- **Tenant Isolation**: All queries scoped by `client_id`
- **No Raw Secrets**: Only secret references stored (never plaintext)
- **Encryption**: Secrets encrypted at rest
- **BYOK**: Client-specific API keys, isolated per tenant

#### Access Control

- **RBAC**: Role-Based Access Control with least privilege
- **Audit Logging**: All side effects emit audit events
- **Session Management**: Secure token handling

#### Operational Security

- **Kill Switches**: Per-client and global circuit breakers
- **Fail Closed**: Policy failures block actions
- **Observability**: Full tracing for incident investigation

#### Code Security

- **Dependency Scanning**: Automated vulnerability checks
- **Static Analysis**: Security linting in CI
- **Code Review**: Required for all changes

### Security Contacts

- Primary: Chrix (project owner)
- Escalation: [TBD]

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who help us improve our security posture.
