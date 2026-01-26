<!--
Guidance for AI coding agents working on this repository.
This repo is currently empty. The instructions below are targeted and actionable
—they tell an agent exactly how to discover the project's architecture and
workflows once source files are present and how to produce high-value changes
that fit the project's structure.
-->

# Copilot instructions for replyoai-backend

Summary
- This repository is empty now. When files are added, follow the "Discovery
  checklist" below to build an accurate, minimal mental model of the project
  and then produce targeted code changes or documentation.

Discovery checklist (run first)
- Look for manifest files (use this order): `package.json`, `pyproject.toml`,
  `requirements.txt`, `Pipfile`, `go.mod`, `Cargo.toml`. The presence of any of
  these determines language and common dev commands.
- Open top-level `README.md`, `Dockerfile`, and `.github/workflows/*` if present
  to learn run/build/test commands and CI expectations.
- Locate probable entry points: top-level `src/`, `app/`, `server.py`, `manage.py`,
  `main.go`, or `cmd/` directories. Search for `if __name__ == "__main__"`,
  `func main()`, or similar patterns to find the app start logic.
- Search for configuration files: `.env`, `.env.example`, `config/*.yml`,
  `settings.py`, `config.py`. Note required environment variables and secrets.
- Inspect `tests/`, `spec/`, `__tests__/` to learn test framework and how tests
  are structured and run.

Actionable development patterns
- Languages & commands (auto-detect from manifests):
  - Node.js: run `npm ci` or `yarn install` then `npm test` or `npm run build`.
  - Python (pyproject/requirements): create venv, `pip install -r requirements.txt` or
    `poetry install`; tests via `pytest`.
  - Go (go.mod): `go test ./...`, `go build ./...`.
  Always read the repository `README.md` and CI workflows to confirm exact commands.
- Docker: if `Dockerfile` exists, prefer reproducing CI build steps locally
  (`docker build` / `docker run`) to validate runtime behavior.

How to infer architecture quickly
- If you find multiple services (folders named `service-*`, `api`, `worker`):
  - Map service boundaries by reading each service's `main` or entry file.
  - Note communication patterns: HTTP endpoints (look for frameworks like
    `express`, `fastapi`, `flask`), message queues (look for `rabbitmq`,
    `redis`, `kafka` packages), or direct DB access.
- For monoliths: look for layered structure (`api/`, `core/`, `db/`, `jobs/`).
  Identify where models, controllers, and data access live and prefer editing
  in the layer appropriate to the change.

Testing and CI
- If `.github/workflows` includes jobs, follow the same commands locally
  to iterate quickly. Examples in repo will usually show `setup-node`,
  `setup-python`, or `docker` steps — mirror them locally.
- Run a subset of tests touching changed files first (pytest -k, go test ./pkg).

Conventions and code patterns to follow
- Naming: look for consistent directory names like `services/`, `lib/`, or `pkg/`.
  Follow the same naming, import, and package structure.
- Error handling: prefer the project's existing pattern (exceptions vs return
  codes). Copy the surrounding style when adding new checks.
- Config: read and respect `.env.example` and central `config` modules —
  prefer adding feature flags to the same config layer.

Delivering changes
- When creating or modifying files, add or update tests under the same test
  structure. If no tests exist, add focused unit tests for logic-heavy code.
- Update `README.md` with any new developer commands (build, run, test).

Merging guidance (if an existing `.github/copilot-instructions.md` appears)
- Preserve any repository-specific commands and examples.
- Add missing items from this template only when they can be verified from
  repository files (don't add speculative run commands).

Questions for the human maintainer
- Which branch is the development branch (main, develop, trunk)? Add here.
- Are there preferred CI runners or secrets I should avoid touching?

If you want, I can now:
- Create an initial `README.md` scaffold and a minimal CI job,
- Or wait and re-run discovery after you push the current project files.

-- End of file
