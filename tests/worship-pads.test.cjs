const { test } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

test('five stereo pads render cleanly and crossfade without hanging notes', () => {
  const root = fs.realpathSync(os.tmpdir())
  const folder = fs.mkdtempSync(path.join(root, 'nsc-pad-render-'))
  const env = { ...process.env, NSC_PAD_TEST_DIR: folder }
  delete env.ELECTRON_RUN_AS_NODE
  try {
    // This isolated offline test needs no renderer sandbox or audio device.
    // The production application's sandbox/security settings remain unchanged.
    const result = spawnSync(require('electron'), ['--no-sandbox', '--disable-gpu',
      path.join(__dirname, 'worship-pads.electron.cjs')], {
      env, encoding: 'utf8', timeout: 60000
    })
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    const output = JSON.parse(result.stdout.trim())
    assert.equal(output.passed, true)
    assert.equal(output.presets.length, 5)
    console.log(output)
  } finally {
    // Verify this recursively deleted test folder is a direct child of the temp root.
    if (path.dirname(fs.realpathSync(folder)) === root && path.basename(folder).startsWith('nsc-pad-render-')) {
      fs.rmSync(folder, { recursive: true, force: true })
    }
  }
})
