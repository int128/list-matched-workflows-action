# list-matched-workflows-action [![ts](https://github.com/int128/list-matched-workflows-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/list-matched-workflows-action/actions/workflows/ts.yaml)

This action lists the matched workflows against the changed files of the current pull request.
It is useful to run a task based on the changed files.

## Getting Started

Here is an example workflow.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - id: list-matched-workflows
        uses: int128/list-matched-workflows-action@v0
        with:
          workflows: |
            .github/workflows/*.yaml
```

This action determines the matched workflows based on the following conditions:

- If the workflow has `on.pull_request.types`, it matches the event types of the pull request.
- If the workflow has `on.pull_request.branches` or `on.pull_request.branches-ignore`, it matches the base branch of the pull request.
- If the workflow has `on.pull_request.paths` or `on.pull_request.paths-ignore`, it matches the changed files of the pull request.

For example, if the workflow is defined as follows:

```yaml
on:
  pull_request:
    branches:
      - main
    paths:
      - '**/*.ts'
```

It matches if all of the following conditions are met:

- The pull request is opened against the `main` branch.
- The pull request has changed files that match the glob pattern `**/*.ts`, such as `src/example.ts`.

## Specification

### Inputs

| Name        | Default        | Description                             |
| ----------- | -------------- | --------------------------------------- |
| `workflows` | (required)     | A glob pattern to match workflow files. |
| `token`     | `github.token` | GitHub token.                           |

### Outputs

| Name                     | Description                      |
| ------------------------ | -------------------------------- |
| `matched-workflows-json` | JSON string of matched workflows |

Here is an example of the output `matched-workflows-json`.

```json
[
  {
    "filename": "test.yaml",
    "workflow": {
      "name": "Test Workflow",
      "on": {
        "pull_request": {
          "paths": ["**/*.ts"]
        }
      },
      "jobs": {
        "test": {
          "runs-on": "ubuntu-latest",
          "steps": [
            {
              "run": "npm test"
            }
          ]
        }
      }
    }
  }
]
```
