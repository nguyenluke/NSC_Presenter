const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const esbuild = require('esbuild')
app.setPath('userData', process.env.NSC_LAYOUT_TEST_DIR)
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  let win
  try {
    const repo = path.resolve(__dirname, '..')
    const script = esbuild.buildSync({ stdin: { resolveDir: repo, sourcefile: 'layout-test.tsx', loader: 'tsx', contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { AudienceCanvas } from './src/renderer/src/components/outputs/AudienceCanvas';
      import { StageMonitorCanvas } from './src/renderer/src/components/outputs/StageMonitorCanvas';
      import { OperatorStudioView } from './src/renderer/src/views/OperatorStudioView';
      import { useStudioStore } from './src/renderer/src/store/useStudioStore';
      import { DEFAULT_SHORTCUTS } from './src/shared/keyboardShortcuts';
      const root = createRoot(document.getElementById('root'));
      const wait = () => new Promise(resolve => setTimeout(resolve, 100));
      const check = (ok, message) => { if (!ok) throw Error(message); };
      const profile = { id: 'test', screenType: 'audience', languageMode: 'both', primaryFontSize: 64,
        secondaryFontSize: 42, primaryColor: '#fff', secondaryColor: '#fc0', dimOpacity: 0, verticalAlign: 'center' };
      const state = { currentSlide: { primaryText: 'Ngợi khen Chúa\\nBằng cả tấm lòng', secondaryText: 'Praise the Lord\\nWith all my heart' },
        activeBackground: null, foregroundMedia: null, logoMedia: null, showLogo: false, clearText: false,
        clearBackground: false, blackout: false, audienceMessage: '' };
      window.runLayoutTests = async () => { try {
        for (const position of ['top','center','bottom']) {
          root.render(<AudienceCanvas profile={{...profile, verticalAlign: position}} liveState={state} />);
          await wait();
          const bounds = document.querySelector('[data-text-position="'+position+'"] > div').getBoundingClientRect();
          if (position === 'top') check(Math.abs(bounds.top-96)<1, 'Top preset margin changed: '+bounds.top);
          if (position === 'bottom') check(Math.abs(bounds.bottom-984)<1, 'Bottom preset margin changed: '+bounds.bottom);
          if (position === 'center') check(Math.abs(bounds.top+bounds.height/2-540)<1, 'Center preset changed');
        }
        const layout = { x: 75, y: 0, width: 30, align: 'right', languageGap: 12 };
        root.render(<AudienceCanvas profile={{...profile, verticalAlign: 'custom', customTextLayout: layout}}
          liveState={{...state, audienceMessage: 'Parent needed at check-in\\nPlease see the welcome team'}} />);
        await wait(); await wait();
        const text = document.querySelector('[data-text-position="custom"] > div');
        const bounds = text.getBoundingClientRect();
        const notice = document.querySelector('.top-8').getBoundingClientRect();
        check(bounds.top >= notice.bottom+31, 'Custom text overlaps audience notice');
        check(bounds.left >= 15 && bounds.right <= 1905, 'Text box outside screen');
        check(Math.abs(bounds.width-576)<1, 'Wrong custom text width');
        check(getComputedStyle(text.querySelector('p')).textAlign === 'right', 'Custom alignment missing');
        check(getComputedStyle(text).gap === '12px', 'Language gap missing');
        root.render(<AudienceCanvas profile={{...profile, verticalAlign: 'custom', customTextLayout: {...layout, y:100}}} liveState={state} />);
        await wait(); await wait();
        const bottom = document.querySelector('[data-text-position="custom"] > div').getBoundingClientRect();
        check(bottom.bottom<=1065, 'Custom bottom clipped');
        root.render(<AudienceCanvas profile={{...profile,verticalAlign:'custom',customTextLayout:{...layout,y:50},
          primaryTextStyle:{fontFamily:'Arial',bold:false,italic:true,stretch:120,tracking:2},
          secondaryTextStyle:{fontFamily:'Georgia',bold:true,italic:false}}} liveState={state} />);
        await wait(); await wait();
        const styled=document.querySelector('[data-text-position="custom"] > div');
        const first=styled.querySelector('p'),second=styled.querySelectorAll('p')[1];
        check(getComputedStyle(first).fontWeight==='400','Bold off not honored');
        check(getComputedStyle(first).fontStyle==='italic','Italic not honored');
        check(getComputedStyle(first).fontFamily.includes('Arial'),'Font family not honored');
        check(getComputedStyle(first).letterSpacing==='2px','Tracking not honored');
        check(Math.abs(first.getBoundingClientRect().width-styled.getBoundingClientRect().width)<2,'Stretched text overflows its box');
        check(getComputedStyle(second).fontStyle==='normal','Secondary italic off not honored');
        // Exercise the real operator handler and shortcut editor, with isolated fake IPC.
        let live = {...useStudioStore.getState().liveState, activeSongId:1, activeSlideGlobalIndex:0};
        let updates = 0;
        let savedBindings = null;
        const customKeys = structuredClone(DEFAULT_SHORTCUTS);
        customKeys.next = ['KeyN']; customKeys.section2 = ['KeyC'];
        const song = (id) => ({id, titlePrimary:'Song '+id, titleSecondary:'', author:'', musicalKey:'G', bpm:72, updatedAt:'',
          arrangement:['v1','c1'], sections:[{id:'v1',type:'Verse',label:'Verse 1',slides:[{id:'v'+id,primaryText:'Verse',secondaryText:''}]},
          {id:'c1',type:'Chorus',label:'Chorus',slides:[{id:'c'+id,primaryText:'Chorus',secondaryText:''}]}]});
        window.nscApi = {
          getShortcuts: async()=>customKeys,
          saveShortcuts: async(bindings)=>(savedBindings=bindings),
          saveOutputProfile: async(profile)=>[profile],
          updateLiveState: async(patch)=>{updates++; live={...live,...patch}; return live;}
        };
        useStudioStore.setState({initialized:true, songs:[song(1),song(2)], selectedSongId:2, temporarySongs:{},
          liveState:live, outputProfiles:[{...profile, name:'Audience', enabled:false, assignedDisplayId:null, windowMode:'virtual'}],
          mediaAssets:[], audioTracks:[], serviceItems:[], displays:[]});
        root.render(<OperatorStudioView />); await wait();
        const press = (code,key=code,target=document.body)=>target.dispatchEvent(new KeyboardEvent('keydown',{code,key,bubbles:true,cancelable:true}));
        press('Digit2','2'); await wait(); check(updates===0,'Old section binding still active');
        press('KeyC','c'); await wait(); check(live.activeSongId===2 && live.currentSlide.id==='c2','Shortcut cued wrong song or section');
        const before = updates;
        press('KeyC','c',document.querySelector('input[placeholder="Filter library..."]')); await wait();
        check(updates===before,'Shortcut fired while typing');
        const button = text => [...document.querySelectorAll('button')].find(el=>el.textContent.trim()===text);
        button('Keys').click(); await wait(); button('Customize shortcuts').click(); await wait();
        press('KeyC','c'); await wait(); check(updates===before,'Shortcut fired behind dialog');
        const dialog = document.querySelector('[aria-label="Customize keyboard shortcuts"]');
        const nextRow = [...dialog.querySelectorAll('div')].find(el=>el.querySelector('span')?.textContent==='Next slide');
        [...nextRow.querySelectorAll('button')].find(el=>el.textContent.includes('Add key')).click(); await wait();
        press('KeyC','c',document.querySelector('[aria-label="Record shortcut for Next slide"]')); await wait();
        check(document.querySelector('[role="alert"]').textContent.includes('assigned more than once'),'Duplicate key not explained');
        press('KeyM','m',document.querySelector('[aria-label="Record shortcut for Next slide"]')); await wait();
        button('Save shortcuts').click(); await wait();
        check(savedBindings.next.includes('KeyM'),'Recorded shortcut was not saved');
        press('KeyM','m'); await wait(); check(updates===before+1,'Saved shortcut not used by operator');
        button('Text').click(); await wait();
        [...document.querySelectorAll('button')].find(el=>el.textContent.includes('Customize text position')).click(); await wait();
        const widthSlider = document.querySelector('[aria-label="Text box width"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(widthSlider,'30');
        widthSlider.dispatchEvent(new Event('input',{bubbles:true})); await wait();
        check(useStudioStore.getState().outputProfiles[0].verticalAlign==='center','Draft position affected live output before Apply');
        button('Apply layout').click(); await wait();
        check(useStudioStore.getState().outputProfiles[0].verticalAlign==='custom','Custom position did not apply');
        check(useStudioStore.getState().outputProfiles[0].customTextLayout.width===30,'Draft width did not apply');
        button('Top').click(); await wait();
        check(useStudioStore.getState().outputProfiles[0].verticalAlign==='top','Preset did not replace custom positioning');
        check(!document.querySelector('[aria-label="Language 1 font"]'),'Advanced font controls visible by default');
        const advanced=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('Advanced text settings'));
        advanced.click();await wait();
        check(advanced.getAttribute('aria-expanded')==='true','Advanced settings did not expand');
        const font=document.querySelector('[aria-label="Language 1 font"]');
        font.value='Georgia';font.dispatchEvent(new Event('change',{bubbles:true}));await wait();
        document.querySelector('[aria-label="Language 1 bold"]').click();await wait();
        check(useStudioStore.getState().outputProfiles[0].primaryTextStyle.fontFamily==='Georgia','Font picker did not save');
        check(useStudioStore.getState().outputProfiles[0].primaryTextStyle.bold===false,'Style controls overwrote or missed selection');
        advanced.click();await wait();
        check(!document.querySelector('[aria-label="Language 1 font"]'),'Advanced settings did not collapse');
        check(useStudioStore.getState().outputProfiles[0].primaryTextStyle.fontFamily==='Georgia','Hiding advanced settings changed saved style');
        advanced.click();await wait();
        button('Reset text to defaults').click();await wait();
        const resetProfile=useStudioStore.getState().outputProfiles[0];
        check(resetProfile.verticalAlign==='center' && resetProfile.languageMode==='both','Reset did not restore centered bilingual layout');
        check(resetProfile.primaryFontSize===64 && resetProfile.secondaryFontSize===42 && resetProfile.secondaryColor==='#FCD34D','Reset did not restore sizes/colors');
        check(!resetProfile.primaryTextStyle.fontFamily && resetProfile.primaryTextStyle.bold===undefined,'Reset retained customized typography');
        check(document.querySelector('[aria-label="Language 1 font"]').value==='','Reset font picker is stale');
        check(resetProfile.customTextLayout.width===88,'Reset retained custom position');
        check(resetProfile.id===profile.id && resetProfile.windowMode==='virtual','Reset changed screen configuration');
        document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));await wait();
        useStudioStore.setState({liveState:{...useStudioStore.getState().liveState,timerSeconds:-61,timerMode:'countdown'}});
        button('Timers').click();await wait();
        check(document.querySelector('[data-timer-state="OVERTIME"]').classList.contains('text-red-400'),'Operator overtime is not red');
        const pages=[1,2].map(page=>({id:30+page,title:'Page '+page,bin:'Sermon & Events',mediaType:'image',url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWo4AAAAASUVORK5CYII=',fitMode:'contain',documentId:'doc',documentTitle:'Test Sermon',documentPage:page,documentPages:2}));
        window.nscApi.importVisualMedia=async()=>pages;
        window.nscApi.onDocumentImportProgress=()=>()=>{};
        useStudioStore.setState({mediaAssets:[],selectedDocumentId:null,activeMediaBin:'Worship Designs'});await wait();
        const beforeImport=updates;
        button('+ Import Media').click();await wait();await wait();
        check(useStudioStore.getState().activeMediaBin==='Sermon & Events','Main import did not switch to sermon bin');
        check(updates===beforeImport,'Import changed the live output');
        check(document.querySelector('[aria-label="Show document page 1"]'),'Document deck did not open');
        document.querySelector('[aria-label="Show document page 1"]').click();await wait();
        press('KeyM','m');await wait();check(useStudioStore.getState().liveState.foregroundMedia.documentPage===2,'Document next key failed');
        const beforeSection=updates;press('KeyC','c');await wait();check(updates===beforeSection,'Song section shortcut fired in sermon deck');
        root.render(<StageMonitorCanvas profile={profile} liveState={{...useStudioStore.getState().liveState,timerSeconds:-61,timerMode:'countdown'}} />);await wait();
        check(document.body.textContent.includes('OVERTIME +01:01'),'Stage overtime missing');
        check(document.querySelector('[alt="Current sermon page"]'),'Stage sermon preview missing');
        return { passed:true, presets:['top','center','bottom'], customNoticeClearance:true, alignment:true, width:true, spacing:true,
          customShortcuts:true, typingSuppression:true, modalSuppression:true, duplicateDetection:true, recordedBinding:true, previewApply:true };
      } catch(error) { return {error:error.message, stack:error.stack}; } };
    ` }, bundle: true, write: false, platform: 'browser', format: 'iife', tsconfig: path.join(repo, 'tsconfig.web.json') }).outputFiles[0].text
    win = new BrowserWindow({ show: false, width: 1920, height: 1080,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } })
    await win.loadURL('data:text/html,' + encodeURIComponent('<style>body{margin:0}#root{width:1920px;height:1080px}</style><div id="root"></div>'))
    const assets = path.join(repo, 'out/renderer/assets')
    await win.webContents.insertCSS(fs.readFileSync(path.join(assets, fs.readdirSync(assets).find(file => file.endsWith('.css'))), 'utf8'))
    await win.webContents.executeJavaScript(script)
    const result = await win.webContents.executeJavaScript('window.runLayoutTests()')
    if (result.error) throw new Error(result.stack)
    console.log(JSON.stringify(result))
  } catch (error) { console.error(error); process.exitCode = 1 }
  finally { win?.destroy(); app.exit(process.exitCode || 0) }
})
