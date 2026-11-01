# Security

## Supported versions

| Version | Security fixes                     |
| ------- | ---------------------------------- |
| 1.x     | Yes, in the latest 1.x release.    |
| 0.x     | No. Moving to 1.x changes no code. |

## Reporting a vulnerability

Please do not open a public issue. Report it privately on GitHub: on the repository's
[Security tab](https://github.com/ediejohnny/sonicframe/security), press **Report a vulnerability**, or go
straight to [the form](https://github.com/ediejohnny/sonicframe/security/advisories/new). Only the author sees it.

Say what you found, in which entry and version, and how to make it happen. The conversation goes on in that
private report; the fix ships in a patch release, with a note in the changelog, and you are credited there
unless you would rather not be.

## What SonicFrame guarantees

What the library promises (no HTML parsed, a strict Content-Security-Policy, limits on everything from
outside, no dependencies) is described on the [Security](https://ediejohnny.github.io/sonicframe/security.html)
page of the docs. Something that breaks one of those promises is a vulnerability.
