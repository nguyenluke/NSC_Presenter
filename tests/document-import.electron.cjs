const { app, nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const ts = require('typescript')
const root = process.env.NSC_DOCUMENT_TEST_DIR
app.setPath('userData', path.join(root, 'electron'))
app.disableHardwareAcceleration()
app.on('window-all-closed',()=>{})
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText,file)

function pdfFixture(file) {
  const streams = [
    'q 0.08 0.18 0.45 rg 0 0 960 540 re f Q BT /F1 48 Tf 1 1 1 rg 100 300 Td (NSC SERMON ONE) Tj ET',
    'q 0.8 0.2 0.1 rg 0 0 600 800 re f Q BT /F1 40 Tf 1 1 1 rg 40 400 Td (SECOND PAGE) Tj ET'
  ]
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${streams[0].length} >>\nstream\n${streams[0]}\nendstream`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
    `<< /Length ${streams[1].length} >>\nstream\n${streams[1]}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]
  let pdf = '%PDF-1.4\n'; const offsets = [0]
  for(let i=0;i<objects.length;i++){ offsets.push(Buffer.byteLength(pdf)); pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n` }
  const xref=Buffer.byteLength(pdf)
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  fs.writeFileSync(file,pdf)
}

app.whenReady().then(async()=>{
  try {
    const { PresenterDatabase } = require('../src/main/database.ts')
    const { MediaStorage } = require('../src/main/mediaStorage.ts')
    const { DocumentImporter } = require('../src/main/documentImport.ts')
    const data=path.join(root,'data'); const db=new PresenterDatabase(data); await db.init()
    const storage=new MediaStorage(data)
    const importer=new DocumentImporter(db, storage, process.env.NSC_PDF_RENDERER_FILE || path.resolve(__dirname,'../out/renderer/index.html'))
    const source=path.join(root,'test-sermon.pdf'); pdfFixture(source)
    const songsBefore=db.getAllSongs(), pendingBefore=db.getPendingSongs(), before=db.getMediaAssets().length
    const progress=[]
    const result=await importer.import(source, p=>progress.push(p))
    const pages=result.mediaAssets.filter(asset=>asset.documentId===result.documentId).sort((a,b)=>a.documentPage-b.documentPage)
    assert.equal(pages.length,2)
    assert.equal(pages[0].documentPage,1); assert.equal(pages[1].documentPage,2)
    assert.equal(pages[0].fitMode,'contain')
    const sizes=pages.map(page=>nativeImage.createFromPath(path.join(storage.getDirectory(),decodeURIComponent(new URL(page.url).pathname.slice(1)))).getSize())
    assert.deepEqual(sizes[0],{width:1920,height:1080})
    assert.deepEqual(sizes[1],{width:810,height:1080})
    const firstImage=nativeImage.createFromPath(path.join(storage.getDirectory(),decodeURIComponent(new URL(pages[0].url).pathname.slice(1))))
    const pixel=firstImage.toBitmap().subarray(0,4)
    assert.ok(pixel[0]>70 && pixel[2]<70,'First page did not render its blue background')
    assert.deepEqual(db.getAllSongs(),songsBefore); assert.deepEqual(db.getPendingSongs(),pendingBefore)
    const reopened=new PresenterDatabase(data); await reopened.init()
    assert.equal(reopened.getMediaAssets().filter(p=>p.documentId===result.documentId).length,2)
    await assert.rejects(importer.import(source,p=>{if(p.phase==='Rendering pages')importer.cancel()}),/cancelled/)
    assert.equal(db.getMediaAssets().length,before+2)
    assert.equal(fs.readdirSync(storage.getDirectory()).filter(f=>f.endsWith('.png')).length,2)
    const corrupt=path.join(root,'bad.pdf'); fs.writeFileSync(corrupt,'not a pdf')
    await assert.rejects(importer.import(corrupt,()=>{}),/render document|PDF|document/i)
    assert.equal(importer.busy,false)
    db.addServiceItem('media',pages[0].id)
    const allMedia=db.getMediaAssets().length
    const persist=db.persist
    db.persist=()=>{throw Error('Simulated storage failure')}
    assert.throws(()=>db.addDocumentPages([{...pages[0],documentId:'failed-import',title:'Should roll back'}]),/storage failure/)
    db.persist=persist
    assert.equal(db.getMediaAssets().length,allMedia)
    db.deleteDocument(result.documentId)
    assert.equal(db.getMediaAssets().filter(asset=>asset.documentId===result.documentId).length,0)
    assert.equal(db.getServiceItems().some(item=>item.itemType==='media'&&item.targetId===pages[0].id),false)
    if(process.env.NSC_TEST_POWERPOINT==='1'){
      for(const extension of ['pptx','ppt']){
        const converted=await importer.import(path.join(root,`fixture.${extension}`),()=>{})
        assert.equal(converted.mediaAssets.filter(page=>page.documentId===converted.documentId).length,2)
      }
    }
    console.log(JSON.stringify({passed:true,pages:2,sizes,cancelRollback:true,invalidPdf:true,originalSongsPreserved:true,offlineRenderer:true}))
  }catch(error){console.error(error);process.exitCode=1}
  finally{app.exit(process.exitCode||0)}
})
