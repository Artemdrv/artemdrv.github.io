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
print('Applied r4 touch, header and animation fixes')
