import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import {
  createGlobMatcher,
  matchPullRequestBranch,
  matchPullRequestPaths,
  matchPullRequestType,
  matchPushPaths,
  matchPushRef,
  parseWorkflow,
} from '../src/workflow.js'

describe('createGlobMatcher', () => {
  it('matches anything when no pattern is given', () => {
    const matcher = createGlobMatcher([])
    expect(matcher('github.foo.bar')).toBe(true)
    expect(matcher('github.foo.baz')).toBe(true)
  })
  it('matches it when a pattern is given', () => {
    const matcher = createGlobMatcher(['*.bar'])
    expect(matcher('.github.foo.bar')).toBe(true)
    expect(matcher('github.foo.bar')).toBe(true)
    expect(matcher('github.foo.baz')).toBe(false)
  })
  it('excludes it when a negative pattern is given', () => {
    const matcher = createGlobMatcher(['*', '!*.github.*'])
    expect(matcher('foo.github.bar')).toBe(false)
    expect(matcher('foo.github.baz')).toBe(false)
    expect(matcher('.foo.github.baz')).toBe(false)
    expect(matcher('example.bar')).toBe(true)
    expect(matcher('example.baz')).toBe(true)
    expect(matcher('.example.baz')).toBe(true)
  })
  it('takes higher precedence to the later pattern', () => {
    // https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow#example-including-and-excluding-branches
    const matcher = createGlobMatcher(['*.bar', '!foo.*', '*.baz'])
    expect(matcher('foo.github.bar')).toBe(false)
    expect(matcher('foo.github.baz')).toBe(true)
    expect(matcher('.foo.github.baz')).toBe(true)
    expect(matcher('example.bar')).toBe(true)
    expect(matcher('example.baz')).toBe(true)
    expect(matcher('.example.baz')).toBe(true)
  })
})

describe('parseWorkflow', () => {
  it('parses a workflow without pull_request', () => {
    const workflow = parseWorkflow(
      yaml.load(`
on:
  workflow_call:
`),
    )
    expect(workflow).toEqual({ on: {} })
  })

  it('parses a workflow with null pull_request', () => {
    const workflow = parseWorkflow(
      yaml.load(`
on:
  pull_request:
`),
    )
    expect(workflow).toEqual({ on: { pull_request: null } })
  })

  it('parses a workflow with empty pull_request', () => {
    const workflow = parseWorkflow(
      yaml.load(`
on:
  pull_request: {}
`),
    )
    expect(workflow).toEqual({ on: { pull_request: {} } })
  })

  it('parses a workflow with minimal pull_request', () => {
    const workflow = parseWorkflow(
      yaml.load(`
on:
  pull_request:
    branches:
      - main
`),
    )
    expect(workflow).toEqual({
      on: {
        pull_request: {
          branches: ['main'],
        },
      },
    })
  })

  it('parses a workflow with full pull_request', () => {
    const workflow = parseWorkflow(
      yaml.load(`
on:
  pull_request:
    types:
      - opened
      - synchronize
    branches:
      - main
      - "!release/*"
    paths:
      - src/**
      - "!docs/**"
`),
    )
    expect(workflow).toEqual({
      on: {
        pull_request: {
          types: ['opened', 'synchronize'],
          branches: ['main', '!release/*'],
          paths: ['src/**', '!docs/**'],
        },
      },
    })
  })
})

describe('matchPullRequestType', () => {
  it('does not match when pull_request is not set', () => {
    expect(matchPullRequestType(parseWorkflow({ on: {} }), 'opened')).toBe(false)
  })

  it('matches the default pull request types when pull_request is null', () => {
    const workflow = parseWorkflow({ on: { pull_request: null } })

    expect(matchPullRequestType(workflow, 'opened')).toBe(true)
    expect(matchPullRequestType(workflow, 'synchronize')).toBe(true)
    expect(matchPullRequestType(workflow, 'reopened')).toBe(true)
    expect(matchPullRequestType(workflow, 'closed')).toBe(false)
    expect(matchPullRequestType(workflow, 'labeled')).toBe(false)
  })

  it('matches the default pull request types when no type filter is configured', () => {
    const workflow = parseWorkflow({ on: { pull_request: {} } })

    expect(matchPullRequestType(workflow, 'opened')).toBe(true)
    expect(matchPullRequestType(workflow, 'synchronize')).toBe(true)
    expect(matchPullRequestType(workflow, 'reopened')).toBe(true)
    expect(matchPullRequestType(workflow, 'closed')).toBe(false)
    expect(matchPullRequestType(workflow, 'labeled')).toBe(false)
  })

  it('matches only configured pull request types', () => {
    const workflow = parseWorkflow({
      on: {
        pull_request: {
          types: ['opened', 'synchronize'],
        },
      },
    })

    expect(matchPullRequestType(workflow, 'opened')).toBe(true)
    expect(matchPullRequestType(workflow, 'synchronize')).toBe(true)
    expect(matchPullRequestType(workflow, 'closed')).toBe(false)
  })
})

