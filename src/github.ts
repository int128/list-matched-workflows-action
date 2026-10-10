import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as core from '@actions/core'
import type { WebhookEvent } from '@octokit/webhooks-types'

export const getToken = () => core.getInput('token')

export type Context = {
  repo: {
    owner: string
    repo: string
  }
  sha: string
  serverUrl: string
  runnerTemp: string
  payload: WebhookEvent
}

export const getContext = async (): Promise<Context> => {
  // https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables
  return {
    repo: getRepo(),
    sha: getEnv('GITHUB_SHA'),
    serverUrl: getEnv('GITHUB_SERVER_URL'),
    runnerTemp: getEnv('RUNNER_TEMP'),
    payload: JSON.parse(await fs.readFile(getEnv('GITHUB_EVENT_PATH'), 'utf-8')) as WebhookEvent,
  }
}

const getRepo = () => {
  const [owner, repo] = getEnv('GITHUB_REPOSITORY').split('/')
  return { owner, repo }
}

const getEnv = (name: string): string => {
  assert(process.env[name], `${name} is required`)
  return process.env[name]
}
