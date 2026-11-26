const { test } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
test('audience renderer preserves presets and renders safe custom text layouts', () => {
  const root = fs.realpathSync(os.tmpdir())
  const folder = fs.mkdtempSync(path.join(root, 'nsc-layout-render-'))
  const env = { ...process.env, NSC_LAYOUT_TEST_DIR: folder }
  delete env.ELECTRON_RUN_AS_NODE
  try {
    const result = spawnSync(require('electron'), ['--no-sandbox', '--disable-gpu', path.join(__dirname, 'studio-layout-render.electron.cjs')],
      { env, encoding: 'utf8', timeout: 60000 })
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.equal(JSON.parse(result.stdout.trim()).passed, true)
  } finally {
    if (path.dirname(fs.realpathSync(folder)).toLowerCase() === root.toLowerCase() && path.basename(folder).startsWith('nsc-layout-render-')) fs.rmSync(folder, { recursive: true, force: true })
  }
})
