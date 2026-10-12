# list-matched-workflows-action [![ts](https://github.com/int128/list-matched-workflows-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/list-matched-workflows-action/actions/workflows/ts.yaml)

This action lists the matched workflows for the current `pull_request` or `push` event.
It is useful to run a task based on the changed files.

## Getting Started

Here is an example workflow.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - id: list-matched-workflows
        uses: int128/list-matched-workflows-action@v1
        with:
          workflows: |
            .github/workflows/*.yaml
```

For a `pull_request` event, this action determines the matched workflows based on the following conditions:

- If the workflow has `on.pull_request.types`, it matches the event types of the pull request.
- If the workflow has `on.pull_request.branches` or `on.pull_request.branches-ignore`, it matches the base branch of the pull request.
- If the workflow has `on.pull_request.paths` or `on.pull_request.paths-ignore`, it matches the changed files of the pull request.

For a `push` event, it applies the corresponding branch, tag, and path filters:

- If the workflow has `on.push.branches` or `on.push.branches-ignore`, it matches the pushed branch.
- If the workflow has `on.push.tags` or `on.push.tags-ignore`, it matches the pushed tag.
- If the workflow has `on.push.paths` or `on.push.paths-ignore`, it matches the changed files. Path filters apply to branches; tag pushes match regardless of path filters, as in GitHub Actions.

For example, if the workflow is defined as follows:

```yaml
on:
  pull_request:
    branches:
      - main
    paths:
      - "**/*.ts"
```

It matches if all of the following conditions are met:

- The pull request is opened against the `main` branch.
- The pull request has changed files that match the glob pattern `**/*.ts`, such as `src/example.ts`.

For example, a workflow with the following trigger matches a push to `main` when at least one changed file is under `src/`:

```yaml
on:
  push:
    branches:
      - main
    paths:
      - "src/**"
```

## Specification

### Inputs

| Name                             | Default                              | Description                                                                              |
| -------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `workflows`                      | (required)                           | A glob pattern to match workflow files.                                                  |
| `evaluate-pull-request-base-ref` | `github.event.pull_request.base.ref` | If set, evaluate the branch name instead of the base branch of the current pull request. |
| `evaluate-push-ref`              | `evaluate-push-ref`                  | If set, evaluate the ref instead of the current pushed ref                               |
| `token`                          | `github.token`                       | GitHub token.                                                                            |

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
