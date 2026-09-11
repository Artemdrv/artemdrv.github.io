import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
export const e164 = value => typeof value==='string'&&/^\+[1-9]\d{7,14}$/.test(value);
export function same(a,b){const aa=Buffer.from(String(a??'')),bb=Buffer.from(String(b??''));return aa.length===bb.length&&timingSafeEqual(aa,bb);}
const b64=object=>Buffer.from(JSON.stringify(object)).toString('base64url');
export function signToken(header,payload,secret){const message=b64(header)+'.'+b64(payload);return message+'.'+createHmac('sha256',secret).update(message).digest('base64url');}
export function issueSession(env,target,now=Math.floor(Date.now()/1000)){
 if(!env.MC_ALLOWED_NUMBERS.split(',').map(n=>n.trim()).includes(target)||!e164(target))throw Error('Target denied');
 const identity='mc_'+randomUUID().replaceAll('-','');
 const token=signToken({typ:'JWT',alg:'HS256',cty:'twilio-fpa;v=1'},
  {jti:env.TWILIO_API_KEY_SID+'-'+randomUUID(),iss:env.TWILIO_API_KEY_SID,sub:env.TWILIO_ACCOUNT_SID,iat:now,nbf:now-5,exp:now+120,grants:{identity,voice:{outgoing:{application_sid:env.TWILIO_APP_SID},incoming:{allow:false}}}},env.TWILIO_API_KEY_SECRET);
 const ticket=signToken({typ:'JWT',alg:'HS256'},{aud:'mc-call',target,identity,iat:now,exp:now+90,nonce:randomUUID()},env.MC_TICKET_SECRET);
 return {token,ticket,expiresAt:now+90};
}
export function readTicket(token,secret,now=Math.floor(Date.now()/1000)){
 if(typeof token!=='string'||token.length>3000)throw Error('Ticket denied');
 const parts=token.split('.');if(parts.length!==3)throw Error('Ticket denied');
 const expected=createHmac('sha256',secret).update(parts[0]+'.'+parts[1]).digest('base64url');if(!same(parts[2],expected))throw Error('Ticket denied');
 const header=JSON.parse(Buffer.from(parts[0],'base64url')),p=JSON.parse(Buffer.from(parts[1],'base64url'));
 if(header.alg!=='HS256'||p.aud!=='mc-call'||!Number.isFinite(p.exp)||!Number.isFinite(p.iat)||p.exp<now||p.iat>now+5||p.exp-p.iat>90||!e164(p.target)||!/^mc_[a-f0-9]{32}$/.test(p.identity))throw Error('Ticket denied');
 return p;
}
export function twilioSignature(authToken,url,params){
 const data=url+Object.keys(params).sort().map(key=>key+String(params[key])).join('');
 return createHmac('sha1',authToken).update(data).digest('base64');
}
export function verifyTwilio(env,signature,params){return same(signature,twilioSignature(env.TWILIO_AUTH_TOKEN,env.MC_PUBLIC_URL+'/api/voice',params));}
export const xml = v => String(v).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export function dialXML(env,params,signature,now){
 if(!verifyTwilio(env,signature,params)||params.AccountSid!==env.TWILIO_ACCOUNT_SID)throw Error('Signature denied');
 const t=readTicket(params.ticket,env.MC_TICKET_SECRET,now);
 if(params.From!=='client:'+t.identity||!env.MC_ALLOWED_NUMBERS.split(',').map(s=>s.trim()).includes(t.target))throw Error('Route denied');
 const limit=Math.min(300,Math.max(30,Number(env.MC_MAX_CALL_SECONDS)||180));
 return '<?xml version="1.0" encoding="UTF-8"?><Response><Dial answerOnBridge="true" timeout="30" timeLimit="'+limit+'" callerId="'+xml(env.TWILIO_CALLER_ID)+'"><Number>'+xml(t.target)+'</Number></Dial></Response>';
}
export function configured(env){
 return env.MC_ENABLED==='1'&&/^AC[0-9a-f]{32}$/i.test(env.TWILIO_ACCOUNT_SID||'')&&/^SK[0-9a-f]{32}$/i.test(env.TWILIO_API_KEY_SID||'')&&/^AP[0-9a-f]{32}$/i.test(env.TWILIO_APP_SID||'')&&
 ['TWILIO_API_KEY_SECRET','TWILIO_AUTH_TOKEN','MC_OPERATOR_KEY','MC_TICKET_SECRET'].every(k=>String(env[k]||'').length>=32)&&e164(env.TWILIO_CALLER_ID)&&!!env.MC_ALLOWED_NUMBERS&&env.MC_ALLOWED_NUMBERS.split(',').every(n=>e164(n.trim()))&&/^https:\/\/[^/]+$/.test(env.MC_ORIGIN||'')&&/^https:\/\/[^/]+$/.test(env.MC_PUBLIC_URL||'');
}
export function response(res,status,body,type='application/json'){res.statusCode=status;res.setHeader('Content-Type',type+'; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(type==='application/json'?JSON.stringify(body):body);}
export function cors(req,res,env){if(req.headers.origin!==env.MC_ORIGIN){response(res,403,{error:'Origin denied'});return false;}res.setHeader('Access-Control-Allow-Origin',env.MC_ORIGIN);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');res.setHeader('Access-Control-Allow-Methods','POST,GET,OPTIONS');if(req.method==='OPTIONS'){res.statusCode=204;res.end();return false;}return true;}
export async function readBody(req,type='json'){
 if(req.body&&typeof req.body==='object'&&!Buffer.isBuffer(req.body)){if(JSON.stringify(req.body).length>4096)throw Error('Body too large');return req.body;}
 let raw=req.body?String(req.body):'';
 if(!raw)for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw Error('Body too large');}
 if(raw.length>4096)throw Error('Body too large');
 if(type==='form'){const p=new URLSearchParams(raw);if(new Set(p.keys()).size!==[...p.keys()].length)throw Error('Duplicate parameters');return Object.fromEntries(p);}
 return JSON.parse(raw||'{}');
}
