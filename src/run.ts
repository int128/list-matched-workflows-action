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
  const matchedWorkflows = await matchWorkflows(workflowFiles, context)
  core.info(`Matched ${matchedWorkflows.length} workflows`)
  for (const workflowFile of matchedWorkflows) {
    core.info(`- ${workflowFile.filename}`)
  }
  return { matchedWorkflows }
}

const matchWorkflows = async (workflowFiles: WorkflowFile[], context: Context) => {
  const { payload } = context

  if ('pull_request' in payload) {
    core.startGroup(`Comparing the base branch and merge commit of the pull request`)
    const changedFiles = await git.compareMergeCommit(context)
    core.endGroup()
    core.info(`Found ${changedFiles.length} changed files`)
    return workflowFiles.filter((f) => workflow.matchPullRequest(f.workflow, payload, changedFiles))
  }

  if ('before' in payload && 'after' in payload && 'ref' in payload) {
    core.startGroup(`Comparing the before and after commits of the push event`)
    const changedFiles = await git.compareTwoCommits(context, payload)
    core.endGroup()
    core.info(`Found ${changedFiles.length} changed files`)
    return workflowFiles.filter((f) => workflow.matchPush(f.workflow, payload, changedFiles))
  }

  throw new Error(`This action must be run on pull_request or push event`)
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
  core.info(`Found ${workflowFiles.length} workflows`)
  return workflowFiles
}
