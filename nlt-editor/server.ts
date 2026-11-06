import { Database } from "bun:sqlite";

const db = new Database(process.env.DB ?? "nlt.db");
db.run("PRAGMA journal_mode = WAL");
const PORT = Number(process.env.PORT ?? 3000);

const json = (d: unknown, status = 200) => Response.json(d, { status });

const html = /* html */ `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NLT Editor</title>
<style>
:root{--bg:#fff;--fg:#1c1c1e;--mut:#6b7280;--line:#e5e7eb;--acc:#2f5fd0;--ok:#16794c;--card:#f8f9fb}
@media(prefers-color-scheme:dark){:root{--bg:#16181d;--fg:#e8e9ec;--mut:#9aa0ab;--line:#2c3038;--acc:#7aa2ff;--ok:#4cc38a;--card:#1d2027}}
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 16px;z-index:5}
.bar{display:flex;gap:8px;max-width:900px;margin:0 auto;flex-wrap:wrap}
input,select,textarea,button{font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 10px}
#q{flex:1;min-width:200px}button{cursor:pointer}button.p{background:var(--acc);color:#fff;border-color:var(--acc)}
main{max-width:900px;margin:0 auto;padding:12px 16px 60px}
.meta{color:var(--mut);font-size:14px;margin:8px 0}
.v{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:10px 0;background:var(--card)}
.ref{font-weight:600;font-size:14px;color:var(--acc);margin-bottom:4px;display:flex;justify-content:space-between;gap:8px}
.txt{white-space:pre-wrap;cursor:text}mark{background:#ffe27a55;color:inherit;border-radius:3px}
textarea{width:100%;min-height:90px;resize:vertical}.row{display:flex;gap:8px;align-items:center;margin-top:6px}
.st{font-size:13px;color:var(--ok)}.err{color:#d33}
.pg{display:flex;gap:8px;justify-content:center;align-items:center;margin-top:16px}
</style></head><body>
<header><div class="bar">
<input id="q" type="search" placeholder="Search verse text… (or ref like Gen 1:1)" autofocus>
<select id="book"><option value="">All books</option></select>
<select id="mode"><option value="any">Contains</option><option value="word">Whole word</option><option value="exact">Exact case</option></select>
</div></header>
<main><div class="meta" id="meta"></div><div id="list"></div>
<div class="pg"><button id="prev">← Prev</button><span id="pn"></span><button id="next">Next →</button></div></main>
<script>
const $=s=>document.querySelector(s);const LIM=25;let page=0,total=0,timer;
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rx=s=>s.replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&');
function hl(t,q){if(!q)return esc(t);try{return esc(t).replace(new RegExp(rx(esc(q)),'gi'),m=>'<mark>'+m+'</mark>')}catch{return esc(t)}}
async function load(){
  const p=new URLSearchParams({q:$('#q').value,book:$('#book').value,mode:$('#mode').value,limit:LIM,offset:page*LIM});
  const r=await (await fetch('/api/search?'+p)).json();total=r.total;
  $('#meta').textContent=total.toLocaleString()+' verse'+(total==1?'':'s');
  $('#pn').textContent=total?('Page '+(page+1)+' / '+Math.ceil(total/LIM)):'';
  $('#prev').disabled=page==0;$('#next').disabled=(page+1)*LIM>=total;
  $('#list').innerHTML='';
  for(const v of r.rows)$('#list').append(card(v));
}
function card(v){
  const d=document.createElement('div');d.className='v';
  const q=$('#q').value;
  d.innerHTML='<div class="ref"><span>'+esc(v.book)+' '+v.chapternumber+':'+v.versenumber+'</span><span style="color:var(--mut);font-weight:400">#'+v.verseid+'</span></div><div class="txt">'+hl(v.verse,q)+'</div>';
  d.querySelector('.txt').onclick=()=>edit(d,v);return d;
}
function edit(d,v){
  const t=d.querySelector('.txt');if(t.tagName=='TEXTAREA')return;
  const ta=document.createElement('textarea');ta.value=v.verse;t.replaceWith(ta);ta.focus();
  const row=document.createElement('div');row.className='row';
  row.innerHTML='<button class="p">Save</button><button>Cancel</button><span class="st"></span>';d.append(row);
  const [save,cancel,st]=row.children;
  cancel.onclick=()=>d.replaceWith(card(v));
  save.onclick=async()=>{
    const res=await fetch('/api/verse/'+v.verseid,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({verse:ta.value})});
    if(!res.ok){st.className='st err';st.textContent='Save failed';return}
    v.verse=(await res.json()).verse;const n=card(v);d.replaceWith(n);
    const s=document.createElement('span');s.className='st';s.textContent='Saved ✓';n.querySelector('.ref').append(s);setTimeout(()=>s.remove(),2000);
  };
  ta.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key=='Enter')save.click();if(e.key=='Escape')cancel.click()});
}
const go=()=>{page=0;load()};
$('#q').oninput=()=>{clearTimeout(timer);timer=setTimeout(go,250)};
$('#book').onchange=go;$('#mode').onchange=go;
$('#prev').onclick=()=>{page--;load();scrollTo(0,0)};$('#next').onclick=()=>{page++;load();scrollTo(0,0)};
fetch('/api/books').then(r=>r.json()).then(b=>{for(const x of b)$('#book').append(new Option(x,x))});
load();
</script></body></html>`;

