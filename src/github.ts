import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as core from '@actions/core'
import type { webhooks } from '@octokit/openapi-webhooks-types'

export const getToken = () => core.getInput('token')

type WebhookEvent = keyof webhooks
type Payload<E extends WebhookEvent> = webhooks[E]['post']['requestBody']['content']['application/json']

export type PullRequestPayload = Payload<Extract<keyof webhooks, `pull-request-${string}`>>
export type PushPayload = Payload<'push'>

export type Context = {
  repo: {
    owner: string
    repo: string
  }
  sha: string
  serverUrl: string
  runnerTemp: string
  payload: Payload<WebhookEvent>
}

export const getContext = async (): Promise<Context> => {
  // https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables
  return {
    repo: getRepo(),
    sha: getEnv('GITHUB_SHA'),
    serverUrl: getEnv('GITHUB_SERVER_URL'),
    runnerTemp: getEnv('RUNNER_TEMP'),
    payload: JSON.parse(await fs.readFile(getEnv('GITHUB_EVENT_PATH'), 'utf-8')) as Payload<WebhookEvent>,
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
