import {VERSION,DEFAULTS,Store,esc,cleanPhone,digits,fold,validTarget,formatPhone,uid,parseVCF,normalContact,mergeContacts,validateBackup,matchContact} from './core-r4.js';
import { ART } from './assets-r4.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const icon=(name,cls='')=>ART[name]?`<span class="glyph ${cls}" aria-hidden="true" style="--glyph:url('${ART[name]}')"></span>`:`<svg class="${cls}" aria-hidden="true" focusable="false"><use href="./symbols-r4.svg#${name}"></use></svg>`;
const state={tab:'dialer',raw:'',contacts:[],recents:[],settings:{...DEFAULTS},filter:'all',editing:false,limit:500,contact:null,returnTab:'dialer',operatorKey:'',call:null,ready:false};
const store=new Store();let secretTaps=[],returnAfterSettings='dialer',toastTimer=0,wakeLock=null;
const phone=$('#phone'),nav=$('#nav');
addEventListener('pointerdown',()=>document.documentElement.classList.add('pointer-input'),true);
addEventListener('keydown',()=>document.documentElement.classList.remove('pointer-input'),true);
$('#version').textContent=VERSION;
$('#call').innerHTML=icon('handset');$('#delete').innerHTML=icon('delete');$('#addContact').innerHTML=icon('add-contact');
$('#searchTab').innerHTML=icon('search');$('.search-mark').innerHTML=icon('search');$('.editor-avatar').innerHTML=icon('person');$('#endCall').innerHTML=icon('end');
$$('.tab').forEach(b=>b.querySelector('.tab-glyph').innerHTML=icon(b.dataset.tab==='dialer'?'keypad':b.dataset.tab));

/** Width determines the scale of components. Height determines their spacing/anchors.
 * No transformed 428x926 screenshot, no DPR multiplier, no absolute source-pixel crops. */
function layout(){
 const css=getComputedStyle(document.documentElement),top=parseFloat(css.getPropertyValue('--safe-top'))||0,bottom=parseFloat(css.getPropertyValue('--safe-bottom'))||0;
 const w=phone.clientWidth,h=phone.clientHeight,landscape=w>h&&h<600;
 const u=Math.min(w/428,1.14),navH=62*u,navBottom=Math.max(14,bottom-14);
 const navTop=h-navBottom-navH;
 let k=Math.min(u,Math.max(.52,(navTop-top-151*u)/591));
 if(landscape)k=Math.min(.60,(h-24)/523);
 const key=88*k;
 for(const [name,value]of Object.entries({'--u':u,'--key':key+'px','--gx':24*k+'px','--gy':20.3*k+'px','--nav-height':navH+'px','--nav-bottom':navBottom+'px','--nav-margin':21*u+'px','--pad-bottom':(navBottom+navH+68*k)+'px','--call-gap':26*k+'px','--number-top':(top+33*u)+'px'}))phone.style.setProperty(name,String(value));
 fitNumber();
}
let raf=0;function queueLayout(){cancelAnimationFrame(raf);raf=requestAnimationFrame(layout)}
addEventListener('resize',queueLayout);new ResizeObserver(queueLayout).observe(phone);
window.visualViewport?.addEventListener('resize',()=>{
 // Keep the settings input and Apply reachable above the software keyboard.
 const vv=window.visualViewport;
 $$('.modal[open]').forEach(d=>{d.style.maxHeight=Math.max(160,vv.height-24)+'px';d.style.bottom=Math.max(0,innerHeight-vv.height-vv.offsetTop)+'px';});
});
function fitNumber(){const n=$('#number'),u=Math.min(phone.clientWidth/428,1.14);let size=38*u;n.style.fontSize=size+'px';while(n.scrollWidth>n.clientWidth+.5&&size>17){size-=.5;n.style.fontSize=size+'px';}}
function toast(msg){$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,2800)}
function message(title,text,confirm=false){return new Promise(resolve=>{const d=$('#message');if(d.open)d.close('cancel');$('#messageTitle').textContent=title;$('#messageText').textContent=text;$('#messageButtons').innerHTML=(confirm?'<button value="cancel">Отменить</button>':'')+'<button value="ok">'+(confirm?'Продолжить':'Понятно')+'</button>';d.addEventListener('close',()=>resolve(d.returnValue==='ok'),{once:true});d.showModal();});}
const error=err=>message('Не получилось',err?.message||'Попробуйте ещё раз.');
function showTab(tab){if(state.call)return;state.tab=tab;$('#detail').hidden=true;for(const id of ['dialer','calls','contacts','search'])$('#'+id).hidden=id!==tab;$$('[data-tab]').forEach(b=>{const selected=b.dataset.tab===tab;b.classList.toggle('selected',selected);if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});if(tab==='calls')renderCalls();if(tab==='contacts')renderContacts();if(tab==='search')renderSearch();$('#nav').hidden=false;}
$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
 if(b.dataset.tab==='search'){
  const now=performance.now();secretTaps=secretTaps.filter(t=>now-t<2000);secretTaps.push(now);
  if(secretTaps.length===1)returnAfterSettings=state.tab;
  if(secretTaps.length>=5){secretTaps=[];openSettings();return;}
 }else secretTaps=[];
 showTab(b.dataset.tab);
}));
function drawNumber(){
 $('#number').textContent=formatPhone(state.raw);$('#delete').hidden=!state.raw;$('#addContact').hidden=!digits(state.raw);
 const hits=digits(state.raw).length>=3?state.contacts.filter(c=>matchContact(c,state.raw)):[];
 const s=$('#suggestion');s.hidden=!hits.length;
 if(hits.length){const c=hits[0],p=c.phones.find(p=>digits(p.value).includes(digits(state.raw)))||c.phones[0];
  s.innerHTML=`<button data-suggest-contact="${esc(c.id)}">${icon('contacts')}<span class="suggest-name">${esc(c.name)}</span><span class="suggest-number">${esc(formatPhone(p?.value||''))}</span></button><button data-suggest-search>${icon('search')}<span class="more">${hits.length>1?'Еще '+(hits.length-1)+' результатов':'Показать контакт'}</span></button>`;
 }fitNumber();
}
$('#suggestion').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.suggestContact)openContact(b.dataset.suggestContact);else{$('#searchInput').value=state.raw;showTab('search')}});
function append(key){if(state.raw.length<24){state.raw+=key;drawNumber()}}
function erase(){state.raw=state.raw.slice(0,-1);drawNumber()}
const KEYS=['1','2','3','4','5','6','7','8','9','*','0','#'];
for(const pad of [$('#keys'),$('#inCallKeys .keys')])pad.innerHTML=KEYS.map(k=>`<button class="key" data-key="${k}" aria-label="${k==='*'?'Звёздочка':k==='#'?'Решётка':k}">${icon('key-'+(k==='*'?'star':k==='#'?'hash':k))}</button>`).join('');

