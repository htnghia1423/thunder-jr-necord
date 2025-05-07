export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "docs",
        "feat",
        "fix",
        "perf",
        "refactor",
        "revert",
        "style",
        "test",
        "add",
        "update",
        "remove",
      ],
    ],
    "type-case": [2, "always", "lower-case"],
    "subject-case": [0],
    "header-max-length": [2, "always", 100],
  },
};
