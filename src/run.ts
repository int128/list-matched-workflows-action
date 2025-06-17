import assert from 'assert'
import * as core from '@actions/core'
import * as fs from 'fs/promises'
import * as glob from '@actions/glob'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { Octokit } from '@octokit/action'
import { Context } from './github.js'
import {
  assertIsWorkflow,
  matchPullRequestBranch,
  matchPullRequestPaths,
  matchPullRequestType,
  Workflow,
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

export const run = async (inputs: Inputs, octokit: Octokit, context: Context): Promise<Outputs> => {
  assert('pull_request' in context.payload, 'This action must be run on a pull_request event')
  core.info(`pull_request.type: ${context.payload.action}`)
  core.info(`pull_request.branch: ${context.payload.pull_request.base.ref}`)

  const workflowFiles: WorkflowFile[] = []
  const workflowGlob = await glob.create(inputs.workflows)
  const workflowFilenames = await workflowGlob.glob()
  core.startGroup(`Parsing ${workflowFilenames.length} workflows`)
  for (const workflowFilename of workflowFilenames) {
    core.info(`Parsing ${workflowFilename}`)
    const workflow: unknown = yaml.load(await fs.readFile(workflowFilename, 'utf8'))
    assertIsWorkflow(workflow)
    workflowFiles.push({
      filename: path.basename(workflowFilename),
      workflow,
    })
  }
  core.endGroup()

  core.info(`Fetching the list of changed files in ${context.payload.pull_request.html_url}`)
  const listFiles = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number,
    per_page: 100,
  })
  const changedFiles = listFiles.map((file) => file.filename)
  core.startGroup(`Found ${changedFiles.length} changed files`)
  for (const file of changedFiles) {
    core.info(file)
  }
  core.endGroup()

  core.startGroup(`Filtering ${workflowFiles.length} workflows based on the event`)
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
  return { matchedWorkflows }
}
