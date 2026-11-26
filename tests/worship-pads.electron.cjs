// Render real Chromium Web Audio offline; never plays through the user's speakers.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const folder = process.env.NSC_PAD_TEST_DIR
if (!folder) throw new Error('Run through node --test tests/worship-pads.test.cjs')
app.setPath('userData', folder)
app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  let win
  try {
    win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
    await win.loadURL('data:text/html,<title>NSC Offline Audio Test</title>')
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname,
      '../src/renderer/src/components/studio/worshipPads.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText
    const results = await win.webContents.executeJavaScript(`(async () => { try {
      const padModule = (() => { const exports = {};
      ${source}
      return exports; })();
      const { WorshipPadEngine, PAD_SOUNDS } = padModule;
      function rms(samples, from, to, rate) {
        let total = 0; const start = Math.floor(from * rate), end = Math.floor(to * rate);
        for (let i = start; i < end; i++) total += samples[i] ** 2;
        return Math.sqrt(total / (end - start));
      }
      const results = [];
      for (const sound of PAD_SOUNDS) {
        const ctx = new OfflineAudioContext(2, 32000 * 12, 32000);
        const engine = new WorshipPadEngine(ctx, 1);
        engine.play(130.8128, sound);
        const paused = ctx.suspend(4);
        const rendering = ctx.startRendering();
        await paused; engine.stop(); await ctx.resume();
        const buffer = await rendering;
        const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
        let peak = 0, difference = 0;
        for (let i = 0; i < left.length; i++) {
          if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) throw Error(sound.id + ': nonfinite audio');
          peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
          difference += (left[i] - right[i]) ** 2;
        }
        const body = rms(left, 3, 4, 32000);
        const attack = rms(left, 0, 0.1, 32000);
        const tail = rms(left, 11, 12, 32000);
        if (peak >= 0.98 || body < 0.005 || body > 0.3) throw Error(sound.id + ': unexpected level ' + peak + '/' + body);
        if (attack > body * 0.1 || tail > body * 0.002) throw Error(sound.id + ': fade not smooth or tail did not clear');
        if (difference < 0.01) throw Error(sound.id + ': missing stereo width');
        engine.dispose(); engine.dispose();
        results.push({ sound: sound.name, peak: +peak.toFixed(4), rms: +body.toFixed(4), tail: +tail.toFixed(8) });
      }
      // Stress mid-attack crossfades, rapid changes, stop/restart and volume changes.
      const ctx = new OfflineAudioContext(2, 32000 * 14, 32000);
      const engine = new WorshipPadEngine(ctx, 0.55);
      engine.play(130.8128, PAD_SOUNDS[0]);
      let paused = ctx.suspend(0.5);
      const rendering = ctx.startRendering();
      await paused;
      for (let i = 0; i < 24; i++) engine.play(130.8128 * 2 ** ((i % 12) / 12), PAD_SOUNDS[i % 5]);
      engine.setVolume(0.3);
      paused = ctx.suspend(3);
      await ctx.resume(); await paused;
      engine.stop(); engine.play(220, PAD_SOUNDS[4]);
      paused = ctx.suspend(5);
      await ctx.resume(); await paused;
      engine.stop(); engine.setVolume(1);
      await ctx.resume();
      const buffer = await rendering;
      for (let channel = 0; channel < 2; channel++) {
        const samples = buffer.getChannelData(channel);
        let maxStep = 0;
        for (let i = 1; i < samples.length; i++) {
          if (!Number.isFinite(samples[i]) || Math.abs(samples[i]) >= 0.98) throw Error('Crossfade clipped');
          maxStep = Math.max(maxStep, Math.abs(samples[i] - samples[i-1]));
        }
        if (maxStep > 0.08) throw Error('Abrupt crossfade discontinuity: ' + maxStep);
        if (rms(samples, 13, 14, 32000) > 0.00001) throw Error('Stop left a hanging voice');
      }
      engine.dispose();
      return results;
      } catch (error) { return { error: error.message, stack: error.stack }; }
    })()`)
    if (results.error) throw new Error(results.stack)
    console.log(JSON.stringify({ passed: true, presets: results, crossfadeStress: 'passed' }, null, 2))
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    win?.destroy()
    // The parent test removes temporary Chromium files after this process exits.
    app.exit(process.exitCode || 0)
  }
})
