import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as yaml from 'js-yaml'
import * as git from './git.js'
import type { Context } from './github.js'
import * as workflow from './workflow.js'

type Inputs = {
  workflows: string
}

type Outputs = {
  matchedWorkflows: WorkflowFile[]
}

type WorkflowFile = {
  filename: string
  workflow: workflow.Workflow
}

export const run = async (inputs: Inputs, context: Context): Promise<Outputs> => {
  const workflowFiles = await parseWorkflowFiles(inputs.workflows)
  core.startGroup(`Filtering ${workflowFiles.length} workflows based on the event`)

  if ('pull_request' in context.payload) {
    const matchedWorkflows = await matchPullRequest(workflowFiles, context)
    return { matchedWorkflows }
  }
  if ('before' in context.payload && 'after' in context.payload) {
    const matchedWorkflows = await matchPush(workflowFiles, context)
    return { matchedWorkflows }
  }
  throw new Error(`This action must be run on pull_request or push event`)
}

const matchPullRequest = async (workflowFiles: WorkflowFile[], context: Context) => {
  const { payload } = context
  assert('pull_request' in payload)
  core.info(`pull_request.type: ${payload.action}`)
  core.info(`pull_request.branch: ${payload.pull_request.base.ref}`)

  core.startGroup(`Comparing the base branch and merge commit of the pull request`)
  const changedFiles = await git.compareMergeCommit(context)
  core.info(`Found ${changedFiles.length} changed files`)

  const matchedWorkflows = workflowFiles.filter((workflowFile) =>
    workflow.matchPullRequest(workflowFile.workflow, payload, changedFiles),
  )
  core.info(`Matched ${matchedWorkflows.length} workflows`)
  for (const workflowFile of matchedWorkflows) {
    core.info(`- ${workflowFile.filename}`)
  }
  return matchedWorkflows
}

const matchPush = async (workflowFiles: WorkflowFile[], context: Context) => {
  const { payload } = context
  assert('before' in payload && 'after' in payload && 'ref' in payload)

  core.startGroup(`Comparing the before and after commits of the push event`)
  const changedFiles = await git.compareTwoCommits(payload.before, payload.after, context)
  core.info(`Found ${changedFiles.length} changed files`)

  const matchedWorkflows = workflowFiles.filter((workflowFile) =>
    workflow.matchPush(workflowFile.workflow, payload, changedFiles),
  )
  core.info(`Matched ${matchedWorkflows.length} workflows`)
  for (const workflowFile of matchedWorkflows) {
    core.info(`- ${workflowFile.filename}`)
  }
  return matchedWorkflows
}

const parseWorkflowFiles = async (pattern: string) => {
  const workflowFiles: WorkflowFile[] = []
  const workflowGlob = await glob.create(pattern)
  for await (const workflowFilename of workflowGlob.globGenerator()) {
    core.info(`Parsing ${workflowFilename}`)
    const workflowYaml = yaml.load(await fs.readFile(workflowFilename, 'utf8'))
    workflowFiles.push({
      filename: path.basename(workflowFilename),
      workflow: workflow.parseWorkflow(workflowYaml),
    })
  }
  core.endGroup()
  return workflowFiles
}
