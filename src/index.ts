import * as core from '@actions/core'
import { run } from './run.js'
import { getContext, getOctokit } from './github.js'

try {
  const outputs = await run(
    {
      workflows: core.getInput('workflows', { required: true }),
    },
    getOctokit(),
    await getContext(),
  )
  core.setOutput('matched-workflows-json', outputs.matchedWorkflows)
} catch (e) {
  core.setFailed(e instanceof Error ? e : String(e))
  console.error(e)
}