describe('matchPullRequestBranch', () => {
  it('does not match when pull_request is not set', () => {
    expect(matchPullRequestBranch(parseWorkflow({ on: {} }), 'main')).toBe(false)
  })

  it('matches every branch when pull_request is null', () => {
    expect(matchPullRequestBranch(parseWorkflow({ on: { pull_request: null } }), 'main')).toBe(true)
  })

  it('matches every branch when no branch filter is configured', () => {
    expect(matchPullRequestBranch(parseWorkflow({ on: { pull_request: {} } }), 'feature/example')).toBe(true)
  })

  it('matches branches against the configured patterns', () => {
    const workflow = parseWorkflow({
      on: {
        pull_request: {
          branches: ['main', 'release/**'],
        },
      },
    })

    expect(matchPullRequestBranch(workflow, 'main')).toBe(true)
    expect(matchPullRequestBranch(workflow, 'release/1.0')).toBe(true)
    expect(matchPullRequestBranch(workflow, 'feature/example')).toBe(false)
  })

  it('excludes branches matching branches-ignore', () => {
    const workflow = parseWorkflow({
      on: {
        pull_request: {
          'branches-ignore': ['release/**', 'dependabot/**'],
        },
      },
    })

    expect(matchPullRequestBranch(workflow, 'main')).toBe(true)
    expect(matchPullRequestBranch(workflow, 'release/1.0')).toBe(false)
    expect(matchPullRequestBranch(workflow, 'dependabot/npm')).toBe(false)
  })
})

describe('matchPullRequestPaths', () => {
  it('does not match when pull_request is not set', () => {
    expect(matchPullRequestPaths(parseWorkflow({ on: {} }), ['src/index.ts'])).toBe(false)
  })

  it('matches every change when pull_request is null', () => {
    expect(matchPullRequestPaths(parseWorkflow({ on: { pull_request: null } }), ['src/index.ts'])).toBe(true)
  })

  it('matches every change when no path filter is configured', () => {
    expect(matchPullRequestPaths(parseWorkflow({ on: { pull_request: {} } }), ['docs/readme.md'])).toBe(true)
  })

  it('matches when at least one changed path matches paths', () => {
    const workflow = parseWorkflow({
      on: {
        pull_request: {
          paths: ['src/**', '*.yml'],
        },
      },
    })

    expect(matchPullRequestPaths(workflow, ['docs/readme.md', 'src/index.ts'])).toBe(true)
    expect(matchPullRequestPaths(workflow, ['docs/readme.md'])).toBe(false)
  })

  it('matches unless every changed path is ignored', () => {
    const workflow = parseWorkflow({
      on: {
        pull_request: {
          'paths-ignore': ['docs/**', '*.md'],
        },
      },
    })

    expect(matchPullRequestPaths(workflow, ['docs/guide.md', 'README.md'])).toBe(false)
    expect(matchPullRequestPaths(workflow, ['docs/guide.md', 'src/index.ts'])).toBe(true)
  })
})

