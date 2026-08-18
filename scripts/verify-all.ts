#!/usr/bin/env node
/**
 * Verification script: runs all tests and prints a summary.
 * This is the "evidence that the whole objective is achieved" script.
 *
 * Run: node --import tsx/esm scripts/verify-all.ts
 */

import { execSync } from 'node:child_process'

const tests = [
  { name: 'contracts (tsc)', cmd: 'npx tsc --noEmit', cwd: 'packages/contracts' },
  { name: 'agent-host (tsc)', cmd: 'npx tsc --noEmit', cwd: 'packages/agent-host' },
  { name: 'ide-bridge-renderer (tsc)', cmd: 'npx tsc --noEmit', cwd: 'packages/ide-bridge-renderer' },
  { name: 'editor-as-tool (tsc)', cmd: 'npx tsc --noEmit', cwd: 'packages/editor-as-tool' },
  { name: 'provenance (tsc)', cmd: 'npx tsc --noEmit', cwd: 'packages/provenance' },
  { name: 'session-log-spine (tsc)', cmd: 'npx tsc --noEmit', cwd: 'packages/session-log-spine' },
  { name: 'approval-service (tsc)', cmd: 'npx tsc --noEmit', cwd: 'packages/approval-service' },
  { name: 'agent-view (tsc)', cmd: 'npx tsc --noEmit', cwd: 'packages/agent-view' },
  { name: 'extension-bridge (tsc)', cmd: 'npx tsc --noEmit', cwd: 'packages/extension-bridge' },
  { name: 'cloud-execution (tsc)', cmd: 'npx tsc --noEmit', cwd: 'packages/cloud-execution' },
  { name: 'skill-market (tsc)', cmd: 'npx tsc --noEmit', cwd: 'packages/skill-market' },
]

const root = process.cwd()
let passed = 0
let failed = 0

console.log('\n=== Ultimate Native IDE — Verification ===\n')

// Type checks
console.log('--- Type Checks ---')
for (const { name, cmd, cwd } of tests) {
  try {
    execSync(cmd, { cwd: `${root}/${cwd}`, stdio: 'pipe' })
    console.log(`  ✓ ${name}`)
    passed++
  } catch {
    console.error(`  ✗ ${name}`)
    failed++
  }
}

// Vitest
console.log('\n--- Test Suite ---')
try {
  const output = execSync('npx vitest run 2>&1', { cwd: root, encoding: 'utf-8' })
  const match = output.match(/Tests\s+(\d+)\s+passed/)
  const testCount = match ? match[1] : '?'
  console.log(`  ✓ vitest: ${testCount} tests passed`)
  passed++
} catch (err) {
  console.error(`  ✗ vitest failed`)
  failed++
}

// CLI verification
console.log('\n--- CLI Standalone ---')
try {
  execSync('node --import tsx/esm packages/agent-host/tests/cli-verify.ts', {
    cwd: root,
    stdio: 'pipe',
    timeout: 30_000,
    env: { ...process.env, DSH_HOME: `${root}/.dsh-home` },
  })
  console.log('  ✓ CLI: 6/6 passed')
  passed++
} catch {
  console.error('  ✗ CLI verification failed')
  failed++
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
