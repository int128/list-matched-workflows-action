import { minimatch } from 'minimatch'
import * as z from 'zod'

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
      .optional(),
  }),
})

export type Workflow = z.infer<typeof Workflow>

export const parseWorkflow = (x: unknown): Workflow => Workflow.parse(x)
