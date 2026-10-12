import assert from 'node:assert'
import { minimatch } from 'minimatch'
import * as z from 'zod'

export const matchPullRequest = (workflow: Workflow, action: string, ref: string, changedFiles: string[]) =>
  matchPullRequestType(workflow, action) &&
  matchPullRequestBranch(workflow, ref) &&
  matchPullRequestPaths(workflow, changedFiles)

export const matchPullRequestType = (workflow: Workflow, type: string) => {
  if (workflow.on.pull_request === undefined) {
    return false
  } else if (workflow.on.pull_request === null || !workflow.on.pull_request.types) {
    // By default, a workflow runs on opened, synchronize, or reopened.
    // https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request
    return ['opened', 'synchronize', 'reopened'].includes(type)
  } else {
    return workflow.on.pull_request.types.includes(type)
  }
}

export const matchPullRequestBranch = (workflow: Workflow, branch: string) => {
  if (workflow.on.pull_request === undefined) {
    return false
  } else if (workflow.on.pull_request === null) {
    return true
  } else if (workflow.on.pull_request.branches) {
    return createGlobMatcher(workflow.on.pull_request.branches)(branch)
  } else if (workflow.on.pull_request['branches-ignore']) {
    return !createGlobMatcher(workflow.on.pull_request['branches-ignore'])(branch)
  } else {
    return true
  }
}

export const matchPullRequestPaths = (workflow: Workflow, paths: string[]) => {
  if (workflow.on.pull_request === undefined) {
    return false
  } else if (workflow.on.pull_request === null) {
    return true
  } else if (workflow.on.pull_request.paths) {
    const matcher = createGlobMatcher(workflow.on.pull_request.paths)
    return paths.some((path) => matcher(path))
  } else if (workflow.on.pull_request['paths-ignore']) {
    const matcher = createGlobMatcher(workflow.on.pull_request['paths-ignore'])
    return !paths.every((path) => matcher(path))
  } else {
    return true
  }
}

export const matchPush = (workflow: Workflow, ref: string, changedFiles: string[]) =>
  matchPushRef(workflow, ref) && matchPushPaths(workflow, ref, changedFiles)

export const matchPushRef = (workflow: Workflow, ref: string) => {
  if (workflow.on.push === undefined) {
    return false
  } else if (workflow.on.push === null) {
    return true
  } else if (ref.startsWith('refs/heads/')) {
    return matchPushBranch(workflow, ref.substring('refs/heads/'.length))
  } else if (ref.startsWith('refs/tags/')) {
    return matchPushTag(workflow, ref.substring('refs/tags/'.length))
  } else {
    throw new Error(`ref must be either branch or tag: ${ref}`)
  }
}

const matchPushBranch = (workflow: Workflow, branch: string) => {
  assert(workflow.on.push)
  if (workflow.on.push.branches) {
    return createGlobMatcher(workflow.on.push.branches)(branch)
  } else if (workflow.on.push['branches-ignore']) {
    return !createGlobMatcher(workflow.on.push['branches-ignore'])(branch)
  } else if (workflow.on.push.tags || workflow.on.push['tags-ignore']) {
    return false // When only tags or tags-ignore is set, no match.
  } else {
    return true
  }
}

const matchPushTag = (workflow: Workflow, tag: string) => {
  assert(workflow.on.push)
  if (workflow.on.push.tags) {
    return createGlobMatcher(workflow.on.push.tags)(tag)
  } else if (workflow.on.push['tags-ignore']) {
    return !createGlobMatcher(workflow.on.push['tags-ignore'])(tag)
  } else if (workflow.on.push.branches || workflow.on.push['branches-ignore']) {
    return false // When only branches or branches-ignore is set, no match.
  } else {
    return true
  }
}

export const matchPushPaths = (workflow: Workflow, ref: string, paths: string[]) => {
  if (workflow.on.push === undefined) {
    return false
  } else if (workflow.on.push === null) {
    return true
  } else if (ref.startsWith('refs/tags/')) {
    return true // paths only works for branches
  } else if (workflow.on.push.paths) {
    const matcher = createGlobMatcher(workflow.on.push.paths)
    return paths.some((path) => matcher(path))
  } else if (workflow.on.push['paths-ignore']) {
    const matcher = createGlobMatcher(workflow.on.push['paths-ignore'])
    return !paths.every((path) => matcher(path))
  } else {
    return true
  }
}

export const createGlobMatcher = (patterns: string[]) => {
  return (target: string): boolean => {
    if (patterns.length === 0) {
      return true
    }
    let matched = false
    for (const pattern of patterns) {
      if (pattern.startsWith('!')) {
        matched = matched && minimatch(target, pattern, { dot: true })
      } else {
        matched = matched || minimatch(target, pattern, { dot: true })
      }
    }
    return matched
  }
}

const Workflow = z.object({
  on: z.object({
    // https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#onpull_requestpull_request_targetbranchesbranches-ignore
    // cannot use both the branches and branches-ignore filters
    // cannot use both the paths and paths-ignore filters
    pull_request: z
      .object({
        types: z.array(z.string()).optional(),
        branches: z.array(z.string()).optional(),
        'branches-ignore': z.array(z.string()).optional(),
        paths: z.array(z.string()).optional(),
        'paths-ignore': z.array(z.string()).optional(),
      })
      .nullable()
      .optional(),
    // https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushbranchestagsbranches-ignoretags-ignore
    push: z
      .object({
        branches: z.array(z.string()).optional(),
        'branches-ignore': z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        'tags-ignore': z.array(z.string()).optional(),
        paths: z.array(z.string()).optional(),
        'paths-ignore': z.array(z.string()).optional(),
      })
      .nullable()
      .optional(),
  }),
})

export type Workflow = z.infer<typeof Workflow>

export const parseWorkflow = (x: unknown): Workflow => Workflow.parse(x)
