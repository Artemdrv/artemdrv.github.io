from pathlib import Path
P=Path('mc-call')
def replace(path,old,new):
 p=P/path;s=p.read_text();assert old in s,(path,old[:100]);p.write_text(s.replace(old,new))
replace('app-r4.js',"const tones=new Tones();let press=null;", "const tones=new Tones();let press=null;const pointerTimes=new WeakMap();")
replace('app-r4.js',"e.preventDefault();const key=el.dataset.key,isCall=!!el.closest('#inCallKeys');", "e.preventDefault();pointerTimes.set(el,performance.now());const key=el.dataset.key,isCall=!!el.closest('#inCallKeys');")
replace('app-r4.js',"if(e.detail!==0)return;if(b.id==='delete')erase();", "if(e.detail!==0||e.pointerType||performance.now()-(pointerTimes.get(b)??-Infinity)<1200)return;if(b.id==='delete')erase();")
replace('app-r4.js',"addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select')||$('dialog[open]'))return;", """addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select')||$('dialog[open]'))return;
 const keyButton=e.target.closest('.key,#delete');
 if(keyButton&&(e.key==='Enter'||e.key===' ')){
  e.preventDefault();if(e.repeat)return;
  if(keyButton.id==='delete')erase();
  else if(keyButton.closest('#inCallKeys'))state.call?.connection?.sendDigits(keyButton.dataset.key);
  else append(keyButton.dataset.key);
  return;
 }""")
replace('app-r4.js',"state.ready=true;drawNumber();layout();", "state.ready=true;document.documentElement.dataset.ready='true';drawNumber();layout();")
replace('ui-r4.css',".round{width:42px;padding:11px;flex:none}",".round{width:42px;height:42px;min-height:42px;max-height:42px;padding:11px;flex:none}")
replace('ui-r4.css',".close{font-size:25px;width:32px;min-height:32px;height:32px;", ".close{font-size:25px;width:32px;min-height:32px;height:32px;max-height:32px;")
replace('ui-r4.css',"@keyframes enter{from{transform:translateX(18px);opacity:.7}to{transform:none;opacity:1}}", "@keyframes enter{from{transform:translateX(18px)}to{transform:none}}")
replace('tests/browser.py',"page.goto('http://127.0.0.1:8765/?v=4');page.wait_for_timeout(800)","page.goto('http://127.0.0.1:8765/?v=4');page.wait_for_function(\"document.documentElement.dataset.ready==='true'\");page.wait_for_timeout(300)")
replace('tests/browser.py',"page.locator('#number').inner_text()=='123')", "page.locator('#number').inner_text()=='123',page.locator('#number').inner_text())")
replace('tests/browser.py',"page.locator('#number').inner_text()=='+375 (29) 123-45-67')", "page.locator('#number').inner_text()=='+375 (29) 123-45-67',page.locator('#number').inner_text())")
replace('tests/browser.py',"page.screenshot(path=str(Q/'keypad-number-428.png'))", "page.wait_for_timeout(140);page.screenshot(path=str(Q/'keypad-number-428.png'))")
replace('tests/browser.py',"page.screenshot(path=str(Q/'contact-card-428.png'))", "page.wait_for_timeout(250);page.screenshot(path=str(Q/'contact-card-428.png'))")
replace('tests/browser.py',"# Five search taps work even while actual Search opens.","""# Keyboard activation is independent of recent pointer activation.
 page.locator('#keys [data-key="1"]').focus();before_number=page.locator('#number').inner_text();page.keyboard.press('Enter')
 record('Keyboard Enter activates focused key once',page.locator('#number').inner_text()==before_number+'1')
 # Five search taps work even while actual Search opens.""")
for name in ['app.js','styles.css','config.js']:
 (P/name).unlink(missing_ok=True)
