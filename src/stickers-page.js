(() => {
'use strict';
const {stickerStops,stickerLandingURL,planStickerSheets,stickerQR,stopDirectory}=globalThis.MagnusBus;
const $=id=>document.getElementById(id);
const selected=new Set();
let stops=[],visible=[],plan=null;
const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};

function error(message='') {
  $('generator-error').textContent=message;$('generator-error').hidden=!message;
}
function invalidate() {
  plan=null;$('sheet-preview').replaceChildren();$('print-sheets').disabled=true;
  document.body.classList.remove('has-sheets');
  $('sheet-summary').textContent='Choose your stops and generate a preview.';
  error();
}
function count() {
  $('selection-count').textContent=selected.size+' stop'+(selected.size===1?'':'s')+' selected';
  $('clear-stops').disabled=!selected.size;
  $('select-visible').disabled=!visible.length;
}
function renderStops() {
  const direction=$('sticker-direction').value,query=$('sticker-search').value.trim().toLowerCase();
  visible=stops.filter(stop=>(direction==='all'||stop.gtfs===direction) && (stop.stopName+' '+stop.target).toLowerCase().includes(query));
  const fragment=document.createDocumentFragment();
  for(const gtfs of ['0','1']) {
    const group=visible.filter(stop=>stop.gtfs===gtfs);
    if(!group.length)continue;
    const fieldset=node('fieldset','stop-group');
    fieldset.append(node('legend','',group[0].name+' · '+group[0].destination));
    for(const stop of group) {
      const label=node('label','stop-choice'),checkbox=node('input');
      checkbox.type='checkbox';checkbox.value=stop.key;checkbox.checked=selected.has(stop.key);
      const text=node('span','stop-choice-name',stop.stopName);
      label.append(checkbox,text,node('span','stop-choice-id','#'+stop.target));
      fieldset.append(label);
    }
    fragment.append(fieldset);
  }
  if(!visible.length)fragment.append(node('p','no-stops',stops.length?'No stops match your search.':'No stops are available for this route in the current directory.'));
  $('sticker-stops').replaceChildren(fragment);count();
}
function chooseRoute() {
  invalidate();selected.clear();$('sticker-search').value='';
  stops=stickerStops(stopDirectory,$('sticker-route').value);
  const all=node('option','','Both directions');all.value='all';
  $('sticker-direction').replaceChildren(all);
  for(const gtfs of ['0','1']) {
    const first=stops.find(stop=>stop.gtfs===gtfs);
    if(first) {const option=node('option','',first.name+' · '+first.destination);option.value=gtfs;$('sticker-direction').append(option);}
  }
  $('sticker-direction').value='all';renderStops();
}
function addressNote() {
  let local=false;
  try {
    const host=new URL($('sticker-address').value).hostname;
    local=host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host==='[::1]'||/^127\./.test(host)||/^192\.168\./.test(host)||/^10\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host);
  }catch{}
  $('local-address-note').hidden=!local;
}
function renderSheets(next) {
  const fragment=document.createDocumentFragment(),qrCache=new Map();
  next.sheets.forEach((stickers,index)=>{
    const sheet=node('section','sticker-sheet '+next.paper);
    sheet.setAttribute('aria-label','Sheet '+(index+1)+' of '+next.sheets.length);
    const heading=node('header','sheet-heading');
    heading.append(node('strong','','Magnus’s Bus · Route '+next.routeId),node('span','','Sheet '+(index+1)+' of '+next.sheets.length));
    const grid=node('div','sticker-grid');
    for(const sticker of stickers) {
      const cell=node('div','sticker-cell'),publicSticker=node('div','public-sticker');
      publicSticker.append(node('div','sticker-brand','Magnus’s Bus'),node('h3','sticker-question','When’s my bus?'),node('p','sticker-invitation','Scan for live arrivals'));
      const qrLink=node('a','sticker-qr');qrLink.href=sticker.url;qrLink.target='_blank';qrLink.rel='noopener noreferrer';
      qrLink.setAttribute('aria-label','Open Route '+sticker.route+' at '+sticker.stopName+', '+sticker.name);
      if(!qrCache.has(sticker.url))qrCache.set(sticker.url,stickerQR(sticker.url));
      qrLink.innerHTML=qrCache.get(sticker.url);
      qrLink.querySelector('svg').setAttribute('aria-hidden','true');
      publicSticker.append(qrLink,node('p','sticker-public-route',sticker.route+' · '+sticker.name),node('p','sticker-public-stop',sticker.stopName));
      const installation=node('div','installation-label');
      installation.append(node('strong','installation-number','Sticker '+String(sticker.number).padStart(2,'0')+' of '+next.total+' · Route '+sticker.route),
        node('span','installation-stop',sticker.stopName),
        node('span','installation-direction',sticker.name+' · '+sticker.destination),
        node('span','installation-id','Stop #'+sticker.target+' · Sheet '+(index+1)+' of '+next.sheets.length));
      cell.append(publicSticker,installation);grid.append(cell);
    }
    const footer=node('footer','sheet-footer');
    footer.append(node('span','','Cut on dashed borders · Placement labels stay on the sheet'),node('span','','2½ in squares · Print at 100%'));
    sheet.append(heading,grid,footer);fragment.append(sheet);
  });
  $('sheet-preview').replaceChildren(fragment);
}
function generate(event) {
  event.preventDefault();invalidate();
  try {
    const next=planStickerSheets({directory:stopDirectory,routeId:$('sticker-route').value,selectedKeys:selected,
      copies:Number($('sticker-copies').value),landingURL:$('sticker-address').value});
    renderSheets(next);plan=next;
    document.body.classList.add('has-sheets');$('print-sheets').disabled=false;
    $('sheet-summary').textContent=next.total+' sticker'+(next.total===1?'':'s')+' for '+next.stopCount+' stop'+(next.stopCount===1?'':'s')+' on '+next.sheets.length+' sheet'+(next.sheets.length===1?'':'s')+'.';
  }catch(cause){error(cause instanceof Error?cause.message:'The QR code could not be generated. Try a shorter app address.');}
}

