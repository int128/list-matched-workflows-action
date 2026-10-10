import * as core from '@actions/core'
import * as exec from '@actions/exec'
import { type Context, getToken } from './github.js'

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
  const gitDiff = await exec.getExecOutput('git', [
    'diff',
    '--name-only',
    // The merge commit has two parents.
    // The first parent is the base branch to be merged into.
    // The second parent is the head commit.
    `${context.sha}^1`,
    context.sha,
  ])
  return gitDiff.stdout.split('\n').filter((f) => f)
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
