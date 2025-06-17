# list-matched-workflows-action [![ts](https://github.com/int128/list-matched-workflows-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/list-matched-workflows-action/actions/workflows/ts.yaml)

List matched workflows against the changed files of the pull request.

## Getting Started

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: int128/list-matched-workflows-action@v0
        with:
          workflows: |
            .github/workflows/*.yaml
```

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
