import { describe, expect, it } from 'vitest'
import { createGlobMatcher } from '../src/workflow.js'

describe('createGlobMatcher', () => {
  it('matches anything when no pattern is given', () => {
    const matcher = createGlobMatcher([])
    expect(matcher('github.foo.bar')).toBe(true)
    expect(matcher('github.foo.baz')).toBe(true)
  })
  it('matches it when a pattern is given', () => {
    const matcher = createGlobMatcher(['*.bar'])
    expect(matcher('github.foo.bar')).toBe(true)
    expect(matcher('github.foo.baz')).toBe(false)
  })
  it('excludes it when a negative pattern is given', () => {
    const matcher = createGlobMatcher(['*', '!*.github.*'])
    expect(matcher('foo.github.bar')).toBe(false)
    expect(matcher('foo.github.baz')).toBe(false)
    expect(matcher('example.bar')).toBe(true)
    expect(matcher('example.baz')).toBe(true)
  })
  it('takes higher precedence to the later pattern', () => {
    // https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow#example-including-and-excluding-branches
    const matcher = createGlobMatcher(['*.bar', '!foo.*', '*.baz'])
    expect(matcher('foo.github.bar')).toBe(false)
    expect(matcher('foo.github.baz')).toBe(true)
    expect(matcher('example.bar')).toBe(true)
    expect(matcher('example.baz')).toBe(true)
  })
})
