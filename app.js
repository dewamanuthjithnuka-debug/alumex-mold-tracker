'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
const cfg=window.APP_CONFIG||{};
const configured=cfg.SUPABASE_URL?.startsWith('https://') && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.startsWith('PASTE_');
let db, molds=[], transactions=[], selectedMold=null, selectedTx=null, isAdmin=false, currentView="out";
const show=(id,yes=true)=>$(id).classList.toggle('hidden',!yes);
function notice(s,isError=false){$('msg').textContent=s;$('msg').className=isError?'error':'status';}
function errorText(e){return e?.message||String(e)}
function validateFile(f){if(!f)throw Error('Please attach the document.');if(f.size>10*1024*1024)throw Error('Maximum file size is 10 MB.');if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type))throw Error('Use JPG, PNG, WEBP or PDF.');}
function extension(f){return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'})[f.type];}
function mostRecent(moldId){return transactions.filter(t=>t.mold_id===moldId).sort((a,b)=>b.sent_date.localeCompare(a.sent_date)||b.created_at.localeCompare(a.created_at))[0]}
function active(moldId){return transactions.find(t=>t.mold_id===moldId&&!t.returned_date)}
function status(m){const a=active(m.id);if(a)return a.expected_return&&a.expected_return<day()?'late':'out';return mostRecent(m.id)?'returned':'available'}
function setView(view){
 currentView=view;
 $('nav-outsourced').classList.toggle('active',view==='out');
 $('nav-all').classList.toggle('active',view==='all');
 $('nav-outsourced').setAttribute('aria-current',view==='out'?'page':'false');
 $('nav-all').setAttribute('aria-current',view==='all'?'page':'false');
 $('view-heading').textContent=view==='out'?'Outsourced Moulds Summary':'All Moulds';
 $('view-description').textContent=view==='out'?'Moulds currently sent to external workshops, including overdue returns.':'Full inventory, with current status and previous outsourcing history.';
 $('filter').value=view==='out'?'out':'all';
 $('search').value='';
 show('outsourced-table',view==='out');
 show('all-moulds-table',view==='all');
 render();
}
function render(){const q=$('search').value.trim().toLowerCase(),f=$('filter').value;
$('nav-all-count').textContent=molds.length;$('nav-out-count').textContent=molds.filter(m=>!!active(m.id)).length; $('s-total').textContent=molds.length;$('s-out').textContent=molds.filter(m=>!!active(m.id)).length;$('s-late').textContent=molds.filter(m=>status(m)==='late').length;$('s-back').textContent=transactions.filter(t=>t.returned_date).length;
const filtered=molds.filter(m=>{const a=active(m.id),s=status(m);return (f==='all'||f===s||(f==='out'&&s==='late'))&&[m.mold_code,m.customer,m.profile_name,m.machine,m.mold_type,a?.vendor].join(' ').toLowerCase().includes(q)});
$('rows').innerHTML=filtered.map(m=>{const a=active(m.id),s=status(m);const caption={out:'Outsourced',late:'Overdue',returned:'Returned',available:'Not outsourced'}[s];return `<tr><td><b>${esc(m.mold_code)}</b><br><small>${esc(m.mold_type||'')}</small></td><td>${esc(m.customer)}<br><small>${esc(m.profile_name)}</small></td><td>${esc(m.machine||'Not listed')}</td><td><span class="tag ${s}">${caption}</span></td><td>${esc(a?.vendor||'—')}</td><td>${a?esc(a.sent_date)+'<br><small>Due: '+esc(a.expected_return||'Not set')+'</small>':'—'}</td><td>${isAdmin?(a?`<button data-cmd="return" data-id="${m.id}">Mark returned</button>`:`<button data-cmd="send" data-id="${m.id}">Send out</button>`):""}<button class="ghost" data-cmd="history" data-id="${m.id}">View details</button></td></tr>`}).join('')||'<tr><td colspan="7">No molds match your search.</td></tr>';
// All Moulds follows the inventory sheet columns, with live on-site availability.
const allFiltered=molds.filter(m=>[m.mold_code,m.customer,m.profile_name,m.machine,m.mold_type].join(' ').toLowerCase().includes(q) && (f==='all'||f===status(m)||(f==='out'&&status(m)==='late')));
$('all-rows').innerHTML=allFiltered.map(m=>{
 const a=active(m.id),available=!a;
 const indicator=available?'<span class="availability available" role="img" aria-label="Available on site"><span class="availability-icon" aria-hidden="true">✓</span> <span>Available</span></span>':'<span class="availability offsite" role="img" aria-label="Not on site: outsourced"><span class="availability-icon" aria-hidden="true">✕</span> <span>Outsourced</span></span>';
 const commands=isAdmin?(a?`<button data-cmd="return" data-id="${m.id}">Mark returned</button>`:`<button data-cmd="send" data-id="${m.id}">Send out</button>`):'';
 return `<tr><td><b>${esc(m.mold_code)}</b><br><small>${esc(m.customer)}</small></td><td>${esc(m.profile_name||'—')}</td><td>${esc(m.machine||'—')}</td><td>${esc(m.mold_type||'—')}</td><td class="qty-cell">${esc(m.quantity??'—')}</td><td>${indicator}</td><td>${commands}<button class="ghost" data-cmd="history" data-id="${m.id}">View details</button></td></tr>`;
}).join('')||'<tr><td colspan="7">No moulds match your search.</td></tr>';
}
async function load(){notice('Loading shared records…');const [mr,tr]=await Promise.all([db.from('molds').select('*').order('id'),isAdmin?db.from('outsourcing').select('*').order('created_at',{ascending:false}):db.rpc('public_mold_outsourcing_summary')]);if(mr.error)throw mr.error;if(tr.error)throw tr.error;molds=mr.data||[];transactions=tr.data||[];render();notice(isAdmin?'Admin mode: you can update records.':'View only · Select View details to open gate passes and return receipts.');}
async function signedLink(path){if(!path)return null;const {data,error}=await db.storage.from('mold-documents').createSignedUrl(path,120);if(error)throw error;return data.signedUrl;}
async function uploadFile(file,recordId,kind){validateFile(file);const path=`${recordId}/${kind}-${crypto.randomUUID()}.${extension(file)}`;const {error}=await db.storage.from('mold-documents').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;return path;}
function openSend(m){selectedMold=m;const form=$('send-form');form.reset();form.elements.sent_date.value=day();$('send-mold').textContent=m.mold_code+' · '+m.profile_name;$('send-err').textContent='';$('send-dialog').showModal();}
function openReturn(m){selectedMold=m;selectedTx=active(m.id);const form=$('return-form');form.reset();form.elements.returned_date.value=day();$('return-mold').textContent=m.mold_code+' · '+selectedTx.vendor;$('return-err').textContent='';$('return-dialog').showModal();}
async function openHistory(m){$('history-title').textContent='Mould details · '+m.mold_code;const items=transactions.filter(t=>t.mold_id===m.id);$('history-entries').innerHTML=items.length?items.map(t=>`<div class="record"><b>${esc(t.vendor)}</b> · ${t.returned_date?'Returned':'Outsourced'}<p>Sent: ${esc(t.sent_date)} · Expected: ${esc(t.expected_return||'Not set')} · Returned: ${esc(t.returned_date||'Not yet')}</p><p>Reason: ${esc(t.reason)}</p>${isAdmin?`<p>Gate pass: ${esc(t.gate_pass_number||'—')} · Handed over: ${esc(t.handed_over_by||'—')} · Received: ${esc(t.received_by||'—')}</p>`:''}${isAdmin?`<p>Return condition: ${esc(t.return_condition||'—')} · ${esc(t.notes||'')}</p>`:''}${t.gate_pass_path?`<button class="ghost" data-doc="gate" data-id="${t.id}">View gate pass</button>`:''}${t.return_receipt_path?` <button class="ghost" data-doc="receipt" data-id="${t.id}">View return receipt</button>`:''}</div>`).join(''):'<p>No transactions recorded.</p>';$('history-dialog').showModal();}
function onMouldAction(e){const b=e.target.closest('button[data-cmd]');if(!b)return;const m=molds.find(x=>x.id===Number(b.dataset.id));if(!m)return;if(b.dataset.cmd==='send'&&isAdmin)openSend(m);if(b.dataset.cmd==='return'&&isAdmin)openReturn(m);if(b.dataset.cmd==='history')openHistory(m)}
$('rows').addEventListener('click',onMouldAction);
$('all-rows').addEventListener('click',onMouldAction);
$('history-entries').addEventListener('click',async e=>{const b=e.target.closest('button[data-doc]');if(!b)return;const t=transactions.find(x=>x.id===b.dataset.id);if(!t)return;try{const url=await signedLink(b.dataset.doc==='gate'?t.gate_pass_path:t.return_receipt_path);window.open(url,'_blank','noopener,noreferrer');}catch(err){alert('Unable to open document: '+errorText(err));}});
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>$(b.dataset.close).close());
$('send-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,btn=form.querySelector('[type=submit]'),v=Object.fromEntries(new FormData(form));$('send-err').textContent='';btn.disabled=true;try{if(active(selectedMold.id))throw Error('This mold is already outsourced. Refresh the page.');if(v.expected_return&&v.expected_return<v.sent_date)throw Error('Expected return cannot be before sent date.');const file=form.elements.gate_file.files[0];validateFile(file);const id=crypto.randomUUID();const path=await uploadFile(file,id,'gate');const {error}=await db.from('outsourcing').insert({id,mold_id:selectedMold.id,vendor:v.vendor,reason:v.reason,sent_date:v.sent_date,expected_return:v.expected_return||null,gate_pass_number:v.gate_pass_number||null,handed_over_by:v.handed_over_by||null,notes:v.notes||null,gate_pass_path:path});if(error)throw error;$('send-dialog').close();await load();notice('Outsourcing recorded with gate-pass document.');}catch(err){$('send-err').textContent=errorText(err)+' If the record was not created, the uploaded file may need administrator cleanup.';}finally{btn.disabled=false;}});
$('return-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,btn=form.querySelector('[type=submit]'),v=Object.fromEntries(new FormData(form));$('return-err').textContent='';btn.disabled=true;try{if(v.returned_date<selectedTx.sent_date)throw Error('Return date cannot precede sent date.');const file=form.elements.return_file.files[0];validateFile(file);const path=await uploadFile(file,selectedTx.id,'receipt');const {data,error}=await db.from('outsourcing').update({returned_date:v.returned_date,received_by:v.received_by||null,return_condition:v.return_condition,return_notes:v.return_notes||null,return_receipt_path:path}).eq('id',selectedTx.id).is('returned_date',null).select('id');if(error)throw error;if(!data?.length)throw Error('Another employee already marked this mold as returned. Refresh.');$('return-dialog').close();await load();notice('Return recorded with receipt.');}catch(err){$('return-err').textContent=errorText(err);}finally{btn.disabled=false;}});
$('nav-outsourced').addEventListener('click',()=>setView('out'));$('nav-all').addEventListener('click',()=>setView('all'));
$('search').addEventListener('input',render);$('filter').addEventListener('change',render);$('refresh').addEventListener('click',()=>load().catch(e=>notice(errorText(e),true)));
$('export').addEventListener('click',()=>{const fields=['mold_code','customer','profile_name','machine','vendor','reason','sent_date','expected_return','returned_date','gate_pass_number','handed_over_by','received_by','return_condition','notes','gate_pass_path','return_receipt_path'];const lookup=new Map(molds.map(m=>[m.id,m]));const rows=[fields,...transactions.map(t=>{const m=lookup.get(t.mold_id)||{};return fields.map(f=>m[f]??t[f]??'')})];const csv='\ufeff'+rows.map(a=>a.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='alumex-mold-outsourcing.csv';a.click();URL.revokeObjectURL(url);});
$('logout').addEventListener('click',async()=>{await db.auth.signOut();await updateUser();});
$('open-login').addEventListener('click',()=>show('login',true));
$('close-login').addEventListener('click',()=>show('login',false));
$('login-form').addEventListener('submit',async e=>{
 e.preventDefault();$('login-msg').textContent='Signing in…';
 const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
 if(error){$('login-msg').textContent=errorText(error);return;}
 $('login-msg').textContent=''; await updateUser();
});
async function updateUser(){
 const {data:{session},error:sessionError}=await db.auth.getSession();
 if(sessionError)console.warn(sessionError);
 isAdmin=false;
 if(session){
  const {data,error}=await db.from('allowed_staff').select('email').limit(1);
  if(!error&&data?.length){isAdmin=true;}
  else{await db.auth.signOut();$('login-msg').textContent='This account is not authorized as an admin.';}
 }
 $('role-label').textContent=isAdmin?'Signed in as admin':'Public viewer';
 show('open-login',!isAdmin);show('logout',isAdmin);show('login',false);show('dashboard',true);show('export',isAdmin);
 try{await load();}catch(e){notice('Database access error: '+errorText(e)+' — check config.js and run public_view_admin_edit.sql in Supabase.',true);}
}
(async()=>{if(!configured||!window.supabase){show('setup');return;}
 db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
 await updateUser();
})();
