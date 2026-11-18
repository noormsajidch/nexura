/* NEXURA focused staff enhancements; preserves login and other tiles. */
(()=>{'use strict';
 const oldTaskForm=taskForm;
 taskForm=function(id=''){
  oldTaskForm(id);
  const el=document.querySelector('#editForm select[name="staff"]');if(!el)return;
  const wrap=el.parentElement;
  const opts=[...el.options].map(o=>({value:o.value,text:o.textContent.trim()}));
  const lookup=document.createElement('input');
  lookup.type='text';lookup.autocomplete='off';lookup.placeholder='Search or select staff by name, code or designation';
  lookup.className='nx-staff-combobox';lookup.setAttribute('aria-label','Assigned Staff — searchable selection');
  const list=document.createElement('datalist');list.id='nx-staff-list-'+Math.random().toString(36).slice(2);
  opts.filter(o=>o.value).forEach(o=>{const option=document.createElement('option');option.value=o.text;list.appendChild(option)});
  lookup.setAttribute('list',list.id);
  lookup.value=opts.find(o=>o.value&&o.value===el.value)?.text||'';
  let selectedText=lookup.value;
  lookup.addEventListener('focus',()=>{selectedText=opts.find(o=>o.value&&o.value===el.value)?.text||'';lookup.value='';lookup.setCustomValidity('')});
  lookup.addEventListener('blur',()=>{if(!lookup.value.trim()&&el.value){lookup.value=selectedText;lookup.setCustomValidity('')}});
  el.style.display='none';el.setAttribute('aria-hidden','true');
  wrap.insertBefore(lookup,el);wrap.insertBefore(list,el);
  const resolve=()=>{const v=lookup.value.trim().toLocaleLowerCase();const matched=opts.find(o=>o.value&&o.text.toLocaleLowerCase()===v)||opts.find(o=>o.value&&o.value.toLocaleLowerCase()===v);
   if(matched){el.value=matched.value;lookup.setCustomValidity('');return true}
   if(!v){if(el.value)lookup.value=selectedText;lookup.setCustomValidity('');return true}
   el.value='';lookup.setCustomValidity('Select a staff member from the suggestions.');return false;
  };
  lookup.addEventListener('input',()=>lookup.setCustomValidity(''));
  lookup.addEventListener('change',resolve);
  const form=lookup.closest('form');if(form)form.addEventListener('submit',e=>{if(!resolve()){e.preventDefault();e.stopImmediatePropagation();lookup.reportValidity()}},true);

 };
 const oldStaff=staff;
 staff=function(){const html=oldStaff();return html.replace('+ Add Staff</button>', '+ Add Staff</button> <button class="secondary" id="nx-bulk-staff">Bulk Add Staff (CSV)</button>')};
 const oldBind=bindGlobal;
 bindGlobal=function(){oldBind();const b=document.getElementById('nx-bulk-staff');if(b)b.onclick=openBulkStaff;};
 const oldProfile=staffProfile;
 staffProfile=function(i){
  oldProfile(i);const s=get('staff',i);if(!s)return;
  const body=document.getElementById('modalBody');if(!body)return;
  const h=body.querySelector('h2');if(h)h.textContent=s.name||'Staff Profile';
  const heading=body.querySelector('.row');if(heading){const details=document.createElement('div');details.className='nx-profile-header';details.innerHTML=`<div><strong>Name</strong><div>${esc(s.name||'—')}</div></div><div><strong>Code</strong><div>${esc(s.code||'—')}</div></div><div><strong>Date of Appointment</strong><div>${esc(s.appointment||'—')}</div></div><div><strong>Date of Expiry</strong><div>${esc(s.expiryDate||'—')}</div></div><div><strong>Phone</strong><div>${esc(s.phone||'—')}</div></div><div><strong>Designation</strong><div>${esc(s.designation||'—')}</div></div>`;heading.insertAdjacentElement('afterend',details);
  // Remove repeated designation/phone and appointment/expiry paragraphs beneath the header.
  let after=details.nextElementSibling;for(let j=0;j<2&&after&&after.tagName==='P';j++){const next=after.nextElementSibling;if(j===0||/Registration Number \/ National ID/.test(after.textContent)){if(j===1){const reg=s.nationalId||'—';const regEl=document.createElement('p');regEl.innerHTML='<b>Registration Number / National ID:</b> '+esc(reg);after.replaceWith(regEl);}else after.remove();}after=next;}}
  [...body.querySelectorAll('h3')].forEach(x=>{if(x.textContent.trim()==='Qualification Status'){let node=x.nextElementSibling;while(node&&node.tagName!=='H3'){const next=node.nextElementSibling;node.remove();node=next;}x.remove();}});
  const performance=Array.from(body.querySelectorAll('h3')).find(x=>x.textContent.includes('Historical Performance'));
  if(performance)performance.textContent='Previous Performance';
  const metrics=Array.from(body.querySelectorAll('h3')).find(x=>x.textContent.includes('Performance / Targets'));
  if(metrics)metrics.textContent='Performance';
 };
 function parseCSV(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell=''}else cell+=c;}row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;}
 const normalize=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const cols={name:['name','staffname','fullname'],code:['code','staffcode','codenumber'],designation:['designation','position','rank'],phone:['phone','mobilenumber','whatsapp'],nationalId:['registrationnumber','nationalid','nic','cnic'],appointment:['appointmentdate','dateofappointment'],expiryDate:['expirydate','dateofexpiry','codeexpirydate'],managerCode:['managercode','superiorcode','reportingtocode']};
 const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function openBulkStaff(){
  modal('Bulk Add Staff — CSV Preview',`<p class="muted">CSV only in this trial. Required: Name and Code. Optional: Designation, Phone, Registration Number, Appointment Date, Expiry Date, Manager Code. Existing staff will not be overwritten.</p><input id="nx-staff-file" type="file" accept=".csv,text/csv"><p><button type="button" class="secondary small" id="nx-template">Download CSV Template</button></p><div id="nx-staff-preview" class="scroll"></div><button type="button" class="primary" id="nx-confirm" disabled>Confirm Import</button>`);
  document.querySelector('#editForm button[type=submit]')?.remove();
  const template='Name,Code,Designation,Phone,Registration Number,Appointment Date,Expiry Date,Manager Code\n';
  document.getElementById('nx-template').onclick=()=>{const url=URL.createObjectURL(new Blob([template],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='NEXURA_STAFF_BULK_TEMPLATE.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  let valid=[];const preview=document.getElementById('nx-staff-preview'),confirmBtn=document.getElementById('nx-confirm');
  document.getElementById('nx-staff-file').onchange=async e=>{
   valid=[];confirmBtn.disabled=true;const file=e.target.files?.[0];if(!file)return;
   const rows=parseCSV((await file.text()).replace(/^\uFEFF/,''));if(rows.length<2){preview.textContent='No records found.';return;}
   const head=rows.shift().map(normalize);const ix=k=>head.findIndex(h=>cols[k].includes(h));
   if(ix('name')<0||ix('code')<0){preview.textContent='Missing Name or Code column.';return;}
   const existing=new Set(db.staff.map(s=>String(s.code).trim()));const seen=new Set();let errors=[];
   rows.forEach((row,j)=>{const rec={};for(const k of Object.keys(cols))rec[k]=ix(k)<0?'':String(row[ix(k)]||'').trim();if(!rec.name||!rec.code){errors.push(`Row ${j+2}: missing name/code`);return;}if(existing.has(rec.code)||seen.has(rec.code)){errors.push(`Row ${j+2}: duplicate code ${rec.code}`);return;}seen.add(rec.code);valid.push(rec);});
   preview.innerHTML=`<p>${valid.length} valid new staff · ${errors.length} skipped</p>${errors.length?`<p class="warning">${safe(errors.slice(0,12).join(' | '))}</p>`:''}<div class="scroll"><table><thead><tr><th>Name</th><th>Code</th><th>Designation</th><th>Manager Code</th></tr></thead><tbody>${valid.slice(0,50).map(r=>`<tr><td>${safe(r.name)}</td><td>${safe(r.code)}</td><td>${safe(r.designation)}</td><td>${safe(r.managerCode)}</td></tr>`).join('')}</tbody></table></div>`;
   confirmBtn.disabled=!valid.length;
  };
  confirmBtn.onclick=()=>{if(!valid.length||!confirm(`Import ${valid.length} new staff records?`))return;
   const codeMap=new Map(db.staff.map(s=>[String(s.code).trim(),s.id]));
   for(const r of valid){const rec={...r};delete rec.managerCode;const saved=add('staff',rec);codeMap.set(String(rec.code),saved.id);}
   for(const r of valid){if(!r.managerCode)continue;const manager=codeMap.get(r.managerCode),member=codeMap.get(r.code);if(manager&&member&&manager!==member)update('staff',member,{manager});}
   closeModal();render();alert(`${valid.length} staff imported. Review hierarchy before using.`);
  };
 }
})();
