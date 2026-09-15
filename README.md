## Getting Started

### Prerequisites

- Node.js (version ^20.17.0)
- yarn (version ^v1.22.19)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/Talisik/Downlodr.git
   ```

2. Navigate to the project directory:
   ```
   cd Downlodr
   ```

3. Install the dependencies:
   ```
   yarn
   ```

4. Set up the backend dev packages:
   ```
   yarn packages:setup
   ```
   See the "Dev packages" section below for details.

5. Fetch the runtime binaries (ffmpeg and the whisper model):
   ```
   yarn binaries:setup
   ```

6. Optional: copy `.env.example` to `.env` and fill in any endpoints you want
   to enable. Every value is empty by default, which keeps those features off.

7. You're good to go!

### Dev packages

The Skedulosa backend is a separate repo cloned into a gitignored folder —
see the `downlodrDev` field in `package.json` for the expected version, repo
URL, and path. The AFDA backend is not publicly available. Manage them with:

- `yarn packages:setup` — first-time setup: clones every missing package and
  checks out its blessed release tag.
- `yarn packages:check` — shows whether your local packages match the
  versions this branch expects. Runs automatically before `yarn start`, so
  update notices are impossible to miss.
- `yarn packages:update` — fetches and checks out the expected release tag
  for any outdated package, then runs its install/build steps. A package
  with uncommitted local changes is skipped with a warning, never
  overwritten.

Releasing a new package version: in the package repo, bump its
`package.json` version, then `git tag v<version>-downlodr` (e.g.
`v1.3.0-downlodr` — the suffix marks releases blessed for Downlodr) and
`git push --tags`.
Finally bump the matching version in `downlodrDev` here and push — the team
sees the update notice on their next `yarn start`.

### AI chat CLI bundle (`downlodr-mcp`)

The embedded AI chat controls the app by shelling out to a `downlodr` CLI, which
lives in this repo at `downlodr-mcp/`. Unlike the dev packages above there is
nothing to clone and no access needed — only its build outputs (`node_modules/`,
`dist/`) are gitignored, and `yarn start` rebuilds them for you via
`scripts/mcp-bundle.mjs`. The app itself puts the `downlodr` shim on your PATH
at launch, so **new devs normally run no extra command for this**.

- `yarn mcp:setup` — installs the package's dependencies and builds the bundle
  by hand. Only needed if the automatic prestart build fails.
- `yarn mcp:build` — forces a rebuild. The prestart build is incremental (it
  rebuilds when `downlodr-mcp/src` is newer than `dist/index.js`), so this is
  just an escape hatch.

A failed build warns but never blocks `yarn start` — the rest of the app runs
fine, only the chat agent loses its CLI. Packaged builds are covered separately
by `forge.config.ts`'s `prePackage` hook, which always rebuilds and fails hard.

Do **not** `npm link` this package — the app owns the shim now, and a leftover
linked binary can shadow it and pin the agent to a stale bundle. If you ran it
before, `npm unlink -g downlodr-mcp` once.

### Running the Application

To start the application in development mode:
   ```
yarn start
   ```

### Building and Packaging

To build and package the application:
   ```
yarn make
   ```


## Contributing

We welcome contributions from the community! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to get involved.

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a welcoming and inclusive environment for all contributors and users.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- The yt-dlp project, FFMPEG project, and WhisperX project for providing the core downloading functionality
- All contributors who have helped make Downlodr better.
