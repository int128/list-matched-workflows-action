import assert from 'assert'
import { minimatch } from 'minimatch'

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
        matched = matched && minimatch(target, pattern)
      } else {
        matched = matched || minimatch(target, pattern)
      }
    }
    return matched
  }
}

export type Workflow = {
  on: {
    // https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#onpull_requestpull_request_targetbranchesbranches-ignore
    // cannot use both the branches and branches-ignore filters
    // cannot use both the paths and paths-ignore filters
    pull_request?: {
      types?: string[]
      branches?: string[]
      'branches-ignore'?: string[]
      paths?: string[]
      'paths-ignore'?: string[]
    }
  }
}

export function assertIsWorkflow(x: unknown): asserts x is Workflow {
  assert(typeof x === 'object', `Workflow must be an object but got ${typeof x}`)
  assert(x !== null, 'Workflow must not be null')

  assert('on' in x, 'Workflow must have an "on" property')
  assert(typeof x.on === 'object', `Workflow "on" property must be an object but got ${typeof x.on}`)
  assert(x.on !== null, 'Workflow "on" property must not be null')

  if ('pull_request' in x.on) {
    assert(
      typeof x.on.pull_request === 'object',
      `Workflow "on.pull_request" property must be an object but got ${typeof x.on.pull_request}`,
    )
    assert(x.on.pull_request !== null, 'Workflow "on.pull_request" property must not be null')

    if ('types' in x.on.pull_request) {
      assert(
        Array.isArray(x.on.pull_request.types),
        `Workflow "on.pull_request.types" must be an array but got ${typeof x.on.pull_request.types}`,
      )
      assert(
        x.on.pull_request.types.every((type) => typeof type === 'string'),
        `Workflow "on.pull_request.types" must be an array of strings but got ${JSON.stringify(x.on.pull_request.types)}`,
      )
    }

    if ('branches' in x.on.pull_request) {
      assert(
        Array.isArray(x.on.pull_request.branches),
        `Workflow "on.pull_request.branches" must be an array but got ${typeof x.on.pull_request.branches}`,
      )
      assert(
        x.on.pull_request.branches.every((branch) => typeof branch === 'string'),
        `Workflow "on.pull_request.branches" must be an array of strings but got ${JSON.stringify(x.on.pull_request.branches)}`,
      )
    }
    if ('branches-ignore' in x.on.pull_request) {
      assert(
        Array.isArray(x.on.pull_request['branches-ignore']),
        `Workflow "on.pull_request.branches-ignore" must be an array but got ${typeof x.on.pull_request['branches-ignore']}`,
      )
      assert(
        x.on.pull_request['branches-ignore'].every((branch) => typeof branch === 'string'),
        `Workflow "on.pull_request.branches-ignore" must be an array of strings but got ${JSON.stringify(x.on.pull_request['branches-ignore'])}`,
      )
    }

    if ('paths' in x.on.pull_request) {
      assert(
        Array.isArray(x.on.pull_request.paths),
        `Workflow "on.pull_request.paths" must be an array but got ${typeof x.on.pull_request.paths}`,
      )
      assert(
        x.on.pull_request.paths.every((path) => typeof path === 'string'),
        `Workflow "on.pull_request.paths" must be an array of strings but got ${JSON.stringify(x.on.pull_request.paths)}`,
      )
    }
    if ('paths-ignore' in x.on.pull_request) {
      assert(
        Array.isArray(x.on.pull_request['paths-ignore']),
        `Workflow "on.pull_request.paths-ignore" must be an array but got ${typeof x.on.pull_request['paths-ignore']}`,
      )
      assert(
        x.on.pull_request['paths-ignore'].every((path) => typeof path === 'string'),
        `Workflow "on.pull_request.paths-ignore" must be an array of strings but got ${JSON.stringify(x.on.pull_request['paths-ignore'])}`,
      )
    }
  }
}
