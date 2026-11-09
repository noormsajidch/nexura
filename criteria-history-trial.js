/* NEXURA staged staff criteria and client visibility trial. Browser-local only. */
(()=>{'use strict';
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const oldCriteria=criterionForm;
criterionForm=function(isTarget=false,id=''){
 oldCriteria(isTarget,id);if(isTarget)return;
 const host=document.getElementById('nx-year-criteria'),btn=document.getElementById('nx-add-year-criterion');if(!host||!btn)return;
 const record=get('criteria',id)||{};
 function addYear(r={}){const div=document.createElement('div');div.className='nx-year-rule';div.innerHTML=`<div class="grid"><label>From<input type="date" data-y="from" value="${safe(r.from)}"></label><label>To<input type="date" data-y="to" value="${safe(r.to)}"></label><label>Fresh / FYP (Rs.)<input type="number" min="0" data-y="fresh" value="${safe(r.fresh)}"></label><label>Renewal (Rs.)<input type="number" min="0" data-y="renewal" value="${safe(r.renewal)}"></label><label>Persistency (%)<input type="number" min="0" max="100" data-y="persistency" value="${safe(r.persistency)}"></label><label>NOP<input type="number" min="0" data-y="nop" value="${safe(r.nop)}"></label></div><button type="button" class="secondary small nx-remove-year">Remove Period</button>`;div.querySelector('button').onclick=()=>div.remove();host.appendChild(div)}
 (record.yearRules||[]).forEach(addYear);btn.onclick=()=>addYear();
 const form=document.getElementById('editForm');if(!form)return;
 form.addEventListener('submit',e=>{
  const rules=Array.from(host.querySelectorAll('.nx-year-rule')).map(row=>Object.fromEntries(Array.from(row.querySelectorAll('[data-y]')).map(el=>[el.dataset.y,el.value])));
  if(rules.some(r=>!r.from||!r.to||r.from>r.to)){e.preventDefault();e.stopImmediatePropagation();alert('Each previous-year period requires valid From and To dates.');return}
  // existing form save handler runs synchronously after capture; attach requirements to the saved record
  const title=form.elements.namedItem('title')?.value;
  queueMicrotask(()=>{const item=id?get('criteria',id):[...db.criteria].reverse().find(x=>x.title===title);if(item){item.yearRules=rules;save();}});
 },true);
};
// Qualification requires all year-specific conditions; lack of source data never produces a completed tick.
const priorMet=requirementMet;
requirementMet=function(rule,ach){if(!priorMet(rule,ach))return false;if(!(rule.yearRules||[]).length)return true;return false;};
// Expose historical criteria progress in profile without automatically claiming completion.
const priorProfile=staffProfile;
staffProfile=function(id){priorProfile(id);const body=document.getElementById('modalBody');if(!body)return;
 const old=Array.from(body.querySelectorAll('h3')).find(h=>h.textContent.trim()==='Previous Performance');if(old){const table=old.nextElementSibling;if(table){const details=document.createElement('details');details.className='nx-history';const sum=document.createElement('summary');sum.textContent='Previous Business Record (last 5 completed years)';details.appendChild(sum);details.appendChild(table);old.replaceWith(details);}}
 const s=get('staff',id);if(!s)return;
 const history=Array.from(body.querySelectorAll('details.nx-history'))[0];if(history){const hint=document.createElement('p');hint.className='muted';hint.textContent='Older entries are hidden from this profile, not erased from historical backups or Policy Records. Current-year entries remain visible while that year is in progress.';history.appendChild(hint)}
};
// Client reactivation is explicitly controlled in the client profile, not by deleting issued policies.
const oldClientProfile=typeof customerProfile==='function'?customerProfile:null;
if(oldClientProfile){customerProfile=function(id){oldClientProfile(id);const c=get('customers',id);if(!c)return;const body=document.getElementById('modalBody');if(!body)return;const issued=(db.policies||[]).some(p=>p.customer===id);if(!issued)return;const box=document.createElement('div');box.className='nx-client-reactivate';box.innerHTML=`<label class="nx-switch-row"><input type="checkbox" id="nx-reactivate" ${c.reopenForProposal?'checked':''}> Show customer again for a new proposal</label><p class="muted">Existing issued policy stays in Policy Records. Switch OFF hides the customer from the active proposal workflow.</p>`;body.appendChild(box);box.querySelector('input').onchange=e=>{c.reopenForProposal=e.target.checked;save();};};}
})();
