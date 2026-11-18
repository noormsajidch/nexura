/* NEXURA unified table layout standard: Search > CSV/PDF/Print > Filters > Table.
   Existing report/search callbacks are preserved; no duplicate controls. */
(()=>{'use strict';
let busy=false;
const tableRoot=()=>document.getElementById('app');
const controlsFor=(panel)=>Array.from(panel.querySelectorAll('input,select,button,label')).filter(x=>!x.closest('table'));
const idText=x=>((x.id||'')+' '+(x.textContent||'')+' '+(x.getAttribute('placeholder')||'')).toLowerCase();
const isSearch=x=>x.tagName==='INPUT'&&(x.type==='search'||(x.type==='text'&&/search/i.test(idText(x))));
const isCsv=x=>x.tagName==='BUTTON'&&(/csv/i.test(idText(x))||/Csv$/.test(x.id));
const isPdf=x=>x.tagName==='BUTTON'&&/pdf|print/i.test(idText(x));
const isFilter=x=>x.tagName==='SELECT'||(x.tagName==='INPUT'&&['date'].includes(x.type));
function scan(){
 if(busy)return;busy=true;
 try{
  const app=tableRoot();if(!app)return;
  app.querySelectorAll('table').forEach(table=>{
   const host=table.closest('.scroll')||table.parentElement;
   const panel=table.closest('.panel')||table.parentElement;
   if(!host||!panel)return;
   // Premium and task have their own functional live-search/export controls.
   const existingSearch=Array.from(panel.querySelectorAll('input')).filter(isSearch);
   const existingCsv=Array.from(panel.querySelectorAll('button')).filter(isCsv);
   const existingPdf=Array.from(panel.querySelectorAll('button')).filter(isPdf);
   let toolbar=panel.querySelector(':scope > .nx-uniform-toolbar');
   if(!toolbar){toolbar=document.createElement('div');toolbar.className='nx-uniform-toolbar';{let anchor=host;while(anchor.parentElement&&anchor.parentElement!==panel)anchor=anchor.parentElement;if(anchor.parentElement===panel)panel.insertBefore(toolbar,anchor);else panel.appendChild(toolbar);}}
   let searchRow=toolbar.querySelector('.nx-uniform-search');
   if(!searchRow){searchRow=document.createElement('div');searchRow.className='nx-uniform-search';toolbar.appendChild(searchRow);}
   let actionRow=toolbar.querySelector('.nx-uniform-actions');
   if(!actionRow){actionRow=document.createElement('div');actionRow.className='nx-uniform-actions';toolbar.appendChild(actionRow);}
   let filterRow=toolbar.querySelector('.nx-uniform-filters');
   if(!filterRow){filterRow=document.createElement('div');filterRow.className='nx-uniform-filters';toolbar.appendChild(filterRow);}
   // Move existing controls rather than recreating them, preserving event handlers.
   const move=(node,target)=>{if(node&&!target.contains(node)){target.appendChild(node)}};
   existingSearch.forEach(input=>move(input.closest('label')||input,searchRow));
   existingCsv.forEach(button=>move(button,actionRow));
   existingPdf.forEach(button=>move(button,actionRow));
   const inputs=Array.from(panel.querySelectorAll('select,input[type=date]')).filter(x=>!x.closest('table'));
   inputs.forEach(input=>move(input.closest('label')||input,filterRow));
   panel.querySelectorAll('[data-premium-period]').forEach(button=>move(button,filterRow));
   if(!searchRow.querySelector('input')){
    const label=document.createElement('label');label.textContent='Live Search';
    const input=document.createElement('input');input.type='search';input.placeholder='Search all table columns';input.className='nx-uniform-generated-search';
    label.appendChild(input);searchRow.appendChild(label);
    input.addEventListener('input',()=>{
      const q=input.value.toLocaleLowerCase().trim();
      table.querySelectorAll('tbody tr').forEach(tr=>{
       tr.hidden=!!q&&!Array.from(tr.cells).some(td=>td.textContent.toLocaleLowerCase().includes(q));
      });
    });
   }
   if(!actionRow.querySelector('button')){
    const head=()=>Array.from(table.querySelectorAll('thead th')).map(th=>th.textContent.trim());
    const rows=()=>Array.from(table.querySelectorAll('tbody tr')).filter(tr=>!tr.hidden).map(tr=>Array.from(tr.cells).map(td=>td.innerText.trim()));
    const b1=document.createElement('button');b1.className='secondary small';b1.textContent='Download CSV';b1.onclick=()=>csv('nexura-table-report',head(),rows());
    const b2=document.createElement('button');b2.className='secondary small';b2.textContent='PDF / Print';b2.onclick=()=>pdf('NEXURA Table Report',head(),rows());
    actionRow.append(b1,b2);
   }else{
    if(!actionRow.querySelector('button[id$="Pdf"],button[id$="pdf"]')&&!Array.from(actionRow.querySelectorAll('button')).some(isPdf)){
      const b=document.createElement('button');b.className='secondary small';b.textContent='PDF / Print';
      b.onclick=()=>pdf('NEXURA Table Report',Array.from(table.querySelectorAll('thead th')).map(x=>x.innerText.trim()),Array.from(table.querySelectorAll('tbody tr')).filter(x=>!x.hidden).map(tr=>Array.from(tr.cells).map(td=>td.innerText.trim())));
      actionRow.appendChild(b);
    }
    if(!Array.from(actionRow.querySelectorAll('button')).some(isCsv)){
      const b=document.createElement('button');b.className='secondary small';b.textContent='Download CSV';
      b.onclick=()=>csv('nexura-table-report',Array.from(table.querySelectorAll('thead th')).map(x=>x.innerText.trim()),Array.from(table.querySelectorAll('tbody tr')).filter(x=>!x.hidden).map(tr=>Array.from(tr.cells).map(td=>td.innerText.trim())));
      actionRow.prepend(b);
    }
   }
   // Do not interfere with panel-specific controls that are outside the table.
  });
 }finally{busy=false;}
}
const obs=new MutationObserver(()=>{if(!busy)queueMicrotask(scan)});
const app=tableRoot();if(app)obs.observe(app,{childList:true,subtree:true});
const prior=render;render=function(){prior();scan()};
scan();
})();
