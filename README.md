# 🌩️ Thunder - A Necord Discord Bot

A powerful Discord Bot built on the [Necord](https://necord.org/) framework, leveraging the modular architecture of [NestJS](https://nestjs.com/) to deliver performance, scalability, and stability.

[![Build source code](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/build.yml/badge.svg)](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/build.yml)
[![Lint source code](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/lint.yml/badge.svg)](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/lint.yml)
[![Commit Message Validation](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/commit-msg-validation.yml/badge.svg)](https://github.com/htnghia1423/thunder-jr-necord/actions/workflows/commit-msg-validation.yml)

## ⭐ About The Project

This project serves as a robust boilerplate for Discord Bot development, focusing on high code quality and an automated workflow. The combination of TypeScript, NestJS, and Necord makes adding new features, managing commands, and handling events incredibly simple and organized.

### ✨ Built With

* [**NestJS**](https://nestjs.com/): A progressive Node.js framework for building efficient, reliable, and scalable server-side applications.
* [**Necord**](https://necord.org/): A module that seamlessly integrates Discord.js into the NestJS modular architecture.
* [**TypeScript**](https://www.typescriptlang.org/): Provides static typing for safer code and an enhanced developer experience.
* [**PNPM**](https://pnpm.io/): A fast, disk space-efficient package manager.
* [**ESLint**](https://eslint.org/) & [**Prettier**](https://prettier.io/): Enforce consistent code style and catch errors early.
* [**Husky**](https://typicode.github.io/husky/) & [**Commitlint**](https://commitlint.js.org/): Automate code quality checks and enforce conventional commit messages.
* [**GitHub Actions**](https://github.com/features/actions): Automate the CI/CD pipeline to build, lint, and validate code on every change.

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

* [Node.js](https://nodejs.org/en/) (v20.x or higher recommended)
* [pnpm](https://pnpm.io/installation)

### Installation

1.  Clone the repository to your local machine:
    ```bash
    git clone [https://github.com/htnghia1423/thunder-jr-necord.git](https://github.com/htnghia1423/thunder-jr-necord.git)
    ```
2.  Navigate into the project directory:
    ```bash
    cd thunder-jr-necord
    ```
3.  Install the required dependencies:
    ```bash
    pnpm install
    ```

### Configuration

1.  Create a `.env` file in the root of the project. You can copy the example if one is provided or create it from scratch.
2.  Add the necessary environment variables to the `.env` file. At a minimum, you will need your Discord Bot Token.

    ```env
    # .env
    # Discord Bot Configuration
    DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN_HERE

    # Application Port (optional, defaults to 3000)
    PORT=3000
    ```
    > You can obtain your `DISCORD_TOKEN` from the [Discord Developer Portal](https://discord.com/developers/applications).

### Running the App

* **Development Mode:**
    ```bash
    pnpm start:dev
    ```
    The bot will automatically restart whenever you make changes to the source code.

* **Production Mode:**
    First, build the project:
    ```bash
    pnpm build
    ```
    Then, run the compiled code:
    ```bash
    pnpm start:prod
    ```

## 🧰 Available Scripts

This project comes with several pre-configured scripts to streamline your workflow:

* `pnpm format`: Automatically formats all code in the `src` directory using Prettier.
* `pnpm lint`: Lints the codebase and automatically fixes issues with ESLint.
* `pnpm test`: Runs unit tests using Jest.

## 🛠️ Code Quality & Automation

This project places a strong emphasis on maintaining high code quality through automated tools:

* **Pre-commit Hooks**: Using **Husky** and **lint-staged**, every `git commit` triggers automatic linting and formatting on the staged files. This ensures that no unformatted or erroneous code is committed to the repository.
* **Commit Message Validation**: With **commitlint**, every commit message is checked to ensure it follows the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/). This creates a clean and understandable commit history.
* **Continuous Integration (CI)**: Using **GitHub Actions**, every push and pull request automatically triggers build and lint workflows. This guarantees that all changes pass quality checks before being merged.

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

To contribute, please follow this process:

1.  Fork the Project.
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`).
4.  Push to the Branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request against the `dev` branch of the original repository.

## 📄 License

This project is distributed under the MIT License. See the `LICENSE` file for more information.
