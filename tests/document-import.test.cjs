const {test}=require('node:test')
const assert=require('node:assert/strict')
const {spawnSync}=require('node:child_process')
const fs=require('node:fs'),os=require('node:os'),path=require('node:path')
test('PDF sermon import renders offline, persists ordered pages and rolls back cancellation',()=>{
  const root=fs.realpathSync(os.tmpdir()),folder=fs.mkdtempSync(path.join(root,'nsc-document-test-'))
  const env={...process.env,NSC_DOCUMENT_TEST_DIR:folder};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL
  try{
    if(process.env.NSC_TEST_POWERPOINT==='1')require('./create-powerpoint-fixtures.cjs')(folder)
    const result=spawnSync(require('electron'),['--no-sandbox','--disable-gpu',path.join(__dirname,'document-import.electron.cjs')],{env,encoding:'utf8',timeout:120000})
    assert.ifError(result.error);assert.equal(result.status,0,result.stderr||result.stdout)
    assert.ok(result.stdout.includes('"passed":true'),result.stdout)
  }finally{
    if(path.dirname(fs.realpathSync(folder)).toLowerCase()===root.toLowerCase()&&path.basename(folder).startsWith('nsc-document-test-'))fs.rmSync(folder,{recursive:true,force:true})
  }
})
