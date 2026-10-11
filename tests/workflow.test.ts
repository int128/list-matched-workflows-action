import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import {
  createGlobMatcher,
  matchPullRequestBranch,
  matchPullRequestPaths,
  matchPullRequestType,
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
  push:
`),
    )
    expect(workflow).toEqual({ on: {} })
  })

  it('parses a workflow with empty pull_request', () => {
    const workflow = parseWorkflow(
      yaml.load(`
on:
  pull_request:
`),
    )
    expect(workflow).toEqual({ on: { pull_request: null } })
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
  it('does not match when pull_request is not configured', () => {
    expect(matchPullRequestType(parseWorkflow({ on: {} }), 'opened')).toBe(false)
    expect(matchPullRequestType(parseWorkflow({ on: { pull_request: null } }), 'opened')).toBe(false)
  })

  it('matches every type when no type filter is configured', () => {
    expect(matchPullRequestType(parseWorkflow({ on: { pull_request: {} } }), 'opened')).toBe(true)
  })

  it('matches only configured pull request types', () => {
    const workflow = parseWorkflow({ on: { pull_request: { types: ['opened', 'synchronize'] } } })

    expect(matchPullRequestType(workflow, 'opened')).toBe(true)
    expect(matchPullRequestType(workflow, 'synchronize')).toBe(true)
    expect(matchPullRequestType(workflow, 'closed')).toBe(false)
  })
})

describe('matchPullRequestBranch', () => {
  it('does not match when pull_request is not configured', () => {
    expect(matchPullRequestBranch(parseWorkflow({ on: {} }), 'main')).toBe(false)
  })

  it('matches every branch when no branch filter is configured', () => {
    expect(matchPullRequestBranch(parseWorkflow({ on: { pull_request: {} } }), 'feature/example')).toBe(true)
  })

  it('matches branches against the configured patterns', () => {
    const workflow = parseWorkflow({
      on: { pull_request: { branches: ['main', 'release/**'] } },
    })

    expect(matchPullRequestBranch(workflow, 'main')).toBe(true)
    expect(matchPullRequestBranch(workflow, 'release/1.0')).toBe(true)
    expect(matchPullRequestBranch(workflow, 'feature/example')).toBe(false)
  })

  it('excludes branches matching branches-ignore', () => {
    const workflow = parseWorkflow({
      on: { pull_request: { 'branches-ignore': ['release/**', 'dependabot/**'] } },
    })

    expect(matchPullRequestBranch(workflow, 'main')).toBe(true)
    expect(matchPullRequestBranch(workflow, 'release/1.0')).toBe(false)
    expect(matchPullRequestBranch(workflow, 'dependabot/npm')).toBe(false)
  })
})

describe('matchPullRequestPaths', () => {
  it('does not match when pull_request is not configured', () => {
    expect(matchPullRequestPaths(parseWorkflow({ on: {} }), ['src/index.ts'])).toBe(false)
  })

  it('matches every change when no path filter is configured', () => {
    expect(matchPullRequestPaths(parseWorkflow({ on: { pull_request: {} } }), ['docs/readme.md'])).toBe(true)
  })

  it('matches when at least one changed path matches paths', () => {
    const workflow = parseWorkflow({
      on: { pull_request: { paths: ['src/**', '*.yml'] } },
    })

    expect(matchPullRequestPaths(workflow, ['docs/readme.md', 'src/index.ts'])).toBe(true)
    expect(matchPullRequestPaths(workflow, ['docs/readme.md'])).toBe(false)
  })

  it('matches unless every changed path is ignored', () => {
    const workflow = parseWorkflow({
      on: { pull_request: { 'paths-ignore': ['docs/**', '*.md'] } },
    })

    expect(matchPullRequestPaths(workflow, ['docs/guide.md', 'README.md'])).toBe(false)
    expect(matchPullRequestPaths(workflow, ['docs/guide.md', 'src/index.ts'])).toBe(true)
  })
})
