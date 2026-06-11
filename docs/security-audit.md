# Security Audit Notes

Last checked: 2026-06-10

Command:

```bash
npm audit --omit=dev
```

Current status:

- Critical vulnerabilities: 0
- High vulnerabilities: 0
- Remaining vulnerabilities: 7 moderate

Residual items:

- `next` depends on a nested `postcss` version flagged by npm audit. The available npm audit fix currently points to `next@16.3.0-preview.0`, which is a preview release. This project is pinned to stable `next@16.2.8` for beta readiness.
- `@google-cloud/storage@7.21.0` still pulls a dependency chain with `uuid < 11.1.1` through Google client libraries. npm audit suggests a force fix that downgrades `@google-cloud/storage` to `5.18.3`, which is a breaking change and not appropriate without a storage regression test pass.

Risk acceptance for beta:

- The previous critical/high findings were addressed by dependency updates and removal of `react-simple-maps`.
- The remaining findings are moderate and transitive.
- Before full general availability, re-run audit and upgrade to stable patched upstream releases when available.
