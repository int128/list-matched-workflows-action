import * as core from '@actions/core'
import { getContext } from './github.js'
import { run } from './run.js'

try {
  const outputs = await run(
    {
      workflows: core.getInput('workflows', { required: true }),
    },
    await getContext(),
  )
  core.setOutput('matched-workflows-json', outputs.matchedWorkflows)
} catch (e) {
  core.setFailed(e instanceof Error ? e : String(e))
  console.error(e)
}
