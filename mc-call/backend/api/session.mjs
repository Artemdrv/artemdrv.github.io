import {configured,cors,response,readBody,same,issueSession} from '../lib/security.mjs';
// Warm-instance limit is only a secondary guard. Configure a provider-wide spend cap
// and durable/global rate limiting before exposing this beyond one performer.
const requests=[];
export default async function handler(req,res){const env=process.env;
 if(!cors(req,res,env))return;if(req.method!=='POST')return response(res,405,{error:'POST only'});
 if(!configured(env))return response(res,503,{error:'Voice not configured'});
 if(!same(req.headers.authorization,'Bearer '+env.MC_OPERATOR_KEY))return response(res,401,{error:'Unauthorized'});
 const now=Date.now();while(requests.length&&requests[0]<now-60000)requests.shift();if(requests.length>=5)return response(res,429,{error:'Try later'});requests.push(now);
 try{const body=await readBody(req);const result=issueSession(env,body.target);response(res,200,result);}catch{response(res,403,{error:'Target denied'});}
}