# Correct fallback when no offline shell was cached.
replace('sw.js',"catch{return (await caches.open(CACHE)).match(new URL('./index.html',SCOPE))||Response.error();}","catch{const hit=await (await caches.open(CACHE)).match(new URL('./index.html',SCOPE));return hit||Response.error();}")
replace('app-r4.js',"const phone=$('#phone'),nav=$('#nav');", """const phone=$('#phone'),nav=$('#nav');
addEventListener('pointerdown',()=>document.documentElement.classList.add('pointer-input'),true);
addEventListener('keydown',()=>document.documentElement.classList.remove('pointer-input'),true);""")
p=P/'ui-r4.css';p.write_text(p.read_text()+'\n.pointer-input button:focus-visible{outline:none}\n')
replace('app-r4.js',"const response=await fetch(base+'/api/session'", "const timeout=setTimeout(()=>call.abort.abort(),15000);\n  let response;try{response=await fetch(base+'/api/session'")
replace('app-r4.js',"signal:call.abort.signal,cache:'no-store'});\n  if(!response.ok)","signal:call.abort.signal,cache:'no-store'});}finally{clearTimeout(timeout)}\n  if(!response.ok)")
# WebKit setOffline failed with an internal navigation error in our CI. Test
# actual origin unavailability instead. Do not mock service workers or caches.
replace('tests/browser.py',"import json,time,os,atexit", "import json,time,os,atexit,subprocess,sys,socket")
replace('tests/browser.py',"with sync_playwright() as pw:", """# Dedicated server permits a real connection-refused test in both engines.
server=subprocess.Popen([sys.executable,'-m','http.server','8766','--bind','127.0.0.1','--directory',str(P)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
atexit.register(lambda:server.poll() is None and server.terminate())
for _ in range(60):
 try:
  with socket.create_connection(('127.0.0.1',8766),timeout=.2):break
 except OSError:time.sleep(.1)
else:raise RuntimeError('Test server did not start')
with sync_playwright() as pw:""")
replace('tests/browser.py',"browser=getattr(pw,engine).launch(headless=True)","browser=getattr(pw,engine).launch(headless=True,**({'executable_path':os.environ['BROWSER_EXECUTABLE']} if os.environ.get('BROWSER_EXECUTABLE') else {}))")
replace('tests/browser.py',"http://127.0.0.1:8765", "http://127.0.0.1:8766")
replace('tests/browser.py',"page.set_viewport_size({'width':428,'height':926});page.reload();page.wait_for_timeout(700);page.evaluate('navigator.serviceWorker.ready');ctx.set_offline(True);page.reload();page.wait_for_timeout(500)","""page.set_viewport_size({'width':428,'height':926});page.reload()
 page.wait_for_function(\"document.documentElement.dataset.ready==='true'\")
 page.evaluate('navigator.serviceWorker.ready')
 page.wait_for_function('navigator.serviceWorker.controller !== null')
 cached=page.evaluate(\"async()=>{const c=await caches.open('mc-call-r4-4.0.0');return !!(await c.match(new URL('./index.html',location.href)))}\")
 record('Offline shell is installed in Cache Storage',cached)
 server.terminate();server.wait(timeout=5)
 try:
  with socket.create_connection(('127.0.0.1',8766),timeout=.5):unreachable=False
 except OSError:unreachable=True
 record('Origin connection is refused before offline navigation',unreachable)
 result['offline_method']='HTTP server stopped and verified unreachable; fresh navigation URL; no cache mocks or intercepted responses. Not an airplane-mode device test.'
 response=page.goto('http://127.0.0.1:8766/?offline_probe='+str(time.time_ns()))
 page.wait_for_function(\"document.documentElement.dataset.ready==='true'\")
 record('Offline navigation returns a successful response',response is not None and response.status==200)
 page.wait_for_timeout(250)""")
replace('tests/browser.py',"ctx.set_offline(False)","# The origin remains unreachable through the offline assertions.")
for name in ['add-contact.webp','bottom-bar.webp','call-button.webp','delete.webp','keypad-block.webp','icon-180.png','icon-192.png','icon-512.png']:
 (P/'assets'/name).unlink(missing_ok=True)
replace('README.md',"Локальный `render-offline.py` — только визуальный стенд с мокированным хранилищем; его результат **не является проверкой IndexedDB или офлайн-установки**. Полные browser checks вынесены в GitHub Actions. Проверка Chromium не равна проверке Safari / WebKit / физического iPhone.","Browser QA проверяет настоящую IndexedDB и Cache Storage без их подмены. Для офлайн-проверки отдельный HTTP-сервер физически останавливается, затем выполняется переход на новый URL и чтение сохранённых контактов. Это проверка недоступности сети до origin, а не аппаратного авиарежима iPhone. WebKit и Chromium запускаются в GitHub Actions; они не заменяют проверку установленной PWA на физическом iPhone.")
print('Applied R4 final touch, header, network and offline evidence fixes')
