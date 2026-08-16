const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DB = path.join(ROOT, 'data', 'db.json');
const PUBLIC = path.join(ROOT, 'public');
const sessions = new Map();

function readDb(){ return JSON.parse(fs.readFileSync(DB,'utf8')); }
function writeDb(db){ fs.writeFileSync(DB, JSON.stringify(db,null,2)); }
function json(res,status,data){ res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); }
function parseCookies(req){ const out={}; (req.headers.cookie||'').split(';').forEach(p=>{const [k,...v]=p.trim().split('='); if(k) out[k]=decodeURIComponent(v.join('='));}); return out; }
function auth(req){ const sid=parseCookies(req).sid; return sid ? sessions.get(sid) : null; }
function body(req){ return new Promise((resolve,reject)=>{let s=''; req.on('data',c=>s+=c); req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}})}); }
function id(prefix){ return prefix+'_'+crypto.randomBytes(5).toString('hex'); }
function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,'-').replace(/^-|-$/g,'')+'-'+crypto.randomBytes(3).toString('hex'); }
function requireAuth(req,res){ const a=auth(req); if(!a){json(res,401,{error:'未登录'}); return null;} return a; }

const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='GET' && req.url.startsWith('/api/')){
      const a=requireAuth(req,res); if(!a)return;
      const db=readDb(); const t=a.tenantId;
      if(req.url==='/api/me') return json(res,200,{user:a.user,tenant:db.tenants.find(x=>x.id===t)});
      const map={plugins:'plugins',automations:'automations',groups:'groups',shortcuts:'shortcuts'};
      for(const [route,key] of Object.entries(map)) if(req.url===`/api/${route}`) return json(res,200,db[key].filter(x=>x.tenantId===t));
      if(req.url==='/api/dashboard') return json(res,200,{plugins:db.plugins.filter(x=>x.tenantId===t).length,automations:db.automations.filter(x=>x.tenantId===t).length,groups:db.groups.filter(x=>x.tenantId===t).length,shortcuts:db.shortcuts.filter(x=>x.tenantId===t).length});
      return json(res,404,{error:'Not found'});
    }
    if(req.method==='POST' && req.url==='/api/login'){
      const b=await body(req), db=readDb(); const u=db.users.find(x=>x.email===b.email && x.password===b.password);
      if(!u) return json(res,401,{error:'账号或密码错误'});
      const sid=crypto.randomBytes(24).toString('hex'); sessions.set(sid,{user:{id:u.id,email:u.email,name:u.name,role:u.role},tenantId:u.tenantId});
      res.writeHead(200,{'Set-Cookie':`sid=${sid}; HttpOnly; Path=/; SameSite=Lax`,'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true}));
    }
    if(req.method==='POST' && req.url==='/api/logout'){
      const sid=parseCookies(req).sid; if(sid)sessions.delete(sid); res.writeHead(200,{'Set-Cookie':'sid=; Max-Age=0; Path=/','Content-Type':'application/json'}); return res.end('{"ok":true}');
    }
    if(req.method==='POST' && req.url.startsWith('/api/')){
      const a=requireAuth(req,res); if(!a)return; const b=await body(req), db=readDb(), t=a.tenantId;
      if(req.url==='/api/plugins'){const x={id:id('plugin'),tenantId:t,name:b.name,status:'active',automationId:b.automationId||null,groupId:b.groupId||null};db.plugins.push(x);writeDb(db);return json(res,201,x)}
      if(req.url==='/api/automations'){const x={id:id('auto'),tenantId:t,name:b.name,description:b.description||'',status:'active'};db.automations.push(x);writeDb(db);return json(res,201,x)}
      if(req.url==='/api/groups'){const x={id:id('group'),tenantId:t,name:b.name,status:'active',members:[]};db.groups.push(x);writeDb(db);return json(res,201,x)}
      if(req.url==='/api/shortcuts'){const x={id:id('shortcut'),tenantId:t,pluginId:b.pluginId,name:b.name,type:'automation',automationId:b.automationId,slug:slug(b.name),active:true};db.shortcuts.push(x);writeDb(db);return json(res,201,{...x,url:`/go/${x.slug}`})}
      return json(res,404,{error:'Not found'});
    }
    if(req.method==='GET' && req.url.startsWith('/go/')){
      const db=readDb(), s=db.shortcuts.find(x=>x.slug===req.url.slice(4));
      if(!s)return json(res,404,{error:'入口不存在'});
      const p=db.plugins.find(x=>x.id===s.pluginId), a=db.automations.find(x=>x.id===s.automationId), g=db.groups.find(x=>x.id===p?.groupId);
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); return res.end(`<!doctype html><html><head><meta charset="utf-8"><title>快捷入口</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;margin:0;background:#f6f7fb;display:grid;place-items:center;height:100vh}.box{background:#fff;padding:32px;border-radius:16px;box-shadow:0 10px 40px #0001;max-width:520px}.tag{display:inline-block;background:#eef2ff;padding:6px 10px;border-radius:999px}</style></head><body><div class="box"><span class="tag">${p?.name||''}</span><h1>${s.name}</h1><p>入口已进入 <b>${a?.name||'自动化'}</b>。</p><p>下一步客服分配：<b>${g?.name||'待配置'}</b></p><small>这是第一版路由验证页。后续这里会接入真实聊天插件、AI 自动化和实时客服。</small></div></body></html>`);
    }
    let file=req.url==='/'?'/index.html':req.url.split('?')[0]; const fp=path.normalize(path.join(PUBLIC,file)); if(!fp.startsWith(PUBLIC))return json(res,403,{error:'Forbidden'}); if(!fs.existsSync(fp))return json(res,404,{error:'Not found'}); const ext=path.extname(fp); const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'}; res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'}); fs.createReadStream(fp).pipe(res);
  }catch(e){console.error(e);json(res,500,{error:'服务器错误',detail:e.message});}
});
server.listen(PORT,()=>console.log(`Customer Service Platform running at http://localhost:${PORT}`));
