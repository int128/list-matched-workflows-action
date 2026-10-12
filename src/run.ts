import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as yaml from 'js-yaml'
import * as git from './git.js'
import type { Context } from './github.js'
import { matchPullRequest, matchPush, parseWorkflow, type Workflow } from './workflow.js'
import assert from 'node:assert'

type Inputs = {
  workflows: string
} & EvaluateContext

type EvaluateContext = {
  evaluatePullRequestBaseRef: string
  evaluatePushRef: string
}

type Outputs = {
  matchedWorkflows: WorkflowFile[]
}

type WorkflowFile = {
  filename: string
  workflow: Workflow
}

export const run = async (inputs: Inputs, context: Context): Promise<Outputs> => {
  core.startGroup('Parsing GitHub Actions workflows')
  const workflowFiles = await Array.fromAsync(parseWorkflows(inputs.workflows))
  core.endGroup()
  const matchedWorkflows = await matchWorkflows(workflowFiles, inputs, context)
  core.info(`Matched ${matchedWorkflows.length} workflows`)
  for (const workflowFile of matchedWorkflows) {
    core.info(`- ${workflowFile.filename}`)
  }
  return { matchedWorkflows }
}

const matchWorkflows = async (workflowFiles: WorkflowFile[], evaluateContext: EvaluateContext, context: Context) => {
  const { payload } = context

  if ('pull_request' in payload) {
    assert(evaluateContext.evaluatePullRequestBaseRef, 'evaluate-pull-request-base-ref is required')
    core.startGroup(`Comparing the base branch and merge commit of the pull request`)
    const changedFiles = await git.compareMergeCommit(context)
    core.endGroup()
    core.info(`Found ${changedFiles.length} changed files`)
    return workflowFiles.filter((f) =>
      matchPullRequest(f.workflow, payload.action, evaluateContext.evaluatePullRequestBaseRef, changedFiles),
    )
  }

  if ('before' in payload && 'after' in payload && 'ref' in payload) {
    assert(evaluateContext.evaluatePushRef, 'evaluate-push-ref is required')
    core.startGroup(`Comparing the before and after commits of the push event`)
    const changedFiles = await git.comparePushedCommits(context, payload)
    core.endGroup()
    core.info(`Found ${changedFiles.length} changed files`)
    return workflowFiles.filter((f) => matchPush(f.workflow, evaluateContext.evaluatePushRef, changedFiles))
  }

  throw new Error(`This action must be run on pull_request or push event`)
}

const parseWorkflows = async function* (pattern: string) {
  const patternGlob = await glob.create(pattern)
  for await (const workflowFilename of patternGlob.globGenerator()) {
    core.info(`Parsing ${workflowFilename}`)
    const workflowYaml = yaml.load(await fs.readFile(workflowFilename, 'utf8'))
    yield {
      filename: path.basename(workflowFilename),
      workflow: parseWorkflow(workflowYaml),
    }
  }
}
