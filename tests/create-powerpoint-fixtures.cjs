const {spawnSync}=require('node:child_process')
const path=require('node:path')
module.exports=function createPowerPointFixtures(folder){
  const script=String.raw`
$ErrorActionPreference='Stop'
$app=$null; $deck=$null
try {
  $existing=$null
  try {$existing=[Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')} catch {}
  if ($null -ne $existing) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($existing); throw 'Close PowerPoint before running this optional test.' }
  $app=New-Object -ComObject PowerPoint.Application
  $app.AutomationSecurity=3
  $app.DisplayAlerts=1
  $deck=$app.Presentations.Add(0)
  $deck.PageSetup.SlideWidth=960; $deck.PageSetup.SlideHeight=540
  foreach($number in 1..2){
    $slide=$deck.Slides.Add($number,12)
    $shape=$slide.Shapes.AddTextbox(1,70,150,820,220)
    $shape.TextFrame.TextRange.Text="NSC Sermon Test $number — Ân điển Chúa"
    $shape.TextFrame.TextRange.Font.Name='Arial'
    $shape.TextFrame.TextRange.Font.Size=36
  }
  $deck.SaveAs([IO.Path]::Combine($env:NSC_PPT_FIXTURE_DIR,'fixture.pptx'),24)
  $deck.SaveAs([IO.Path]::Combine($env:NSC_PPT_FIXTURE_DIR,'fixture.ppt'),1)
} finally {
  if($null -ne $deck){$deck.Close();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($deck)}
  if($null -ne $app){$app.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)}
}`
  const executable=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe')
  const result=spawnSync(executable,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],
    {env:{...process.env,NSC_PPT_FIXTURE_DIR:folder},encoding:'utf8',windowsHide:true,timeout:90000})
  if(result.error||result.status!==0)throw new Error(result.error?.message||result.stderr||'Could not create PowerPoint fixtures')
}
