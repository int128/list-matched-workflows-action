import assert from 'assert'
import * as core from '@actions/core'
import * as fs from 'fs/promises'
import * as glob from '@actions/glob'
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

export const run = async (inputs: Inputs, octokit: Octokit, context: Context): Promise<void> => {
  assert('pull_request' in context.payload, 'This action must be run on a pull_request event')

  core.info(`Fetching the list of changed files in #${context.payload.pull_request.number}`)
  const listFiles = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number,
    per_page: 100,
  })
  const changedFiles = listFiles.map((file) => file.filename)
  core.info(`Found ${changedFiles.length} changed files in #${context.payload.pull_request.number}`)

  const workflows: Workflow[] = []
  const workflowGlob = await glob.create(inputs.workflows)
  const workflowFilenames = await workflowGlob.glob()
  for (const workflowFilename of workflowFilenames) {
    core.info(`Parsing ${workflowFilename}`)
    const workflow: unknown = yaml.load(await fs.readFile(workflowFilename, 'utf8'))
    assertIsWorkflow(workflow)
    workflows.push(workflow)
  }

  core.info(`Filtering ${workflows.length} workflows based on the event`)
  core.info(`pull_request.type: ${context.payload.action}`)
  core.info(`pull_request.branch: ${context.payload.pull_request.base.ref}`)
  const matchedWorkflows = []
  for (const workflow of workflows) {
    if (!matchPullRequestType(workflow, context.payload.action)) {
      continue
    }
    if (!matchPullRequestBranch(workflow, context.payload.pull_request.base.ref)) {
      continue
    }
    if (!matchPullRequestPaths(workflow, changedFiles)) {
      continue
    }
    matchedWorkflows.push(workflow)
  }
}