$('sticker-stops').addEventListener('change',event=>{
  const input=event.target;
  if(input.type!=='checkbox')return;
  if(input.checked)selected.add(input.value);else selected.delete(input.value);
  invalidate();count();
});
$('select-visible').addEventListener('click',()=>{for(const stop of visible)selected.add(stop.key);invalidate();renderStops();});
$('clear-stops').addEventListener('click',()=>{selected.clear();invalidate();renderStops();});
$('sticker-route').addEventListener('change',()=>{try{chooseRoute();}catch(cause){error(cause.message);}});
$('sticker-direction').addEventListener('change',renderStops);
$('sticker-search').addEventListener('input',renderStops);
for(const id of ['sticker-address','sticker-copies'])$(id).addEventListener('input',()=>{invalidate();addressNote();});
$('sticker-form').addEventListener('submit',generate);
$('print-sheets').addEventListener('click',()=>{if(plan)window.print();});

try {
  if(!stopDirectory?.routes?.length)throw new Error('The stop directory couldn’t load. Reload this page to try again.');
  for(const route of [...stopDirectory.routes].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}))) {
    const option=node('option','',(route.kind==='trolley'?'Trolley ':'Route ')+route.id);option.value=route.id;$('sticker-route').append(option);
  }
  $('sticker-route').value=stopDirectory.routes.some(route=>route.id==='42')?'42':stopDirectory.routes[0].id;
  try {$('sticker-address').value=stickerLandingURL(new URL('info.html',window.location.href).href);}catch{}
  addressNote();chooseRoute();
}catch(cause){error(cause.message);$('generate-sheets').disabled=true;}
})();
