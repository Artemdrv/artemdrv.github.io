/** Local data layer. No network calls, analytics, or external contact/photo requests. */
export const VERSION = '4.0.0';
export const DB_NAME = 'mc-call-r4';
export const DEFAULTS = Object.freeze({force:'',mode:'demo',sound:true,backend:'',answerDelay:3,myName:'',sort:'first'});
export const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const cleanPhone = v => String(v??'').replace(/[^\d+*#,;]/g,'').slice(0,32);
export const digits = v => String(v??'').replace(/\D/g,'');
export const fold = v => String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ru').replace(/ё/g,'е');
export const validTarget = v => /^\+[1-9]\d{7,14}$/.test(v);
export const uid = () => globalThis.crypto?.randomUUID?.() || 'local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
export function formatPhone(value) {
 const raw=cleanPhone(value), d=digits(raw), prefix=raw.startsWith('+')?'+':'';
 if (/[*,;#]/.test(raw)||!d) return raw;
 if(d.startsWith('375')){
  let s=prefix+'375',r=d.slice(3);if(!r)return s;
  s+=' ('+r.slice(0,2)+(r.length>=2?')':'');r=r.slice(2);
  if(r)s+=' '+r.slice(0,3);if(r.length>3)s+='-'+r.slice(3,5);if(r.length>5)s+='-'+r.slice(5,7);if(r.length>7)s+=' '+r.slice(7);return s;
 }
 if(prefix&&d[0]==='7'&&d.length>1){const r=d.slice(1);return '+7 ('+r.slice(0,3)+(r.length>=3?')':'')+(r.length>3?' '+r.slice(3,6):'')+(r.length>6?'-'+r.slice(6,8):'')+(r.length>8?'-'+r.slice(8):'');}
 return raw;
}
const T9 = ['','','abcабвг','defдежз','ghiийкл','jklмноп','mnoрсту','pqrsфхцч','tuvшщъы','wxyzьэюя'];
export const t9 = v => [...fold(v)].map(c=>{const i=T9.findIndex(g=>g.includes(c));return i>=2?i:/\d/.test(c)?c:''}).join('');
export function matchContact(c,query){const q=fold(query).trim();if(!q)return true;
 const d=digits(q), words=q.split(/\s+/);const text=fold([c.name,c.company,...(c.emails||[])].join(' '));
 return words.every(w=>text.includes(w))||(d.length>0&&(c.phones.some(p=>digits(p.value).includes(d))||t9(c.name).includes(d)));
}
export function normalContact(c){
 if(!c||typeof c!=='object')throw Error('Некорректный контакт');
 const name=String(c.name??'').trim().slice(0,200);
 const phones=(Array.isArray(c.phones)?c.phones:[]).slice(0,20).map(p=>({label:String(p.label||'телефон').slice(0,40),value:cleanPhone(p.value)})).filter(p=>digits(p.value));
 if(!name&&!phones.length)throw Error('Пустой контакт');
 const photo=typeof c.photo==='string'&&c.photo.length<1500000&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(c.photo)?c.photo:'';
 return {id:String(c.id||uid()).slice(0,100),name:name||phones[0].value,first:String(c.first||'').slice(0,100),last:String(c.last||'').slice(0,100),company:String(c.company||'').slice(0,200),phones,emails:(Array.isArray(c.emails)?c.emails:[]).slice(0,10).map(x=>String(x).slice(0,254)),photo,favorite:!!c.favorite};
}
const unesc = v => v.replace(/\\([nN,;\\])/g,(_,c)=>/n/i.test(c)?'\n':c);
function splitEsc(v,separator){const out=[];let s='',escaped=false;for(const c of v){if(escaped){s+='\\'+c;escaped=false}else if(c==='\\')escaped=true;else if(c===separator){out.push(s);s=''}else s+=c}out.push(s);return out;}
function quotedPrintable(v,charset='utf-8'){
 const bytes=[];for(let i=0;i<v.length;i++){if(v[i]==='='&&/^[0-9a-f]{2}$/i.test(v.slice(i+1,i+3))){bytes.push(parseInt(v.slice(i+1,i+3),16));i+=2}else bytes.push(...new TextEncoder().encode(v[i]));}
 try{return new TextDecoder(charset).decode(new Uint8Array(bytes))}catch{return new TextDecoder().decode(new Uint8Array(bytes))}
}
/** vCard 2.1/3.0/4.0: folded lines, escaped fields, grouped labels, QP and embedded photos. */
export function parseVCF(text){
 if(typeof text!=='string'||text.length>20*1024*1024)throw Error('Файл должен быть меньше 20 МБ');
 const physical=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n'), logical=[];
 for(let i=0;i<physical.length;i++){
  let line=physical[i],qp=/ENCODING=QUOTED-PRINTABLE/i.test(line.split(':')[0]);
  while(i+1<physical.length){
   if(qp&&line.endsWith('=')){line=line.slice(0,-1)+physical[++i].replace(/^[ \t]/,'');}
   else if(/^[ \t]/.test(physical[i+1])){line+=physical[++i].slice(1);}
   else break;
  }
  logical.push(line);
 }
 const input=logical.join('\n');
 const blocks=input.match(/BEGIN:VCARD\n[\s\S]*?\nEND:VCARD/gi)||[];
 if(!blocks.length)throw Error('В файле не найдены карточки vCard');if(blocks.length>20000)throw Error('Максимум 20 000 контактов');
 const contacts=[],warnings=[];
 for(const block of blocks){
  const c={phones:[],emails:[]},labels={},pending=[];
  for(const line of block.split('\n')){
   const at=line.indexOf(':');if(at<0)continue;
   const head=line.slice(0,at),parts=head.split(';'),base=parts.shift().toUpperCase(),key=base.split('.').pop(),group=base.includes('.')?base.split('.')[0]:'';
   let value=line.slice(at+1);const charset=/CHARSET=([^;]+)/i.exec(head)?.[1]||'utf-8';
   if(/ENCODING=QUOTED-PRINTABLE/i.test(head))value=quotedPrintable(value,charset);
   if(key==='FN')c.name=unesc(value);
   if(key==='N'){const names=splitEsc(value,';').map(unesc);c.last=names[0]||'';c.first=names[1]||'';}
   if(key==='ORG')c.company=splitEsc(value,';').map(unesc).join(' ');
   if(key==='EMAIL')c.emails.push(unesc(value));
   if(key==='X-ABLABEL')labels[group]=unesc(value).replace(/_\$!<|>!\$_/g,'');
   if(key==='TEL'){
    const type=/CELL|IPHONE/i.test(head)?'сотовый':/HOME/i.test(head)?'домашний':/WORK/i.test(head)?'рабочий':'телефон';
    const p={value:cleanPhone(value.replace(/^tel:/i,'')),label:type};c.phones.push(p);pending.push([p,group]);
   }
   if(key==='PHOTO'){
    if(/^data:image\//i.test(value))c.photo=value;
    else if(/ENCODING=(?:b|base64)(?:;|$)/i.test(head)){
     const type=/PNG/i.test(head)?'png':/WEBP/i.test(head)?'webp':'jpeg';c.photo='data:image/'+type+';base64,'+value.replace(/\s/g,'');
    }
   }
  }
  for(const [p,g]of pending)if(labels[g])p.label=labels[g];
  if(!c.name)c.name=[c.first,c.last].filter(Boolean).join(' ')||c.company;
  try{contacts.push(normalContact(c))}catch{warnings.push('Пропущена пустая карточка')}
 }
 return {contacts,warnings};
}
export const fingerprint=c=>fold(c.name)+'|'+c.phones.map(p=>digits(p.value)).sort().join('|');
export function mergeContacts(existing,incoming){const map=new Map(existing.map(c=>[fingerprint(c),c]));let added=0,duplicates=0;
 for(const c of incoming){const k=fingerprint(c);if(map.has(k)){duplicates++;continue}map.set(k,c);added++}return {contacts:[...map.values()],added,duplicates};}
export function validateBackup(raw){
 if(!raw||raw.format!=='mc-call-backup'||raw.schema!==1||!Array.isArray(raw.contacts)||!Array.isArray(raw.recents)||raw.contacts.length>20000||raw.recents.length>10000)throw Error('Это не резервная копия MC Call');
 const contacts=raw.contacts.map(normalContact);if(new Set(contacts.map(c=>c.id)).size!==contacts.length)throw Error('В копии повторяются идентификаторы');
 const recents=raw.recents.map(r=>{if(!r||!Number.isFinite(r.at)||!digits(r.number))throw Error('Повреждена история');return {id:String(r.id||uid()).slice(0,100),number:cleanPhone(r.number),name:String(r.name||'').slice(0,200),at:r.at,duration:Math.max(0,Math.min(86400,Number(r.duration)||0)),direction:r.direction==='incoming'?'incoming':'outgoing',status:['answered','missed','cancelled','failed'].includes(r.status)?r.status:'cancelled',transport:r.transport==='live'?'live':'demo'};});
 const s=raw.settings||{};return {contacts,recents,settings:{...DEFAULTS,force:validTarget(cleanPhone(s.force))?cleanPhone(s.force):'',sound:s.sound!==false,myName:String(s.myName||'').slice(0,100),mode:'demo'}};
}
export class Store {
 constructor(){this.db=null;}
 async open(){if(this.db)return this;this.db=await new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{for(const name of ['contacts','recents','settings'])r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Закройте другие окна приложения'));});return this;}
 async all(name){await this.open();return new Promise((resolve,reject)=>{const r=this.db.transaction(name).objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async set(name,items,clear=false){return this.write({[name]:items},clear);}
 async write(groups,clear=false){await this.open();return new Promise((resolve,reject)=>{const tx=this.db.transaction(Object.keys(groups),'readwrite');tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||Error('Не удалось сохранить данные'));for(const [n,items]of Object.entries(groups)){const store=tx.objectStore(n);if(clear)store.clear();for(const i of items)store.put(i);}});}
 async remove(name,id){await this.open();return new Promise((resolve,reject)=>{const tx=this.db.transaction(name,'readwrite');tx.objectStore(name).delete(id);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error);});}
}
