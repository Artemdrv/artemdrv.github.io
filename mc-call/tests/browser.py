from playwright.sync_api import sync_playwright
from pathlib import Path
import json,time,os,atexit,subprocess,sys,socket
P=Path(__file__).resolve().parents[1];engine=os.environ.get('BROWSER','chromium');Q=P/'qa'/engine;Q.mkdir(parents=True,exist_ok=True);result={'engine':engine,'checks':[], 'errors':[], 'viewports':[]}
atexit.register(lambda:(Q/'browser-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)))
def record(name,ok=True,detail=''):
 result['checks'].append({'name':name,'pass':bool(ok),'detail':detail});print(('PASS ' if ok else 'FAIL ')+name,detail)
# Dedicated server permits a real connection-refused test in both engines.
server=subprocess.Popen([sys.executable,'-m','http.server','8766','--bind','127.0.0.1','--directory',str(P)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
atexit.register(lambda:server.poll() is None and server.terminate())
for _ in range(60):
 try:
  with socket.create_connection(('127.0.0.1',8766),timeout=.2):break
 except OSError:time.sleep(.1)
else:raise RuntimeError('Test server did not start')
with sync_playwright() as pw:
 browser=getattr(pw,engine).launch(headless=True,**({'executable_path':os.environ['BROWSER_EXECUTABLE']} if os.environ.get('BROWSER_EXECUTABLE') else {}))
 ctx=browser.new_context(viewport={'width':428,'height':926},device_scale_factor=2,is_mobile=True,has_touch=True)
 page=ctx.new_page();page.set_default_timeout(15000);page.on('pageerror',lambda e:result['errors'].append(str(e)))
 requests=[];page.on('request',lambda r:requests.append({'url':r.url,'method':r.method,'body':r.post_data}))
 page.goto('http://127.0.0.1:8766/?v=4');page.wait_for_function("document.documentElement.dataset.ready==='true'");page.wait_for_timeout(300)
 page.add_style_tag(content=':root{--safe-top:47px;--safe-bottom:34px}')
 page.evaluate('window.dispatchEvent(new Event("resize"))');page.wait_for_timeout(150)
 page.screenshot(path=str(Q/'keypad-428.png'))
 record('Starts on keypad',page.locator('#dialer').is_visible() and not page.locator('#contacts').is_visible())
 r=page.locator('#keys .key').first.bounding_box();record('Reference key size',abs(r['width']-88)<.1,str(r))
 # Normal touch input and long-press zero.
 for k in '123':page.locator('#keys [data-key="'+k+'"]').tap()
 record('Digits entered once each',page.locator('#number').inner_text()=='123',page.locator('#number').inner_text())
 b=page.locator('#delete').bounding_box();page.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2);page.mouse.down();page.wait_for_timeout(850);page.mouse.up()
 record('Hold delete clears with repeat',page.locator('#number').inner_text()=='')
 z=page.locator('#keys [data-key="0"]').bounding_box();page.mouse.move(z['x']+z['width']/2,z['y']+z['height']/2);page.mouse.down();page.wait_for_timeout(600);page.mouse.up()
 record('Long zero produces only +',page.locator('#number').inner_text()=='+')
 for k in '375291234567':page.locator('#keys [data-key="'+k+'"]').tap()
 record('Dynamic number formatting',page.locator('#number').inner_text()=='+375 (29) 123-45-67',page.locator('#number').inner_text())
 page.wait_for_timeout(140);page.screenshot(path=str(Q/'keypad-number-428.png'))
 # Button down feedback, then pointer cancellation.
 b=page.locator('#keys [data-key="5"]');box=b.bounding_box();page.mouse.move(box['x']+44,box['y']+44);page.mouse.down()
 record('Pressed state on touch down','pressed' in b.get_attribute('class'))
 page.screenshot(path=str(Q/'keypad-pressed.png'))
 page.mouse.move(4,100);page.mouse.up();record('Pressed state cancels on moving out','pressed' not in b.get_attribute('class'))
 # Keyboard activation is independent of recent pointer activation.
 page.locator('#keys [data-key="1"]').focus();before_number=page.locator('#number').inner_text();page.keyboard.press('Enter')
 record('Keyboard Enter activates focused key once',page.locator('#number').inner_text()==before_number+'1')
 # Five search taps work even while actual Search opens.
 for i in range(5):page.locator('#searchTab').tap();page.wait_for_timeout(70)
 record('Five search taps open settings',page.locator('#settings').is_visible())
 page.screenshot(path=str(Q/'settings-428.png'))
 page.locator('#force').fill('+12025550101');page.locator('#settingsForm button[type=submit]').click();page.locator('#settings').wait_for(state='hidden')
 record('Force hidden outside settings',not page.locator('#settings').is_visible() and '+12025550101' not in page.locator('#dialer').inner_text())
 page.reload();page.wait_for_timeout(500)
 for i in range(5):page.locator('#searchTab').tap()
 record('Force persists after reload',page.locator('#force').input_value()=='+12025550101')
 # Local VCF import, including a malicious FN and remote photo URL.
 vcf='''BEGIN:VCARD\nVERSION:3.0\nN:Иванова;Анна;;;\nFN:Анна Иванова\nTEL;TYPE=CELL:+12025550110\nEND:VCARD\nBEGIN:VCARD\nVERSION:3.0\nFN:Борис\nTEL:+12025550111\nPHOTO;VALUE=URI:https://example.com/never-fetch.jpg\nEND:VCARD\nBEGIN:VCARD\nVERSION:3.0\nFN:<img src=x onerror=alert(1)>\nTEL:+12025550112\nEND:VCARD'''
 before=len(requests)
 page.locator('#fileVCF').set_input_files({'name':'sample.vcf','mimeType':'text/vcard','buffer':vcf.encode()})
 page.locator('#message button[value=ok]').click();page.wait_for_timeout(300)
 record('Imported contacts displayed',page.get_by_role('button',name='Анна Иванова',exact=True).is_visible())
 record('Contact content treated as text',page.get_by_role('button',name='<img src=x onerror=alert(1)>',exact=True).is_visible() and page.locator('#contacts img').count()==0)
 record('VCF import sends no contact data',all(r['method']=='GET' and r['url'].startswith('http://127.0.0.1:8766') and not r['body'] for r in requests[before:]),str(requests[before:]))
 page.screenshot(path=str(Q/'contacts-428.png'))
 page.get_by_role('button',name='Анна Иванова',exact=True).click()
 record('Contact detail opens',page.locator('#detail').is_visible() and page.locator('#detail h1').inner_text()=='Анна Иванова')
 page.wait_for_timeout(250);page.screenshot(path=str(Q/'contact-card-428.png'))
 page.locator('#toggleFavorite').click();page.locator('[data-back-detail]').click();page.locator('[data-tab=calls]').click()
 record('Favorites connect to Calls',page.locator('.favorite-card').count()==1)
 # Contact call => local history; display must not leak prepared route.
 page.locator('.favorite-card').click();page.locator('[data-phone-index="0"]').click();page.wait_for_timeout(3400)
 record('Demo call timer starts',page.locator('#callStatus').inner_text().startswith('00:'))
 record('Visible caller stays selected contact',page.locator('#callName').inner_text()=='Анна Иванова')
 page.screenshot(path=str(Q/'call-428.png'))
 page.locator('#endCall').click();page.wait_for_timeout(200);page.locator('[data-tab=calls]').click()
 record('Recent call stored',page.locator('.list-row .row-name').first.inner_text()=='Анна Иванова')
 page.screenshot(path=str(Q/'calls-428.png'))
 page.locator('#searchTab').click();page.locator('#searchInput').fill('Анна')
 record('Search covers contacts and own recents',page.locator('#searchResults [data-contact]').count()==1 and page.locator('#searchResults [data-recent]').count()==1)
 page.screenshot(path=str(Q/'search-428.png'))
 # Create/edit contact through native-feeling forms.
 page.locator('[data-tab=contacts]').click();page.locator('[data-new-contact]').click()
 page.locator('#contactForm [name=first]').fill('Виктор');page.locator('#contactForm [name=phone]').fill('+12025550113');page.locator('#contactForm button[type=submit]').click();page.locator('#editor').wait_for(state='hidden')
 record('Manual contact create',page.get_by_role('button',name='Виктор',exact=True).is_visible())
 # Export backup file and ensure ephemeral access material excluded.
 for _ in range(5):page.locator('#searchTab').tap()
 page.locator('#exportBackup').click()
 with page.expect_download() as download:page.locator('#message button[value=ok]').click()
 dl=download.value;dl.save_as(str(Q/'test-backup.mcphone'));backup=json.loads((Q/'test-backup.mcphone').read_text())
 record('Backup export contains local contacts',len(backup['contacts'])==4)
 record('Backup excludes backend credentials','operatorKey' not in backup['settings'] and 'backend' not in backup['settings'])
 # Restore with confirmation and verify history/contact counts survive.
 page.locator('#fileBackup').set_input_files(str(Q/'test-backup.mcphone'));page.locator('#message button[value=ok]').click();page.wait_for_timeout(300)
 page.reload();page.wait_for_timeout(400);page.locator('[data-tab=contacts]').click()
 record('Restore and reload preserve contacts',page.locator('.contact-row').count()==4)
 # Responsive viewports: controls fit, touch centers align, native status-bar not painted.
 for w,h,top,bottom in [(320,568,0,0),(375,667,0,0),(375,812,44,34),(390,844,47,34),(393,852,59,34),(402,874,62,34),(414,896,44,34),(428,926,47,34),(430,932,59,34),(440,956,62,34),(844,390,0,21)]:
  page.set_viewport_size({'width':w,'height':h});page.add_style_tag(content=f':root{{--safe-top:{top}px;--safe-bottom:{bottom}px}}');page.evaluate('window.dispatchEvent(new Event("resize"))');page.locator('[data-tab=dialer]').click();page.wait_for_timeout(100)
  boxes=page.locator('#keys .key,#call,#nav').evaluate_all('(els)=>els.map(el=>{const r=el.getBoundingClientRect();return {id:el.id,k:el.dataset.key,x:r.x,y:r.y,w:r.width,h:r.height}})')
  ok=all(r['x']>=-1 and r['y']>=-1 and r['x']+r['w']<=w+1 and r['y']+r['h']<=h+1 for r in boxes)
  key0=boxes[0];call=[x for x in boxes if x['id']=='call'][0];nb=[x for x in boxes if x['id']=='nav'][0]
  nonoverlap=call['y']+call['h']<nb['y']+1 if w<h else True
  record(f'Viewport {w}×{h} bounds and nav',ok and nonoverlap,str(boxes) if not ok else '')
  result['viewports'].append({'width':w,'height':h,'key':key0,'pass':ok and nonoverlap})
  page.screenshot(path=str(Q/f'keypad-{w}x{h}.png'))
 # Offline reload after service worker controls the tab.
 page.set_viewport_size({'width':428,'height':926});page.reload()
 page.wait_for_function("document.documentElement.dataset.ready==='true'")
 page.evaluate('navigator.serviceWorker.ready')
 page.wait_for_function('navigator.serviceWorker.controller !== null')
 cached=page.evaluate("async()=>{const c=await caches.open('mc-call-r4-4.0.0');return !!(await c.match(new URL('./index.html',location.href)))}")
 record('Offline shell is installed in Cache Storage',cached)
 server.terminate();server.wait(timeout=5)
 try:
  with socket.create_connection(('127.0.0.1',8766),timeout=.5):unreachable=False
 except OSError:unreachable=True
 record('Origin connection is refused before offline navigation',unreachable)
 result['offline_method']='HTTP server stopped and verified unreachable; fresh navigation URL; no cache mocks or intercepted responses. Not an airplane-mode device test.'
 response=page.goto('http://127.0.0.1:8766/?offline_probe='+str(time.time_ns()))
 page.wait_for_function("document.documentElement.dataset.ready==='true'")
 record('Offline navigation returns a successful response',response is not None and response.status==200)
 page.wait_for_timeout(250)
 record('Offline launch works',page.locator('#keys .key').count()==12)
 page.locator('[data-tab=contacts]').click();record('Contacts readable offline',page.locator('.contact-row').count()==4)
 # The origin remains unreachable through the offline assertions.
 record('No remote or provider requests in demo',all(r['url'].startswith('http://127.0.0.1:8766') for r in requests))
 record('No browser JavaScript errors',not result['errors'],str(result['errors']))
 browser.close()
(Q/'browser-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print('TOTAL',len(result['checks']), 'FAILED',sum(not c['pass'] for c in result['checks']))

if any(not c['pass'] for c in result['checks']):raise SystemExit(1)