class Tones{
 constructor(){this.ctx=null;this.stopper=null;this.ringing=0;}
 stop(){this.stopper?.();this.stopper=null;}
 start(key){this.stop();if(!state.settings.sound)return;
 const map={'1':[697,1209],'2':[697,1336],'3':[697,1477],'4':[770,1209],'5':[770,1336],'6':[770,1477],'7':[852,1209],'8':[852,1336],'9':[852,1477],'*':[941,1209],'0':[941,1336],'#':[941,1477],ring:[425]};
 if(!map[key])return;
 try{this.ctx??=new (window.AudioContext||window.webkitAudioContext)();const ctx=this.ctx;let cancelled=false,nodes=[];const gain=ctx.createGain();gain.gain.value=.0001;gain.connect(ctx.destination);
 this.stopper=()=>{cancelled=true;try{gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(.0001,ctx.currentTime,.004);for(const n of nodes)n.stop(ctx.currentTime+.035);setTimeout(()=>gain.disconnect(),65);}catch{}};
 Promise.resolve(ctx.resume()).then(()=>{if(cancelled)return;gain.gain.setTargetAtTime(key==='ring'?.02:.038,ctx.currentTime,.005);nodes=map[key].map(f=>{const n=ctx.createOscillator();n.frequency.value=f;n.connect(gain);n.start();return n;});}).catch(()=>{});
 }catch{}}
 ring(){this.stopRing();const pulse=()=>{this.start('ring');setTimeout(()=>{if(this.ringing)this.stop()},900)};this.ringing=setInterval(pulse,4000);pulse()}
 stopRing(){clearInterval(this.ringing);this.ringing=0;this.stop();}
}
const tones=new Tones();let press=null;const pointerTimes=new WeakMap();
function cancelPress(){if(!press)return;clearTimeout(press.timer);clearInterval(press.repeat);press.el.classList.remove('pressed');tones.stop();press=null;}
function pressDown(e){
 const el=e.target.closest('.key,#delete');if(!el||el.hidden||press||e.isPrimary===false||e.button>0)return;
 e.preventDefault();pointerTimes.set(el,performance.now());const key=el.dataset.key,isCall=!!el.closest('#inCallKeys');
 press={id:e.pointerId,el,timer:0,repeat:0};const p=press;
 el.setPointerCapture?.(e.pointerId);el.classList.add('pressed');
 if(el.id==='delete'){erase();p.timer=setTimeout(()=>{p.repeat=setInterval(erase,85)},420);return;}
 const previous=state.raw;tones.start(key);
 if(isCall){state.call?.connection?.sendDigits(key);return;}
 append(key);
 if(['0','*','#'].includes(key))p.timer=setTimeout(()=>{if(press!==p)return;if(key==='0'&&previous)return;state.raw=previous+(key==='0'?'+':key==='*'?',':';');drawNumber();},500);
}
phone.addEventListener('pointerdown',pressDown);
phone.addEventListener('pointermove',e=>{if(!press||press.id!==e.pointerId)return;const r=press.el.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)cancelPress()});
phone.addEventListener('pointerup',e=>{if(press?.id===e.pointerId)cancelPress()});phone.addEventListener('pointercancel',cancelPress);phone.addEventListener('lostpointercapture',cancelPress);
phone.addEventListener('click',e=>{const b=e.target.closest('.key,#delete');if(!b)return;e.preventDefault();if(e.detail!==0||e.pointerType||performance.now()-(pointerTimes.get(b)??-Infinity)<1200)return;if(b.id==='delete')erase();else if(b.closest('#inCallKeys'))state.call?.connection?.sendDigits(b.dataset.key);else append(b.dataset.key);});
phone.addEventListener('contextmenu',e=>{if(e.target.closest('.key,.call,#delete'))e.preventDefault()});
addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select')||$('dialog[open]'))return;
 const keyButton=e.target.closest('.key,#delete');
 if(keyButton&&(e.key==='Enter'||e.key===' ')){
  e.preventDefault();if(e.repeat)return;
  if(keyButton.id==='delete')erase();
  else if(keyButton.closest('#inCallKeys'))state.call?.connection?.sendDigits(keyButton.dataset.key);
  else append(keyButton.dataset.key);
  return;
 }
 if(e.key==='Escape'){if(!$('#detail').hidden){$('#detail').hidden=true;showTab(state.returnTab)}return;}
 if(state.tab!=='dialer'||state.call||e.ctrlKey||e.metaKey||e.altKey)return;
 if(/^[0-9*#]$/.test(e.key)){e.preventDefault();append(e.key)}else if(e.key==='+'){e.preventDefault();if(!state.raw)append('+')}else if(e.key==='Backspace'){e.preventDefault();erase()}else if(e.key==='Enter'){e.preventDefault();startCall(state.raw)};
});
addEventListener('paste',e=>{if(e.target.matches('input,textarea')||state.tab!=='dialer'||state.call)return;const s=cleanPhone(e.clipboardData?.getData('text')||'');if(s){e.preventDefault();state.raw=(state.raw+s).slice(0,24);drawNumber()}});

