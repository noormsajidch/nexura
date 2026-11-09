/* Focused Tile 1 update: premium reminders only inside Diary tabs */
(()=>{
'use strict';
const originalDiary=diary, premiumTab='Premium Reminders', pref='nx_premium_reminders_enabled';
let windowDays='7',premiumSearch='';
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDay=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const plusDays=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return localDay(d)};
const enabled=()=>localStorage.getItem(pref)!=='false';
function drawPremium(){
 const target=document.getElementById('nx-premium-list');if(!target)return;
 const a=localDay(),b=plusDays(Number(windowDays)||7);
 const records=(db.policies||[]).filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.due||'')&&(windowDays==='overdue'?p.due<a:p.due>=a&&p.due<=b)).filter(p=>{if(!premiumSearch.trim())return true;const c=db.customers.find(x=>x.id===p.customer)||{},st=db.staff.find(x=>x.id===p.staff)||{};return [JSON.stringify(p),JSON.stringify(c),JSON.stringify(st),p.importChannel,p.hierarchySnapshot,staffName(p.staff)].join(' ').toLocaleLowerCase().includes(premiumSearch.toLocaleLowerCase().trim())}).sort((p,q)=>p.due.localeCompare(q.due));
 const columns=['Policy Number','Client Name','Father / Spouse / Guardian','Phone / WhatsApp','Risk Date','Due Date','Address','Sum Assured','Premium','Premium Mode','SR Code','SM Code','SSM Code','AM Code','Staff Channel'];
 const report=records.map(p=>{const c=db.customers.find(x=>x.id===p.customer)||{};const st=db.staff.find(x=>x.id===p.staff)||{};const channel=String(p.importChannel||p.hierarchySnapshot||staffName(p.staff)||'');return [p.number||'',c.name||p.importName||'',c.guardian||c.guardianName||c.fatherSpouse||p.guardian||'',c.phone||p.phone||'',p.risk||'',p.due||'',c.address||p.address||'',p.sumAssured||p.sum||'',p.premium||'',p.mode||'',p.srCode||st.code||'',p.smCode||'',p.ssmCode||'',p.amCode||'',channel]});
 target.innerHTML=`<p class="muted">${records.length} reminder(s) · ${windowDays==='overdue'?'Overdue':'Next '+windowDays+' days'}</p><div class="scroll"><table><thead><tr>${columns.map(x=>`<th>${safe(x)}</th>`).join('')}</tr></thead><tbody>${report.map(row=>`<tr>${row.map(v=>`<td>${safe(v)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="15">No premiums in this period</td></tr>'}</tbody></table></div>`;
 document.getElementById('nx-premium-csv').onclick=()=>csv('nexura-premium-reminders',columns,report);
 document.getElementById('nx-premium-pdf').onclick=()=>pdf('Premium Reminders',columns,report);
}
diary=function(){
 if(tab!==premiumTab){
  return originalDiary().replace('Overdue, today and upcoming tasks · completed tasks are hidden from To-Do\'s','To-Do\'s: overdue and today only').replace('Regular tasks and meetings · premium reminders are available separately in Customers','Regular tasks and meetings · premium reminders are available separately in Premium Reminders');
 }
 return main('To-Do\'s/Dairy/Task','',tabs(["To-Do's",'Diary / Tasks',premiumTab])+`<div class="panel"><div class="row"><h3>Premium Reminders</h3><label class="nx-switch-label"><span>OFF</span><span class="nx-switch"><input id="nx-premium-enabled" type="checkbox" role="switch" aria-label="Premium reminders" ${enabled()?'checked':''}><span class="nx-switch-track"></span></span><span>ON</span></label></div><p class="muted">Separate from regular tasks. Switch OFF to close this section. Switch ON to show this section</p><div id="nx-premium-content" ${enabled()?'':'hidden'}><div class="nx-premium-toolbar"><label class="nx-premium-search">Live Search <input id="nx-premium-search" type="search" placeholder="Search all policy record fields" value="${safe(premiumSearch)}"></label><div class="nx-premium-actions"><button type="button" class="secondary small" id="nx-premium-csv">Download CSV</button><button type="button" class="secondary small" id="nx-premium-pdf">PDF / Print</button></div></div><div class="nx-premium-filters"><button class="secondary small" data-premium-period="7">Next 7 Days</button><button class="secondary small" data-premium-period="30">Next 30 Days</button><button class="secondary small" data-premium-period="overdue">Overdue</button></div><div id="nx-premium-list"></div></div><p id="nx-premium-off" class="muted" ${enabled()?'hidden':''}>Reminders are OFF.</p></div>`);
};
const previousRender=render;
render=function(){previousRender();if(tile!==0||tab!==premiumTab)return;
 const toggle=document.getElementById('nx-premium-enabled');if(!toggle)return;
 const ps=document.getElementById('nx-premium-search');if(ps)ps.oninput=()=>{premiumSearch=ps.value;drawPremium()};
 toggle.onchange=()=>{localStorage.setItem(pref,String(toggle.checked));document.getElementById('nx-premium-content').hidden=!toggle.checked;document.getElementById('nx-premium-off').hidden=toggle.checked;if(toggle.checked)drawPremium()};
 document.querySelectorAll('[data-premium-period]').forEach(b=>b.onclick=()=>{windowDays=b.dataset.premiumPeriod;document.querySelectorAll('[data-premium-period]').forEach(x=>x.classList.toggle('active',x===b));drawPremium()});
 document.querySelector(`[data-premium-period="${windowDays}"]`)?.classList.add('active');if(enabled())drawPremium();
};
})();
