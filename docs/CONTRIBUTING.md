# Contributing to GTD for Outlook

Thank you for your interest in contributing to GTD for Outlook!

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+
- A Microsoft 365 account (for integration testing)
- An Azure App Registration with `Mail.ReadWrite` permissions

### Setup

```bash
git clone https://github.com/luizgama/gtd-for-outlook.git
cd gtd-for-outlook
npm ci
cp .env.example .env
# Edit .env with your Azure App credentials
```

### Development

```bash
npm run build          # Compile TypeScript
npm run dev            # Watch mode
npm test               # Run tests
npm run lint           # Type check
```

## Development Guidelines

### Security First

This project processes untrusted email content with LLMs. Security is not optional:

- Read `docs/CLAUDE.md` for mandatory security rules
- Read `docs/specs/06-prompt-injection.md` for the defense strategy
- All email content handling must go through the sanitization pipeline
- Never relax security layers without explicit approval

### Dependency Policy

- **Pin exact versions** — no `^` or `~` in `package.json`
- **Minimize dependencies** — prefer Node.js built-ins
- **No new dependencies** without justification in the PR description
- See `docs/CLAUDE.md` for the full supply chain security policy

### Testing

- Write tests **before** implementation (TDD)
- Unit tests go in `tests/unit/`
- Integration tests go in `tests/integration/`
- Test fixtures go in `tests/fixtures/`
- Include multilingual test cases (EN, PT, ES) for any security-related code

### Commits

- Use clear, descriptive commit messages
- One logical change per commit
- Reference issue numbers where applicable

## Reporting Issues

Please use GitHub Issues to report bugs or request features.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
