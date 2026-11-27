import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { pathToFileURL } from 'url'

const execute = promisify(execFile)
const POWERPOINT_EXPORT = String.raw`
$ErrorActionPreference = 'Stop'
$app = $null
$presentation = $null
try {
  $existing = $null
  try { $existing = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application') } catch {}
  if ($null -ne $existing) {
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($existing)
    throw 'Close PowerPoint before importing, or export this presentation as PDF and import the PDF.'
  }
  $app = New-Object -ComObject PowerPoint.Application
  $app.AutomationSecurity = 3
  $app.DisplayAlerts = 1
  $presentation = $app.Presentations.Open($env:NSC_PPT_SOURCE, -1, 0, 0)
  $presentation.SaveAs($env:NSC_PPT_PDF, 32)
} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }
finally {
  if ($null -ne $presentation) { $presentation.Close(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) }
  if ($null -ne $app) { $app.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app) }
}
`

export async function presentationToPdf(source: string, directory: string): Promise<string> {
  const candidates = process.platform === 'win32' ? [
    path.join(process.env.ProgramFiles ?? 'C:/Program Files', 'LibreOffice/program/soffice.exe'),
    path.join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'LibreOffice/program/soffice.exe')
  ] : ['/Applications/LibreOffice.app/Contents/MacOS/soffice', '/usr/bin/libreoffice', '/usr/bin/soffice']
  const libreOffice = candidates.find(file => fs.existsSync(file))
  if (libreOffice) {
    const profile = pathToFileURL(path.join(directory, 'libreoffice-profile')).href
    await execute(libreOffice, [`-env:UserInstallation=${profile}`, '--headless', '--convert-to', 'pdf', '--outdir', directory, path.resolve(source)],
      { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 })
    const pdf = path.join(directory, `${path.basename(source, path.extname(source))}.pdf`)
    if (!fs.existsSync(pdf)) throw new Error('LibreOffice did not create a PDF. Export your presentation to PDF and import it instead.')
    return pdf
  }
  if (process.platform !== 'win32') throw new Error('Install LibreOffice to import PowerPoint files, or export your presentation as PDF and import it directly.')
  const pdf = path.join(directory, 'presentation.pdf')
  const powershell = path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe')
  try {
    await execute(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(POWERPOINT_EXPORT, 'utf16le').toString('base64')], {
      windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024,
      env: { ...process.env, NSC_PPT_SOURCE: path.resolve(source), NSC_PPT_PDF: pdf }
    })
  } catch (error) {
    const reason = (error as { stderr?: string }).stderr
    if (reason?.includes('Close PowerPoint')) throw new Error('Close PowerPoint before importing, or export the presentation as PDF and import that file.')
    throw new Error('PowerPoint conversion failed. This PC needs Microsoft PowerPoint or LibreOffice. You can also export the presentation to PDF and import it without either program.')
  }
  if (!fs.existsSync(pdf)) throw new Error('PowerPoint did not create a PDF. Export to PDF manually and import that file.')
  return pdf
}
