# Thunder Jr Necord Bot

[![CI](https://github.com/yourusername/thunder-jr-necord/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/thunder-jr-necord/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=thunder-jr-necord&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=thunder-jr-necord)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=thunder-jr-necord&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=thunder-jr-necord)
[![Discord](https://img.shields.io/badge/Discord-7289DA?style=flat&logo=discord&logoColor=white)](https://discord.js.org/)
[![Bun](https://img.shields.io/badge/Bun-1.2.11-black?logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.3.6-red?logo=nestjs)](https://nestjs.com/)
[![Necord](https://img.shields.io/badge/Necord-6.6.6-5865F2?logo=discord)](https://necord.org/)

Discord bot built with NestJS, Necord, and Bun.

## Git Workflow

This project uses a simplified Git flow for single developer:

### Main Branches

- **main**: The main branch containing stable code ready for deployment
- **dev**: Development branch where completed features are integrated

### Workflow

1. **Developing New Features**

   ```bash
   # Create a feature branch from dev
   git checkout dev
   git pull origin dev
   git checkout -b feature/feature-name

   # After completion, commit and push
   git add .
   git commit -m "feat: feature description"
   git push origin feature/feature-name
   ```

2. **Merging Features to Dev**

   - Create a Pull Request from `feature/feature-name` to `dev`
   - GitHub Actions will check and validate the code
   - After successful checks, merge into the `dev` branch

3. **Releasing New Versions**

   - Create a Pull Request from `dev` to `main`
   - GitHub Actions will check and validate the code
   - After successful merge to `main`, create a new version tag:

   ```bash
   git checkout main
   git pull origin main
   git tag -a v1.0.0 -m "Version 1.0.0"
   git push origin v1.0.0
   ```

### Commit Conventions

Commit messages must follow the format:

```text
<type>: <description>
```

Where `type` can be:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Changes that do not affect code (formatting, etc)
- `refactor`: Code refactoring
- `test`: Adding or fixing tests
- `chore`: Changes to build process, tools, etc
- `add`: Adding new files, resources
- `update`: Updating resources, dependencies, etc
- `remove`: Removing files, resources, etc
