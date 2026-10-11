import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as yaml from 'js-yaml'
import * as git from './git.js'
import type { Context } from './github.js'
import {
  matchPullRequestBranch,
  matchPullRequestPaths,
  matchPullRequestType,
  parseWorkflow,
  type Workflow,
} from './workflow.js'

type Inputs = {
  workflows: string
}

type Outputs = {
  matchedWorkflows: WorkflowFile[]
}

type WorkflowFile = {
  filename: string
  workflow: Workflow
}

export const run = async (inputs: Inputs, context: Context): Promise<Outputs> => {
  const workflowFiles = await parseWorkflowFiles(inputs.workflows)
  core.startGroup(`Filtering ${workflowFiles.length} workflows based on the event`)

  if ('pull_request' in context.payload) {
    const matchedWorkflows = await matchPullRequest(workflowFiles, context)
    return { matchedWorkflows }
  }
  throw new Error(`This action must be run on pull_request event`)
}

const matchPullRequest = async (workflowFiles: WorkflowFile[], context: Context) => {
  assert('pull_request' in context.payload)
  core.info(`pull_request.type: ${context.payload.action}`)
  core.info(`pull_request.branch: ${context.payload.pull_request.base.ref}`)

  core.info(`Fetching the changed files of the current pull request`)
  const changedFiles = await git.compareMergeCommit(context)
  core.info(`Found ${changedFiles.length} changed files`)

  const matchedWorkflows = []
  for (const workflowFile of workflowFiles) {
    if (!matchPullRequestType(workflowFile.workflow, context.payload.action)) {
      core.info(`${workflowFile.filename}: type did not match`)
      continue
    }
    if (!matchPullRequestBranch(workflowFile.workflow, context.payload.pull_request.base.ref)) {
      core.info(`${workflowFile.filename}: branch did not match`)
      continue
    }
    if (!matchPullRequestPaths(workflowFile.workflow, changedFiles)) {
      core.info(`${workflowFile.filename}: changed files did not match`)
      continue
    }
    core.info(`${workflowFile.filename}: matched`)
    matchedWorkflows.push(workflowFile)
  }
  core.endGroup()

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
    const workflow = parseWorkflow(workflowYaml)
    workflowFiles.push({
      filename: path.basename(workflowFilename),
      workflow,
    })
  }
  core.endGroup()
  return workflowFiles
}