const initials=c=>c.name.split(/\s+/).slice(0,2).map(n=>n[0]).join('').toLocaleUpperCase('ru');
const avatar=c=>`<span class="avatar">${c?.photo?'<img src="'+esc(c.photo)+'" alt="">':c?esc(initials(c)):icon('person')}</span>`;
const findByNumber=n=>state.contacts.find(c=>c.phones.some(p=>digits(p.value)===digits(n)));
const dateText=t=>{const d=new Date(t),today=new Date();if(d.toDateString()===today.toDateString())return d.toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'});const yesterday=new Date();yesterday.setDate(today.getDate()-1);if(d.toDateString()===yesterday.toDateString())return 'Вчера';return d.toLocaleDateString('ru',{day:'2-digit',month:'2-digit'});};
function recentRows(items){return items.map(r=>{const c=findByNumber(r.number),name=c?.name||r.name||formatPhone(r.number);return `<div class="list-row ${r.status==='missed'?'missed':''}">${state.editing?'<button class="delete-recent" data-remove-recent="'+esc(r.id)+'" aria-label="Удалить вызов">−</button>':''}<button class="row-main" data-recent="${esc(r.id)}">${avatar(c)}<span class="row-body"><span class="row-name">${esc(name)}</span><span class="row-sub">${r.direction==='incoming'?'↙':'↗'} сотовый</span></span></button><span class="row-time">${esc(dateText(r.at))}</span><button class="row-call" data-redial="${esc(r.id)}" aria-label="Позвонить ${esc(name)}">${icon('handset')}</button></div>`;}).join('');}
function empty(glyph,title,text,button=''){return `<div class="empty">${icon(glyph)}<strong>${esc(title)}</strong><p>${esc(text)}</p>${button}</div>`}
function renderCalls(){
 const favorites=state.contacts.filter(c=>c.favorite).slice(0,8),items=state.recents.filter(r=>state.filter==='all'||state.filter==='missed'&&r.status==='missed'||state.filter==='unknown'&&!findByNumber(r.number));
 $('#calls').innerHTML=`<header class="topbar"><button id="editCalls" class="glass">${state.editing?'Готово':'Править'}</button><h1>${state.filter==='missed'?'Пропущенные':'Вызовы'}</h1><button id="filterCalls" class="round" aria-label="Фильтр вызовов">${icon('filter')}</button></header>${favorites.length&&state.filter==='all'?'<div class="favorite-grid">'+favorites.map(c=>`<button class="favorite-card" data-contact="${esc(c.id)}">${avatar(c)}<small>↗ ${esc(c.first||c.name.split(' ')[0])}</small></button>`).join('')+'</div>':''}<h2 class="section-title">Недавние</h2><div>${items.length?recentRows(items.slice(0,state.limit)):empty('calls','Нет вызовов','Здесь появятся вызовы, выполненные в этом приложении.')}</div>${items.length>state.limit?'<button class="text-button load-more" data-more>Показать ещё</button>':''}`;
}
function contactList(items){const sorted=[...items].sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'})),groups=new Map();
 for(const c of sorted.slice(0,state.limit)){const ch=c.name[0]?.toLocaleUpperCase('ru')||'#',letter=/[A-ZА-ЯЁ]/.test(ch)?ch:'#';if(!groups.has(letter))groups.set(letter,[]);groups.get(letter).push(c)}
 return [...groups].map(([letter,cs])=>`<section class="contact-group" id="letter-${letter}"><h2>${esc(letter)}</h2>${cs.map(c=>`<button class="contact-row" data-contact="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</section>`).join('')+(items.length>state.limit?'<button class="text-button load-more" data-more>Показать ещё</button>':'');}
function renderContacts(){const all=state.contacts;
 $('#contacts').innerHTML=`<header class="topbar"><button id="contactLists" class="text-button">Списки</button><span></span><button data-new-contact class="round" aria-label="Новый контакт">${icon('plus')}</button></header><div class="large-heading"><h1>Контакты</h1></div>${state.settings.myName?`<button class="my-card" id="myCard">${avatar({name:state.settings.myName})}<span><strong>${esc(state.settings.myName)}</strong><span class="row-sub">Моя карточка</span></span></button>`:''}${all.length?contactList(all):empty('contacts','Нет контактов','Добавьте контакт или импортируйте свою телефонную книгу.','<button id="emptyImport" class="text-button">Импортировать .vcf</button>')}<div class="contact-count">${all.length?all.length+' контактов':''}</div>${all.length?'<aside class="alphabet" aria-label="Алфавит">'+[...new Set([...all].sort((a,b)=>a.name.localeCompare(b.name,'ru')).slice(0,state.limit).map(c=>c.name[0]?.toLocaleUpperCase('ru')).filter(c=>/[A-ZА-ЯЁ]/.test(c)))].map(l=>'<button data-letter="'+esc(l)+'">'+esc(l)+'</button>').join('')+'</aside>':''}`;
}
function renderSearch(){const q=$('#searchInput').value.trim();if(!q){$('#searchResults').innerHTML=empty('search','Поиск','Контакты и вызовы по имени или номеру.');return}
 const contacts=state.contacts.filter(c=>matchContact(c,q)).slice(0,100),recents=state.recents.filter(r=>fold((findByNumber(r.number)?.name||r.name)+' '+r.number).includes(fold(q))||(digits(q)&&digits(r.number).includes(digits(q)))).slice(0,100);
 $('#searchResults').innerHTML=(contacts.length?'<h2 class="page-search-heading">КОНТАКТЫ</h2>'+contacts.map(c=>`<button class="contact-row" data-contact="${esc(c.id)}">${esc(c.name)}</button>`).join(''):'')+(recents.length?'<h2 class="page-search-heading">ВЫЗОВЫ</h2>'+recentRows(recents):'')||empty('search','Ничего не найдено','Попробуйте другое имя или номер.');
}
$('#searchInput').addEventListener('input',renderSearch);
let editorContact=null;
function phoneField(p={label:'сотовый',value:''}){return `<label class="field">${esc(p.label||'телефон')}<input name="phone" type="tel" inputmode="tel" autocomplete="off" data-label="${esc(p.label||'сотовый')}" value="${esc(p.value)}" placeholder="Номер телефона"></label>`;}
function editContact(c=null,number=''){
 editorContact=c;const f=$('#contactForm');f.reset();$('#editorTitle').textContent=c?'Изменить контакт':'Новый контакт';
 f.elements.first.value=c?.first||(!c?.last?c?.name:'')||'';f.elements.last.value=c?.last||'';f.elements.company.value=c?.company||'';f.elements.email.value=c?.emails?.[0]||'';
 $('#phoneFields').innerHTML=(c?.phones.length?c.phones:[{label:'сотовый',value:number}]).map(phoneField).join('');$('#deleteContact').hidden=!c;$('#editor').showModal();
}
function openContact(id){const c=state.contacts.find(c=>c.id===id);if(!c)return;state.contact=id;state.returnTab=state.tab;$('#detail').hidden=false;nav.hidden=true;
 $('#detail').innerHTML=`<header class="topbar"><button data-back-detail class="text-button">‹ Назад</button><button id="editContact" class="text-button">Править</button></header><div class="contact-hero">${avatar(c)}<h1>${esc(c.name)}</h1>${c.company?'<p>'+esc(c.company)+'</p>':''}</div><div class="contact-actions">${[['message','сообщение'],['handset','вызов'],['video','видео'],['mail','почта']].map(([i,t])=>`<button class="contact-action ${i==='handset'?'':'dim'}" data-contact-action="${i}">${icon(i)}<span>${t}</span></button>`).join('')}</div><div class="group">${c.phones.map((p,i)=>`<div class="detail-field"><small>${esc(p.label)}</small><button data-phone-index="${i}">${esc(formatPhone(p.value))}</button></div>`).join('')}${c.emails.map(e=>`<div class="detail-field"><small>электронная почта</small><button data-copy-email="${esc(e)}">${esc(e)}</button></div>`).join('')}</div><div class="group"><button id="toggleFavorite" class="row-action">${c.favorite?'Удалить из избранного':'Добавить в избранное'} ${icon('star')}</button></div>`;
 $('#toggleFavorite svg').style.width='19px';$('#toggleFavorite svg').style.height='19px';
}
function openRecent(id){const r=state.recents.find(x=>x.id===id);if(!r)return;const c=findByNumber(r.number);if(c){openContact(c.id);return}
 state.returnTab=state.tab;state.contact=null;$('#detail').hidden=false;nav.hidden=true;
 $('#detail').innerHTML=`<header class="topbar"><button data-back-detail class="text-button">‹ Назад</button></header><div class="contact-hero">${avatar(null)}<h1>${esc(formatPhone(r.number))}</h1></div><div class="group"><button class="row-action" data-redial="${esc(r.id)}">Позвонить</button><button class="row-action" data-new-number="${esc(r.number)}">Создать контакт</button></div><div class="detail-field"><small>${new Date(r.at).toLocaleString('ru')}</small><div class="call-detail-status">${r.direction==='incoming'?'Входящий':'Исходящий'} вызов</div><div class="call-detail-status">${r.status==='answered'?r.duration+' с':r.status==='failed'?'Не удалось соединиться':'Не отвечен'}</div></div>`;
}
phone.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{
 if(b.hasAttribute('data-new-contact'))editContact();
 if(b.dataset.contact)openContact(b.dataset.contact);
 if(b.dataset.recent)openRecent(b.dataset.recent);
 if(b.dataset.redial){const r=state.recents.find(r=>r.id===b.dataset.redial);if(r)startCall(r.number);}
 if(b.dataset.removeRecent){await store.remove('recents',b.dataset.removeRecent);state.recents=state.recents.filter(r=>r.id!==b.dataset.removeRecent);renderCalls();}
 if(b.hasAttribute('data-back-detail')){showTab(state.returnTab);}
 if(b.dataset.newNumber)editContact(null,b.dataset.newNumber);
 if(b.dataset.letter){$('#letter-'+CSS.escape(b.dataset.letter))?.scrollIntoView({block:'start'});}
 if(b.hasAttribute('data-more')){state.limit+=500;showTab(state.tab);}
 if(b.id==='editCalls'){state.editing=!state.editing;renderCalls();}
 if(b.id==='filterCalls'){
  const d=$('#message');$('#messageTitle').textContent='Фильтр вызовов';$('#messageText').textContent='История этого приложения';$('#messageButtons').innerHTML=[['all','Все вызовы'],['missed','Пропущенные'],['unknown','Неизвестные абоненты']].map(([v,t])=>'<button value="'+v+'">'+t+'</button>').join('')+'<button value="cancel">Отмена</button>';
  d.addEventListener('close',()=>{if(['all','missed','unknown'].includes(d.returnValue)){state.filter=d.returnValue;renderCalls();}},{once:true});d.showModal();
 }
 if(b.id==='contactLists'){await message('Все контакты',`${state.contacts.length} контактов в локальной базе MC Call. Импорт .vcf — в скрытых настройках. Системная телефонная книга iOS не изменяется.`);}
 if(b.id==='emptyImport')$('#fileVCF').click();
 if(b.id==='editContact')editContact(state.contacts.find(c=>c.id===state.contact));
 if(b.id==='toggleFavorite'){const c=state.contacts.find(c=>c.id===state.contact);const next={...c,favorite:!c.favorite};await store.set('contacts',[next]);state.contacts=state.contacts.map(c=>c.id===next.id?next:c);openContact(next.id);}
 if(b.dataset.phoneIndex!==undefined){const c=state.contacts.find(c=>c.id===state.contact);if(c)startCall(c.phones[Number(b.dataset.phoneIndex)]?.value);}
 if(b.dataset.contactAction==='handset'){const c=state.contacts.find(c=>c.id===state.contact);if(c?.phones[0])startCall(c.phones[0].value);else message('Нет номера','Добавьте номер в карточку контакта.');}
 else if(b.dataset.contactAction)message('Не подключено','SMS, FaceTime и почта не входят в эту сценическую PWA. Эта кнопка не отправляет сообщения и не открывает другое приложение.');
 if(b.dataset.copyEmail){await navigator.clipboard.writeText(b.dataset.copyEmail);toast('Адрес скопирован');}
 }catch(err){error(err)}});
$('#addContact').onclick=()=>editContact(null,state.raw);
$('#addPhoneField').onclick=()=>{if($$('#phoneFields input').length<20)$('#phoneFields').insertAdjacentHTML('beforeend',phoneField())};
$('#contactForm').onsubmit=async e=>{e.preventDefault();try{const f=e.target,first=f.elements.first.value.trim(),last=f.elements.last.value.trim();
 const next=normalContact({...editorContact,id:editorContact?.id||uid(),first,last,name:[first,last].filter(Boolean).join(' '),company:f.elements.company.value,phones:$$('#phoneFields input').map(i=>({label:i.dataset.label,value:i.value})),emails:[f.elements.email.value,...(editorContact?.emails?.slice(1)||[])].filter(Boolean)});
 await store.set('contacts',[next]);state.contacts=state.contacts.filter(c=>c.id!==next.id).concat(next);$('#editor').close();if(!$('#detail').hidden)openContact(next.id);else showTab('contacts');drawNumber();
 }catch(err){error(err)}};
$('#deleteContact').onclick=async()=>{if(!editorContact||!await message('Удалить контакт?','Будет удалена только локальная копия в MC Call.',true))return;try{await store.remove('contacts',editorContact.id);state.contacts=state.contacts.filter(c=>c.id!==editorContact.id);$('#editor').close();showTab('contacts');drawNumber()}catch(err){error(err)}};
$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());