const countStmt = (where: string) => db.query(`SELECT COUNT(*) n FROM nlt ${where}`);

function search(u: URL) {
  const q = (u.searchParams.get("q") ?? "").trim();
  const book = u.searchParams.get("book") ?? "";
  const mode = u.searchParams.get("mode") ?? "any";
  const limit = Math.min(100, Math.max(1, Number(u.searchParams.get("limit") ?? 25)));
  const offset = Math.max(0, Number(u.searchParams.get("offset") ?? 0));
  const conds: string[] = [];
  const args: (string | number)[] = [];
  if (book) { conds.push("book = ?"); args.push(book); }
  const ref = q.match(/^(\d?\s?[A-Za-z]+)\s+(\d+)(?::(\d+))?$/);
  if (ref && !book) {
    conds.push("book = ? COLLATE NOCASE AND chapternumber = ?"); args.push(ref[1].replace(/\s/g, ""), Number(ref[2]));
    if (ref[3]) { conds.push("versenumber = ?"); args.push(Number(ref[3])); }
  } else if (q) {
    if (mode === "exact") { conds.push("instr(verse, ?) > 0"); args.push(q); }
    else if (mode === "word") { conds.push("(' ' || lower(verse) || ' ') LIKE ? ESCAPE '\\'"); args.push("%" + q.toLowerCase().replace(/[\\%_]/g, "\\$&") + "%"); }
    else { conds.push("verse LIKE ? ESCAPE '\\'"); args.push("%" + q.replace(/[\\%_]/g, "\\$&") + "%"); }
  }
  const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
  const total = (countStmt(where).get(...args) as any).n;
  const rows = db.query(`SELECT * FROM nlt ${where} ORDER BY verseid LIMIT ? OFFSET ?`).all(...args, limit, offset);
  return { total, rows };
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const u = new URL(req.url);
    if (req.method === "GET" && u.pathname === "/") return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (req.method === "GET" && u.pathname === "/api/books")
      return json((db.query("SELECT book FROM nlt GROUP BY book ORDER BY MIN(verseid)").all() as any[]).map(r => r.book));
    if (req.method === "GET" && u.pathname === "/api/search") return json(search(u));
    const m = u.pathname.match(/^\/api\/verse\/(\d+)$/);
    if (m && req.method === "PUT") {
      const body = await req.json().catch(() => null) as { verse?: unknown } | null;
      if (!body || typeof body.verse !== "string") return json({ error: "verse must be a string" }, 400);
      const res = db.query("UPDATE nlt SET verse = ? WHERE verseid = ?").run(body.verse, Number(m[1]));
      if (res.changes === 0) return json({ error: "not found" }, 404);
      return json(db.query("SELECT * FROM nlt WHERE verseid = ?").get(Number(m[1])));
    }
    return new Response("Not found", { status: 404 });
  },
});
console.log(`NLT editor running at http://localhost:${PORT}`);
