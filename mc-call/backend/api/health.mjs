import {configured,response,cors} from '../lib/security.mjs';
export default function handler(req,res){if(!cors(req,res,process.env))return;response(res,200,{service:'mc-call-voice',configured:configured(process.env)});}
