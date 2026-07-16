<div align="center">

# 🌩️ Thunder Jr — Advanced Discord Music Bot

**A high-performance, enterprise-grade Discord music bot** built on [Necord](https://necord.org/) (Discord.js v14 for [NestJS](https://nestjs.com/)), streaming audio with [DisTube](https://distube.js.org/) and persisting playlists & statistics in **PostgreSQL** via [Prisma](https://www.prisma.io/).

<!-- CI status -->

[![Build](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/build.yml/badge.svg)](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/build.yml)
[![Lint](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/lint.yml/badge.svg)](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/lint.yml)
[![Test](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/test.yml/badge.svg)](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/test.yml)
[![Commit Message Validation](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/commit-msg-validation.yml/badge.svg)](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/commit-msg-validation.yml)

<!-- Tech stack -->

![NestJS](https://img.shields.io/badge/NestJS_11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![Necord](https://img.shields.io/badge/Necord_6-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Discord.js](https://img.shields.io/badge/discord.js_14-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js_20+-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)
<br/>
![DisTube](https://img.shields.io/badge/DisTube_5-2B2D31?style=for-the-badge&logo=youtube&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
<br/>
![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint_10-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)
![Prettier](https://img.shields.io/badge/Prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=black)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)

</div>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Commands](#-commands)
- [Data Model](#-data-model)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Available Scripts](#-available-scripts)
- [Testing](#-testing)
- [Code Quality & CI](#-code-quality--ci)
- [Contributing](#-contributing)
- [License](#-license)

---

## ⭐ Overview

**Thunder Jr** is a feature-rich Discord music bot that pairs a modern, modular NestJS backend with powerful multi-source audio streaming. Every user action is a native Discord **slash command**, responses are rendered as rich **embeds**, and interactive flows (like duplicate handling) use **buttons and select menus**.

Beyond playback, the bot is **stateful**: playlists and listening history are stored in **PostgreSQL**, enabling saved playlists and per-server / per-user statistics that survive restarts.

The codebase is **fully covered by an automated test suite** (36 suites / 323 tests) and guarded by a complete CI pipeline (build, lint, test, commit-message and PR validation).

---

## ✨ Key Features

- 🎵 **Multi-platform playback** — YouTube (via `yt-dlp`), Spotify, and SoundCloud, all through a single `/play`.
- 📋 **Full queue management** — view, skip, stop, remove-by-position-or-name, shuffle, and loop (OFF / SONG / QUEUE).
- 💾 **Persistent playlists** — save the current queue and reload it later; playlists are stored per user in PostgreSQL.
- 🧠 **Smart duplicate detection** — when loading/adding, duplicates are detected and resolved through an interactive prompt.
- 📊 **Listening statistics** — server-wide top songs & top DJs, plus personal stats, backed by a `MusicHistory` table.
- 🎤 **Lyrics lookup** — fetch lyrics for the current song or search by name, with resilient fallbacks.
- 🔊 **Rich now-playing** — live progress bar, requester, duration, and source link.
- 🎚️ **Volume control** — adjustable from 1–100.
- 🤝 **Voice auto-join** — detects and joins the requester's voice channel automatically.
- 🧩 **Interactive UX** — Discord embeds, buttons, and select menus throughout.

---

## 🧱 Tech Stack

### Core Framework & Runtime

| Technology | Version | Role |
| --- | --- | --- |
| [**NestJS**](https://nestjs.com/) | 11 | Modular, dependency-injected application framework. |
| [**Necord**](https://necord.org/) | 6 | Integrates Discord.js into NestJS via decorators (`@SlashCommand`, `@Options`, …). |
| [**Discord.js**](https://discord.js.org/) | 14 | Underlying Discord API client (gateway, REST, voice). |
| [**TypeScript**](https://www.typescriptlang.org/) | 5 | Static typing across the entire codebase. |
| [**Node.js**](https://nodejs.org/) | 20+ | JavaScript runtime. |

### Music & Audio

| Technology | Role |
| --- | --- |
| [**DisTube**](https://distube.js.org/) 5 | Playback engine — queue, voice, and stream orchestration. |
| [**@distube/yt-dlp**](https://www.npmjs.com/package/@distube/yt-dlp) | YouTube extraction. |
| [**@distube/spotify**](https://www.npmjs.com/package/@distube/spotify) | Resolves Spotify tracks/playlists. |
| [**@distube/soundcloud**](https://www.npmjs.com/package/@distube/soundcloud) | SoundCloud support. |
| [**FFmpeg**](https://ffmpeg.org/) + [**@discordjs/opus**](https://www.npmjs.com/package/@discordjs/opus) | Audio transcoding & Opus encoding (bundled — no manual install needed). |

### Data & Persistence

| Technology | Role |
| --- | --- |
| [**Prisma**](https://www.prisma.io/) 7 | Type-safe ORM; client generated to `src/generated/prisma`. |
| [**@prisma/adapter-pg**](https://www.npmjs.com/package/@prisma/adapter-pg) | Driver adapter running Prisma over a `pg` connection pool. |
| [**PostgreSQL**](https://www.postgresql.org/) | Relational store for users, playlists, songs, and history. |

### Tooling & Quality

| Technology | Role |
| --- | --- |
| [**pnpm**](https://pnpm.io/) | Fast, disk-efficient package manager (with patches & overrides). |
| [**Jest**](https://jestjs.io/) + ts-jest | Unit testing (36 suites / 323 tests). |
| [**ESLint**](https://eslint.org/) 10 (flat config) + [typescript-eslint](https://typescript-eslint.io/) | Type-checked linting. |
| [**Prettier**](https://prettier.io/) | Consistent formatting (tabs, single quotes). |
| [**Husky**](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) | Pre-commit lint/format. |
| [**commitlint**](https://commitlint.js.org/) | Enforces the Conventional Commits format. |
| [**GitHub Actions**](https://github.com/features/actions) | CI: build, lint, test, and commit/PR validation. |

---

## 🏗️ Architecture

Thunder Jr follows a **feature-modular** architecture with a strict presentation ↔ business-logic separation:

- **Command classes** (presentation) — route the interaction, validate basic state, build embeds, and **delegate to services**. They stay thin.
- **Services** (business logic) — hold the real work: queue operations, persistence, stats aggregation, lyrics, etc.
- **`DisTubeService`** (audio infrastructure) — wraps the DisTube client and its event lifecycle.
- **`PrismaService`** (data infrastructure) — builds a `pg.Pool` + `PrismaPg` adapter and exposes the typed client; cleaned up on shutdown via lifecycle hooks.

Each feature lives under `src/features/<feature>/` and owns its own `commands/`, `services/`, `components/`, `dto/`, `utils/`, `enums/`, and `interfaces/`, wired together by a `<feature>.module.ts`. The path alias `@/` maps to `src/`.

---

## 📂 Project Structure

```text
src/
├── main.ts                     # Bootstrap + Nest shutdown hooks
├── app.module.ts               # Root module
├── bot.gateway.ts              # Discord ready / lifecycle gateway
├── core/                       # LoggerService and cross-cutting concerns
├── config/                     # Configuration (env, intents)
├── prisma/                     # PrismaService (pg Pool + adapter)
├── generated/prisma/           # Generated Prisma client (git-ignored, never edited)
└── features/
    ├── music/                  # Main feature
    │   ├── commands/           # play, skip, stop, queue, nowplaying, volume,
    │   │                       #   remove, loop, shuffle, lyrics, playlist, stats
    │   ├── services/           # DisTubeService, MusicService, PlaylistStorageService,
    │   │                       #   MusicStatsService, LyricsService, YoutubeApiService, …
    │   ├── components/          # Buttons & select menus
    │   ├── dto/                 # Slash-command option DTOs
    │   ├── utils/               # Embed builders, validation helpers
    │   ├── enums/ · interfaces/
    │   └── music.module.ts
    └── utility/                # help, ping
        └── utility.module.ts
```

---

## 🎮 Commands

### 🎵 Music

| Command | Description |
| --- | --- |
| `/play <query>` | Play from a YouTube / Spotify / SoundCloud URL, or search by keywords. |
| `/skip` | Skip the current song. |
| `/stop` | Stop playback and clear the queue. |
| `/queue` | Show the current music queue. |
| `/nowplaying` | Show the current song with a live progress bar. |
| `/volume <1-100>` | Set the playback volume. |
| `/remove <position \| name>` | Remove a song from the queue by position or name. |
| `/loop [mode]` | Cycle loop mode: **OFF / SONG / QUEUE**. |
| `/shuffle` | Randomly shuffle the queue order. |
| `/lyrics [name]` | Show lyrics for the current song, or search by name. |

### 💾 Playlists — `/playlist` _(persisted in PostgreSQL)_

| Command | Description |
| --- | --- |
| `/playlist save <name>` | Save the current queue as a named playlist. |
| `/playlist load <name>` | Load a saved playlist into the queue. |
| `/playlist list` | Show your saved playlists. |
| `/playlist delete <name>` | Delete a saved playlist. |

### 📊 Statistics — `/stats`

| Command | Description |
| --- | --- |
| `/stats server` | Server-wide statistics — top songs and top DJs. |
| `/stats me` | Your personal listening statistics _(private)_. |

### 🛠️ Utility

| Command | Description |
| --- | --- |
| `/help` | Interactive help listing every command. |
| `/ping` | Check the bot's latency and responsiveness. |

> 💡 **Tip:** run `/help` in Discord for detailed, always-up-to-date usage of each command.

---

## 🗄️ Data Model

Prisma models (mapped to snake-case tables) persisted in PostgreSQL:

| Model | Table | Purpose |
| --- | --- | --- |
| `User` | `users` | Discord users who own playlists. |
| `Playlist` | `playlists` | A named, per-user collection of songs. |
| `Song` | `songs` | A track saved inside a playlist (title, url, duration, position…). |
| `MusicHistory` | `music_history` | Every played track, per guild & user — powers `/stats`. |

Relationships cascade on delete (`User → Playlist → Song`), and ownership filters (guild/user) are kept explicit in every playlist and stats query.

---

## 🚀 Getting Started

### Prerequisites

- [**Node.js**](https://nodejs.org/) 20.x LTS or newer
- [**pnpm**](https://pnpm.io/installation) (this repo uses pnpm patches & overrides — **do not** substitute npm/yarn)
- A running [**PostgreSQL**](https://www.postgresql.org/) database
- A **Discord Bot Token** from the [Discord Developer Portal](https://discord.com/developers/applications)

> FFmpeg and Opus are installed automatically as dependencies — no separate system install required.

### Installation

```bash
# 1. Clone
git clone https://github.com/htnghia1423/thunder-jr-necord.git
cd thunder-jr-necord

# 2. Install dependencies
pnpm install

# 3. Configure environment (see the table below)
cp .env.example .env   # then fill in DISCORD_TOKEN and DATABASE_URL

# 4. Set up the database (creates tables & generates the typed client)
pnpm prisma migrate dev

# 5. Run in watch mode
pnpm start:dev
```

### Discord setup

The bot registers the following [gateway intents](https://discord.com/developers/docs/topics/gateway#gateway-intents): `Guilds`, `GuildVoiceStates`, and `GuildMessages`. Make sure your bot is invited with permission to **Connect** and **Speak** in voice channels and to send messages.

---

## 🔧 Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Description |
| --- | :---: | --- |
| `DISCORD_TOKEN` | ✅ | Bot token from the Discord Developer Portal. |
| `DATABASE_URL` | ✅ | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/thunder`. |
| `GUILD_ID` | ⬜ | Restrict slash-command registration to one guild for **instant** dev updates. Leave empty to register globally (can take ~1 hour to propagate). |
| `YOUTUBE_API_KEY` | ⬜ | YouTube Data API key used to enrich stats/search features. |
| `PORT` | ⬜ | HTTP port for the Nest application (defaults to `3000`). |

> 🔒 Treat `DISCORD_TOKEN`, `DATABASE_URL`, and `YOUTUBE_API_KEY` as secrets — they are never logged.

---

## 🧰 Available Scripts

| Script | Description |
| --- | --- |
| `pnpm start:dev` | Run in watch mode (auto-restart on change). |
| `pnpm start:prod` | Run the compiled build from `dist/`. |
| `pnpm build` | Compile with `nest build` (`prebuild` runs `prisma generate`). |
| `pnpm format` | Format `src/` and `test/` with Prettier. |
| `pnpm lint` | Lint and auto-fix with ESLint. |
| `pnpm test` | Run the Jest unit-test suite. |
| `pnpm test:watch` | Run tests in watch mode. |
| `pnpm test:cov` | Run tests with a coverage report. |
| `pnpm prisma migrate dev --name <name>` | Create and apply a database migration. |
| `pnpm prisma generate` | Regenerate the Prisma client into `src/generated/prisma`. |

---

## 🧪 Testing

Unit tests are written with **Jest + ts-jest** and co-located next to the code as `*.spec.ts`.

```bash
pnpm test          # run all suites
pnpm test:cov      # run with coverage
```

Current status: **36 test suites / 323 tests** covering commands, services, utilities, components, and the Prisma service. Discord interactions, DisTube, and Prisma are mocked via helpers in `test/`. The suite also runs on every push and pull request through the **Test** CI workflow.

---

## 🛡️ Code Quality & CI

Quality is enforced automatically at multiple stages:

- **Pre-commit hooks** — Husky + lint-staged run Prettier/ESLint on staged files, so unformatted code never lands.
- **Commit message validation** — commitlint enforces [Conventional Commits](https://www.conventionalcommits.org/) with a custom type set.
- **Continuous Integration** — GitHub Actions runs on every push & PR:
  - `build.yml` — compiles the project.
  - `lint.yml` — runs ESLint.
  - `test.yml` — runs the Jest suite.
  - `commit-msg-validation.yml` — validates commit messages.
  - `pr-validation.yml` — validates pull requests.

---

## 🤝 Contributing

Contributions are welcome and appreciated!

1. Fork the project.
2. Create a feature branch: `git checkout -b feature/AmazingFeature`.
3. Commit using an allowed [Conventional Commit](https://www.conventionalcommits.org/) type:
   **`add`, `update`, `fix`, `docs`, `feat`, `refactor`, `delete`, `chore`, `test`, `ci`** (header ≤ 200 chars).
   Example: `git commit -m "feat: add lyrics caching"`.
4. Push the branch: `git push origin feature/AmazingFeature`.
5. Open a Pull Request against the **`dev`** branch.

---

## 📄 License

Distributed under the **MIT License**. See the `LICENSE` file for details.

<div align="center">

**🌩️ Built with NestJS, Necord & DisTube**

</div>