describe('matchPushRef', () => {
  it('does not match when push is not set', () => {
    expect(matchPushRef(parseWorkflow({ on: {} }), 'refs/heads/main')).toBe(false)
    expect(matchPushRef(parseWorkflow({ on: {} }), 'refs/tags/v1.0.0')).toBe(false)
  })

  it('matches every branch or tag when push is null', () => {
    expect(matchPushRef(parseWorkflow({ on: { push: null } }), 'refs/heads/main')).toBe(true)
    expect(matchPushRef(parseWorkflow({ on: { push: null } }), 'refs/tags/v1.0.0')).toBe(true)
  })

  it('matches every branch or tag when no ref filter is set', () => {
    expect(matchPushRef(parseWorkflow({ on: { push: {} } }), 'refs/heads/main')).toBe(true)
    expect(matchPushRef(parseWorkflow({ on: { push: {} } }), 'refs/tags/v1.0.0')).toBe(true)
  })

  it('matches branches against branches', () => {
    const workflow = parseWorkflow({
      on: {
        push: {
          branches: ['main', 'release/**'],
        },
      },
    })

    expect(matchPushRef(workflow, 'refs/heads/main')).toBe(true)
    expect(matchPushRef(workflow, 'refs/heads/release/1.0')).toBe(true)
    expect(matchPushRef(workflow, 'refs/heads/feature/example')).toBe(false)
    expect(matchPushRef(workflow, 'refs/tags/v1.0.0')).toBe(false)
  })

  it('matches branches against branches-ignore', () => {
    const workflow = parseWorkflow({
      on: {
        push: {
          'branches-ignore': ['release/**', 'dependabot/**'],
        },
      },
    })

    expect(matchPushRef(workflow, 'refs/heads/main')).toBe(true)
    expect(matchPushRef(workflow, 'refs/heads/release/1.0')).toBe(false)
    expect(matchPushRef(workflow, 'refs/heads/dependabot/npm')).toBe(false)
    expect(matchPushRef(workflow, 'refs/tags/v1.0.0')).toBe(false)
  })

  it('matches tags against tags', () => {
    const workflow = parseWorkflow({
      on: {
        push: {
          tags: ['v*', 'release/**'],
        },
      },
    })

    expect(matchPushRef(workflow, 'refs/tags/v1.0.0')).toBe(true)
    expect(matchPushRef(workflow, 'refs/tags/release/1.0')).toBe(true)
    expect(matchPushRef(workflow, 'refs/tags/beta')).toBe(false)
    expect(matchPushRef(workflow, 'refs/heads/main')).toBe(false)
  })

  it('matches tags against tags-ignore', () => {
    const workflow = parseWorkflow({
      on: {
        push: {
          'tags-ignore': ['beta*'],
        },
      },
    })

    expect(matchPushRef(workflow, 'refs/tags/v1.0.0')).toBe(true)
    expect(matchPushRef(workflow, 'refs/tags/beta.1')).toBe(false)
    expect(matchPushRef(workflow, 'refs/heads/main')).toBe(false)
  })

  it('matches branches and tags when both filters are configured', () => {
    const workflow = parseWorkflow({
      on: {
        push: {
          branches: ['main'],
          tags: ['v*'],
        },
      },
    })

    expect(matchPushRef(workflow, 'refs/heads/main')).toBe(true)
    expect(matchPushRef(workflow, 'refs/heads/dependabot/npm')).toBe(false)
    expect(matchPushRef(workflow, 'refs/tags/v1.0.0')).toBe(true)
    expect(matchPushRef(workflow, 'refs/tags/beta')).toBe(false)
  })

  it('throws for refs that are neither branches nor tags', () => {
    const workflow = parseWorkflow({ on: { push: {} } })
    expect(() => matchPushRef(workflow, 'refs/pull/1/merge')).toThrow(
      'ref must be either branch or tag: refs/pull/1/merge',
    )
  })
})

describe('matchPushPaths', () => {
  it('does not match when push is not configured', () => {
    expect(matchPushPaths(parseWorkflow({ on: {} }), ['src/index.ts'])).toBe(false)
  })

  it('matches every change when no path filter is configured', () => {
    expect(matchPushPaths(parseWorkflow({ on: { push: {} } }), ['docs/readme.md'])).toBe(true)
  })

  it('matches when at least one changed path matches paths', () => {
    const workflow = parseWorkflow({
      on: { push: { paths: ['src/**', '*.yml'] } },
    })

    expect(matchPushPaths(workflow, ['docs/readme.md', 'src/index.ts'])).toBe(true)
    expect(matchPushPaths(workflow, ['docs/readme.md'])).toBe(false)
  })

  it('matches unless every changed path is ignored', () => {
    const workflow = parseWorkflow({
      on: { push: { 'paths-ignore': ['docs/**', '*.md'] } },
    })

    expect(matchPushPaths(workflow, ['docs/guide.md', 'README.md'])).toBe(false)
    expect(matchPushPaths(workflow, ['docs/guide.md', 'src/index.ts'])).toBe(true)
  })
})
