import { minimatch } from 'minimatch'
import * as z from 'zod'
import type { PullRequestPayload, PushPayload } from './github.js'

export const matchPullRequest = (workflow: Workflow, payload: PullRequestPayload, changedFiles: string[]) =>
  matchPullRequestType(workflow, payload.action) &&
  matchPullRequestBranch(workflow, payload.pull_request.base.ref) &&
  matchPullRequestPaths(workflow, changedFiles)

export const matchPullRequestType = (workflow: Workflow, type: string) => {
  if (!workflow.on.pull_request) {
    return false // No trigger defined
  }
  if (!workflow.on.pull_request.types) {
    return true // No specific types defined, match all types
  }
  return workflow.on.pull_request.types.includes(type)
}

export const matchPullRequestBranch = (workflow: Workflow, branch: string) => {
  if (!workflow.on.pull_request) {
    return false // No trigger defined
  }
  if (workflow.on.pull_request.branches) {
    return createGlobMatcher(workflow.on.pull_request.branches)(branch)
  }
  if (workflow.on.pull_request['branches-ignore']) {
    return !createGlobMatcher(workflow.on.pull_request['branches-ignore'])(branch)
  }
  return true // No specific branches defined, match all branches
}

export const matchPullRequestPaths = (workflow: Workflow, paths: string[]) => {
  if (!workflow.on.pull_request) {
    return false // No trigger defined
  }
  if (workflow.on.pull_request.paths) {
    const matcher = createGlobMatcher(workflow.on.pull_request.paths)
    return paths.some((path) => matcher(path))
  }
  if (workflow.on.pull_request['paths-ignore']) {
    const matcher = createGlobMatcher(workflow.on.pull_request['paths-ignore'])
    return !paths.every((path) => matcher(path))
  }
  return true // No specific paths defined, match all paths
}

export const matchPush = (workflow: Workflow, payload: PushPayload, changedFiles: string[]) =>
  matchPushRef(workflow, payload.ref) && matchPushPaths(workflow, changedFiles)

export const matchPushRef = (workflow: Workflow, ref: string) => {
  if (!workflow.on.push) {
    return false // No trigger defined
  }
  if (ref.startsWith('refs/heads/')) {
    const branch = ref.substring('refs/heads/'.length)
    if (workflow.on.push.branches) {
      return createGlobMatcher(workflow.on.push.branches)(branch)
    }
    if (workflow.on.push['branches-ignore']) {
      return !createGlobMatcher(workflow.on.push['branches-ignore'])(branch)
    }
    return true // No specific branches defined, match all branches
  } else if (ref.startsWith('refs/tags/')) {
    const tag = ref.substring('refs/tags/'.length)
    if (workflow.on.push.tags) {
      return createGlobMatcher(workflow.on.push.tags)(tag)
    }
    if (workflow.on.push['tags-ignore']) {
      return !createGlobMatcher(workflow.on.push['tags-ignore'])(tag)
    }
    return true // No specific branches defined, match all branches
  } else {
    throw new Error(`ref must be either branch or tag: ${ref}`)
  }
}

export const matchPushPaths = (workflow: Workflow, paths: string[]) => {
  if (!workflow.on.push) {
    return false // No trigger defined
  }
  if (workflow.on.push.paths) {
    const matcher = createGlobMatcher(workflow.on.push.paths)
    return paths.some((path) => matcher(path))
  }
  if (workflow.on.push['paths-ignore']) {
    const matcher = createGlobMatcher(workflow.on.push['paths-ignore'])
    return !paths.every((path) => matcher(path))
  }
  return true // No specific paths defined, match all paths
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