function updateModeFields(){const live=$('#mode').value==='live';$('#liveSettings').hidden=!live;$('#modeNotice').textContent=live?'Настоящий звонок потребует интернета и микрофона. Разговор и фактический номер проходят через VoIP-провайдера.':'Репетиция: реальное соединение не устанавливается, речь собеседника не воспроизводится.';}
function openSettings(){cancelPress();$('#force').value=state.settings.force;$('#mode').value=state.settings.mode;$('#sounds').checked=state.settings.sound;$('#delay').value=String(state.settings.answerDelay);$('#backend').value=state.settings.backend;$('#operatorKey').value=state.operatorKey;updateModeFields();$('#storageInfo').textContent=`Контактов: ${state.contacts.length}. Вызовов: ${state.recents.length}. Резервное копирование — вручную.`;$('#settings').showModal();}
$('#mode').onchange=updateModeFields;
$('#settingsForm').onsubmit=async e=>{e.preventDefault();try{const force=cleanPhone($('#force').value),mode=$('#mode').value,backend=$('#backend').value.trim().replace(/\/$/,'');
 if(force&&!validTarget(force))throw Error('Введите номер с + и кодом страны, от 8 до 15 цифр.');
 if(mode==='live'){if(!validTarget(force))throw Error('Укажите фактический номер.');const u=new URL(backend);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Нужен HTTPS-адрес backend без пути и пароля.');if(!$('#operatorKey').value.trim())throw Error('Введите ключ доступа исполнителя.');}
 const next={...state.settings,force,mode,backend,sound:$('#sounds').checked,answerDelay:Number($('#delay').value)};
 await store.set('settings',[{id:'main',...next}]);state.settings=next;state.operatorKey=$('#operatorKey').value.trim();$('#settings').close();showTab(returnAfterSettings);toast('Настройки сохранены');
 }catch(err){error(err)}};
$('#checkBackend').onclick=async()=>{try{const endpoint=$('#backend').value.trim().replace(/\/$/,''),u=new URL(endpoint);if(u.protocol!=='https:')throw Error('Нужен HTTPS');const r=await fetch(endpoint+'/api/health',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Backend не отвечает: '+r.status);const j=await r.json();if(j.service!=='mc-call-voice')throw Error('Это не голосовой backend MC Call');message('Backend доступен',j.configured?'Сервер настроен. Это ещё не проверка реального соединения или тарифа.':'Сервер запущен, но переменные телефонии ещё не заполнены.');}catch(err){error(err)}};
$('#importVCF').onclick=()=>$('#fileVCF').click();$('#importBackup').onclick=()=>$('#fileBackup').click();
$('#fileVCF').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>20*1024*1024)throw Error('Максимальный размер .vcf — 20 МБ');
 const parsed=parseVCF(await file.text()),merged=mergeContacts(state.contacts,parsed.contacts);
 if(!await message('Импорт контактов',`Найдено: ${parsed.contacts.length}. Новых: ${merged.added}. Повторов: ${merged.duplicates}. ${parsed.warnings.length?'Пропущено: '+parsed.warnings.length+'. ':''}Файл обрабатывается только на этом устройстве.`,true))return;
 await store.set('contacts',merged.contacts,true);state.contacts=merged.contacts;$('#settings').close();state.limit=500;showTab('contacts');drawNumber();toast(`Добавлено контактов: ${merged.added}`);
 }catch(err){error(err)}};
$('#exportBackup').onclick=async()=>{if(!await message('Резервная копия','В файл попадут контакты, локальная история и фактический номер. Файл не зашифрован. Храните его в защищённом месте.',true))return;
 try{const {backend,mode,...safe}=state.settings;const data={format:'mc-call-backup',schema:1,createdAt:new Date().toISOString(),contacts:state.contacts,recents:state.recents,settings:{...safe,mode:'demo'}};const blob=new Blob([JSON.stringify(data)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='MC-Call-'+new Date().toISOString().slice(0,10)+'.mcphone';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Резервная копия подготовлена')}catch(err){error(err)}};
$('#fileBackup').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>30*1024*1024)throw Error('Копия должна быть меньше 30 МБ');const data=validateBackup(JSON.parse(await file.text()));if(!await message('Восстановить копию?',`Текущая локальная база будет заменена. В копии ${data.contacts.length} контактов и ${data.recents.length} вызовов. Режим будет сброшен на репетицию.`,true))return;
 await store.write({contacts:data.contacts,recents:data.recents,settings:[{id:'main',...data.settings}]},true);state.contacts=data.contacts;state.recents=data.recents.sort((a,b)=>b.at-a.at);state.settings=data.settings;state.operatorKey='';$('#settings').close();showTab('dialer');drawNumber();toast('Копия восстановлена');}catch(err){error(err)}};
$('#requestPersistence').onclick=async()=>{try{const saved=await navigator.storage?.persist?.(),e=await navigator.storage?.estimate?.();message('Локальное хранилище',`${saved?'Постоянное хранение предоставлено.':'Браузер не гарантирует постоянное хранение.'} Использовано сайтом: ${e?Math.round(e.usage/1024)+' КБ':'неизвестно'}. Очистка данных сайта всё равно удаляет базу — сохраняйте резервную копию.`);}catch(err){error(err)}};
$('#clearHistory').onclick=async()=>{if(await message('Очистить историю?','Будут удалены только вызовы MC Call. История системного «Телефона» не меняется.',true)){try{await store.set('recents',[],true);state.recents=[];toast('История очищена')}catch(err){error(err)}}};
$('#clearContacts').onclick=async()=>{if(await message('Удалить контакты?','Удалится локальная копия телефонной книги в MC Call, без изменения системных контактов.',true)){try{await store.set('contacts',[],true);state.contacts=[];drawNumber();toast('Локальные контакты удалены')}catch(err){error(err)}}};

const actions=[['speaker','динамик'],['video','FaceTime'],['mic','выкл. звук'],['plus','добавить'],['keypad','клавиши'],['more','ещё']];
$('#callActions').innerHTML=actions.map(([id,title])=>`<button class="call-action" data-call-action="${id}" aria-pressed="false"><span class="bubble">${icon(id)}</span><span>${title}</span></button>`).join('');
function callStatus(text){$('#callStatus').textContent=text}
async function keepAwake(){try{wakeLock=await navigator.wakeLock?.request('screen')}catch{}}
function connected(call){if(state.call!==call||call.connectedAt)return;call.connectedAt=Date.now();tones.stopRing();callStatus('00:00');call.clock=setInterval(()=>{if(state.call!==call)return;const s=Math.floor((Date.now()-call.connectedAt)/1000);callStatus(String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'))},250);}
async function startCall(value){
 if(!state.ready){message('Хранилище недоступно','Сначала разрешите локальное хранение и перезапустите приложение.');return}if(state.call)return;
 const number=cleanPhone(value);if(!digits(number)){if(!state.raw&&state.recents[0]){state.raw=state.recents[0].number;drawNumber()}return;}
 const real=state.settings.mode==='live';
 if(real&&(!state.settings.force||!state.settings.backend||!state.operatorKey)){openSettings();message('Телефония не настроена','Укажите backend, фактический номер и ключ доступа. Без этого реальный звонок не выполняется.');return;}
 const contact=findByNumber(number),call={id:uid(),number,name:contact?.name||'',at:Date.now(),connectedAt:0,clock:0,timer:0,connection:null,device:null,abort:new AbortController(),transport:real?'live':'demo'};state.call=call;
 cancelPress();$('#detail').hidden=true;nav.hidden=true;$('#callScreen').hidden=false;$('#callName').textContent=contact?.name||formatPhone(number);callStatus('вызов…');$('#inCallKeys').hidden=true;$('#callActions').hidden=false;$$('[data-call-action]').forEach(b=>{b.classList.remove('on');b.setAttribute('aria-pressed','false')});keepAwake();
 if(!real){tones.ring();call.timer=setTimeout(()=>connected(call),state.settings.answerDelay*1000);return;}
 try{
  // Only the prepared target is transmitted. The spectator's number, names and address book are not sent.
  const base=state.settings.backend;
  const timeout=setTimeout(()=>call.abort.abort(),15000);
  let response;try{response=await fetch(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+state.operatorKey},body:JSON.stringify({target:state.settings.force}),signal:call.abort.signal,cache:'no-store'});}finally{clearTimeout(timeout)}
  if(!response.ok)throw Error('Телефония: сервер отклонил запрос ('+response.status+').');const session=await response.json();
  if(state.call!==call)return;
  // The optional backend build serves the official bundled Twilio SDK at this URL.
  const {Device}=await import(base+'/sdk.js');if(state.call!==call)return;
  call.device=new Device(session.token,{logLevel:0,codecPreferences:['opus','pcmu'],enableImprovedSignalingErrorPrecision:true});
  call.device.on('error',async()=>{if(state.call===call){await finishCall('failed');message('Ошибка связи','Проверьте интернет, разрешение микрофона и настройку провайдера.');}});
  const connection=await call.device.connect({params:{ticket:session.ticket}});
  if(state.call!==call){connection.disconnect();return;}call.connection=connection;
  connection.on('ringing',()=>{if(state.call===call)callStatus('вызов…')});
  connection.on('accept',()=>connected(call));connection.on('disconnect',()=>{if(state.call===call)finishCall()});connection.on('cancel',()=>{if(state.call===call)finishCall('cancelled')});connection.on('error',()=>{if(state.call===call){finishCall('failed');message('Вызов не состоялся','Реальный режим не переключается на имитацию при ошибке.')}});
  if(connection.status()==='open')connected(call);
 }catch(err){if(state.call!==call)return;await finishCall('failed');error(err)}
}
async function finishCall(status){const c=state.call;if(!c)return;state.call=null;c.abort.abort();clearInterval(c.clock);clearTimeout(c.timer);tones.stopRing();try{c.connection?.disconnect();c.device?.destroy();wakeLock?.release()}catch{}wakeLock=null;
 $('#callScreen').hidden=true;$('#inCallKeys').hidden=true;showTab(state.tab);
 const recent={id:c.id,number:c.number,name:c.name,at:c.at,duration:c.connectedAt?Math.floor((Date.now()-c.connectedAt)/1000):0,status:status||(c.connectedAt?'answered':'cancelled'),direction:'outgoing',transport:c.transport};
 try{await store.set('recents',[recent]);state.recents.unshift(recent);if(state.tab==='calls')renderCalls();}catch(err){error(err)}
}
$('#call').onclick=()=>startCall(state.raw);$('#endCall').onclick=()=>finishCall();
$('#callActions').onclick=async e=>{const b=e.target.closest('[data-call-action]');if(!b||!state.call)return;const kind=b.dataset.callAction;
 if(kind==='keypad'){$('#inCallKeys').hidden=false;$('#callActions').hidden=true;return;}
 if(kind==='mic'){const on=!b.classList.contains('on');state.call.connection?.mute(on);b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));return;}
 if(kind==='speaker'){
  // Browser audio routing cannot be truthfully represented as a native SIM speaker switch.
  if(state.call.transport==='demo'){const on=!b.classList.contains('on');b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));}
  else message('Аудиовыход iPhone','В PWA маршрут звука задают iOS и подключённые устройства. Используйте системный выбор аудиовыхода.');return;
 }
 message('Недоступно','Групповые вызовы, FaceTime и системные функции «Телефона» не подключены.');};
