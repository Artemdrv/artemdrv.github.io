import {configured,response,readBody,dialXML} from '../lib/security.mjs';
export default async function handler(req,res){const env=process.env;
 if(req.method!=='POST')return response(res,405,{error:'POST only'});
 if(!configured(env))return response(res,503,{error:'Voice not configured'});
 try{const params=await readBody(req,'form');const body=dialXML(env,params,req.headers['x-twilio-signature']);response(res,200,body,'text/xml');}
 catch{response(res,403,'<?xml version="1.0"?><Response><Hangup/></Response>','text/xml');}
}
