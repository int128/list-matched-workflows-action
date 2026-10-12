import * as fs from 'node:fs/promises'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import { type Context, getToken, type PushPayload } from './github.js'

export const compareMergeCommit = async (context: Context): Promise<string[]> => {
  await exec.exec(
    'git',
    [
      ...gitTokenConfigFlags(context),
      'fetch',
      '--quiet',
      '--no-tags',
      // Fetch the merge commit and its first parent commit.
      '--depth=2',
      'origin',
      context.sha,
    ],
    {
      env: {
        ...process.env,
        CONFIG_VALUE_AUTHORIZATION_HEADER: authorizationHeader(),
      },
    },
  )
  await exec.exec('git', [
    'diff',
    `--output=${context.runnerTemp}/diff`,
    '--name-only',
    // The merge commit has two parents.
    // The first parent is the base branch to be merged into.
    // The second parent is the head commit.
    `${context.sha}^1`,
    context.sha,
  ])
  const diff = await fs.readFile(`${context.runnerTemp}/diff`, 'utf-8')
  return diff.split('\n').filter((line) => line)
}

export const comparePushedCommits = async (context: Context, payload: PushPayload): Promise<string[]> => {
  if (payload.before === '0000000000000000000000000000000000000000') {
    return await comparePushedNewBranch(context, payload)
  }
  const { before, after } = payload
  await exec.exec(
    'git',
    [...gitTokenConfigFlags(context), 'fetch', '--quiet', '--no-tags', '--depth=1', 'origin', before, after],
    {
      env: {
        ...process.env,
        CONFIG_VALUE_AUTHORIZATION_HEADER: authorizationHeader(),
      },
    },
  )
  await exec.exec('git', ['diff', `--output=${context.runnerTemp}/diff`, '--name-only', before, after])
  const diff = await fs.readFile(`${context.runnerTemp}/diff`, 'utf-8')
  return diff.split('\n').filter((line) => line)
}

const comparePushedNewBranch = async (context: Context, payload: PushPayload): Promise<string[]> => {
  const ancestor = payload.commits[0].id
  if (!ancestor) {
    return []
  }
  await exec.exec(
    'git',
    [
      ...gitTokenConfigFlags(context),
      'fetch',
      '--quiet',
      '--no-tags',
      // Fetch the parent of ancestor.
      '--depth=2',
      'origin',
      ancestor,
      payload.after,
    ],
    {
      env: {
        ...process.env,
        CONFIG_VALUE_AUTHORIZATION_HEADER: authorizationHeader(),
      },
    },
  )
  await exec.exec('git', [
    'diff',
    `--output=${context.runnerTemp}/diff`,
    '--name-only',
    // When a new branch is pushed, compare the parent of the ancestor of the deepest commit pushed.
    // https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#git-diff-comparisons
    `${ancestor}^`,
    payload.after,
  ])
  const diff = await fs.readFile(`${context.runnerTemp}/diff`, 'utf-8')
  return diff.split('\n').filter((line) => line)
}

const gitTokenConfigFlags = (context: Context) => {
  const origin = new URL(context.serverUrl).origin
  return [
    // Reset http.extraheader config set by actions/checkout
    // https://github.com/actions/checkout/issues/162#issuecomment-590821598
    `-c`,
    `http.${origin}/.extraheader=`,
    `--config-env=http.${origin}/.extraheader=CONFIG_VALUE_AUTHORIZATION_HEADER`,
  ]
}

const authorizationHeader = () => {
  const credentials = Buffer.from(`x-access-token:${getToken()}`).toString('base64')
  core.setSecret(credentials)
  return `AUTHORIZATION: basic ${credentials}`
}