$('#hideInCallKeys').onclick=()=>{$('#inCallKeys').hidden=true;$('#callActions').hidden=false;tones.stop()};
document.addEventListener('visibilitychange',()=>{cancelPress();if(document.hidden){tones.stop();}else if(state.call){keepAwake();} });
addEventListener('pagehide',()=>{cancelPress();tones.stopRing();});

let registration=null;
async function checkUpdate(){if(!('serviceWorker'in navigator))throw Error('Service Worker недоступен');registration??=await navigator.serviceWorker.getRegistration(new URL('./',location.href));if(!registration)throw Error('Откройте приложение по HTTPS и перезапустите');await registration.update();if(registration.waiting){if(state.call)return;registration.waiting.postMessage({type:'ACTIVATE'});toast('Обновление готово. Закройте и откройте приложение.');}else toast('Проверка выполнена. Версия '+VERSION);}
$('#updateApp').onclick=()=>checkUpdate().catch(error);
async function init(){
 try{await store.open();const [contacts,recents,settings]=await Promise.all([store.all('contacts'),store.all('recents'),store.all('settings')]);state.contacts=contacts;state.recents=recents.sort((a,b)=>b.at-a.at);const saved=settings.find(s=>s.id==='main');state.settings={...DEFAULTS,...saved};
 if(!saved){let old='';try{old=localStorage.getItem('mccall.route')||''}catch{}if(validTarget(cleanPhone(old)))state.settings.force=cleanPhone(old);await store.set('settings',[{id:'main',...state.settings}]);}
 state.ready=true;document.documentElement.dataset.ready='true';drawNumber();layout();
 }catch(err){error(err)}
 if('serviceWorker'in navigator&&location.protocol!=='file:'){
  try{registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});await registration.update();}catch{toast('Офлайн-кэш пока недоступен');}
 }
}
layout();init();
