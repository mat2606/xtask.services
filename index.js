let jwksCache={at:0,keys:{}};
const enc=new TextEncoder();
const b64url=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
const jsonPart=s=>JSON.parse(new TextDecoder().decode(b64url(s)));

async function getJwks(){
  if(Date.now()-jwksCache.at<55*60*1000 && Object.keys(jwksCache.keys).length)return jwksCache.keys;
  const r=await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if(!r.ok)throw new Error('Não foi possível carregar chaves do Firebase.');
  const j=await r.json(); const keys={}; for(const k of j.keys||[]) if(k.kid)keys[k.kid]=k; jwksCache={at:Date.now(),keys}; return keys;
}
async function verifyFirebaseToken(token,projectId){
  const parts=String(token||'').split('.'); if(parts.length!==3)throw new Error('Token inválido.');
  const header=jsonPart(parts[0]),payload=jsonPart(parts[1]); if(header.alg!=='RS256'||!header.kid)throw new Error('Algoritmo/token inválido.');
  const keys=await getJwks(),jwk=keys[header.kid]; if(!jwk)throw new Error('Chave do token não encontrada.');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64url(parts[2]),enc.encode(parts[0]+'.'+parts[1])); if(!ok)throw new Error('Assinatura inválida.');
  const now=Math.floor(Date.now()/1000); if(payload.exp<=now||payload.iat>now+60)throw new Error('Token expirado/inválido.');
  if(payload.aud!==projectId||payload.iss!==`https://securetoken.google.com/${projectId}`||!payload.sub)throw new Error('Token não pertence ao projeto Firebase.');
  return payload;
}
function cors(origin,env){
  const allowed=String(env.ALLOWED_ORIGINS||'https://xtask.shop,https://www.xtask.shop').split(',').map(x=>x.trim()).filter(Boolean);
  const allow=allowed.includes(origin)?origin:allowed[0]||'';
  return {'Access-Control-Allow-Origin':allow,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
}
export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin')||''; const headers=cors(origin,env);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return new Response(JSON.stringify({ok:false,error:'Method not allowed'}),{status:405,headers});
    try{
      const allowed=String(env.ALLOWED_ORIGINS||'https://xtask.shop,https://www.xtask.shop').split(',').map(x=>x.trim()).filter(Boolean);
      if(origin && !allowed.includes(origin))throw new Error('Origem não autorizada.');
      const auth=request.headers.get('Authorization')||''; const token=auth.startsWith('Bearer ')?auth.slice(7):'';
      const claims=await verifyFirebaseToken(token,env.FIREBASE_PROJECT_ID||'portifoleo-817ad');
      const gh=await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`,{
        method:'POST',headers:{'Accept':'application/vnd.github+json','Authorization':`Bearer ${env.GITHUB_PAT}`,'X-GitHub-Api-Version':'2026-03-10','User-Agent':'xtask-ml-radar-trigger'},
        body:JSON.stringify({event_type:'ml_radar_scan',client_payload:{uid:claims.sub}})
      });
      if(gh.status!==204)throw new Error(`GitHub respondeu ${gh.status}: ${(await gh.text()).slice(0,180)}`);
      return new Response(JSON.stringify({ok:true,uid:claims.sub}),{status:200,headers});
    }catch(e){return new Response(JSON.stringify({ok:false,error:String(e.message||e)}),{status:401,headers});}
  }
};
