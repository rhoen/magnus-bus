(() => {
'use strict';
const {stickerStops,stickerURL,planStickerSheets,stickerQR,stopDirectory}=globalThis.MagnusBus;
const $=id=>document.getElementById(id);
const selected=new Set();
let stops=[],allStops=new Map(),visible=[],plan=null,exampleKey='';
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
  const list=document.createDocumentFragment();
  for(const key of selected) {
    const stop=allStops.get(key),item=node('li','selected-stop');
    item.append(node('span','',(stop?.stopName||'Stop')+' · #'+key));
    const remove=node('button','text-button','Remove');remove.type='button';
    remove.setAttribute('aria-label','Remove stop '+key);
    remove.addEventListener('click',()=>{selected.delete(key);invalidate();renderStops();});
    item.append(remove);list.append(item);
  }
  $('selected-stops').replaceChildren(list);
  $('selected-stops-detail').hidden=!selected.size;
  renderExample();
}
function renderStops() {
  const direction=$('sticker-direction').value,query=$('sticker-search').value.trim().toLowerCase();
  const matches=stops.filter(stop=>(direction==='all'||stop.browseServices.some(service=>service.gtfs===direction)) && (stop.stopName+' '+stop.target).toLowerCase().includes(query));
  visible=matches.slice(0,200);
  const fragment=document.createDocumentFragment();
  for(const stop of visible) {
    const label=node('label','stop-choice'),checkbox=node('input');
    checkbox.type='checkbox';checkbox.value=stop.key;checkbox.checked=selected.has(stop.key);
    const text=node('span','stop-choice-name');
    text.append(node('span','',stop.stopName));
    const routes=[...new Set(stop.services.map(service=>service.route))].join(', ');
    const directions=[...new Set(stop.browseServices.map(service=>service.name))].join(' / ');
    text.append(node('small','stop-choice-services','Routes '+routes+' · '+directions));
    label.append(checkbox,text,node('span','stop-choice-id','#'+stop.target));fragment.append(label);
  }
  if(!visible.length)fragment.append(node('p','no-stops',stops.length?'No stops match your search.':'No stops are available for this route in the current directory.'));
  if(matches.length>visible.length)fragment.append(node('p','no-stops','Showing the first 200 of '+matches.length+' stops. Search by name or ID, or narrow the route filter. Select visible stops adds only these 200.'));
  $('sticker-stops').replaceChildren(fragment);count();
}
function chooseRoute() {
  $('sticker-search').value='';
  const routeId=$('sticker-route').value;
  stops=stickerStops(stopDirectory,routeId);
  const all=node('option','',routeId?'Both directions':'All directions');all.value='all';
  $('sticker-direction').replaceChildren(all);
  if(routeId)for(const gtfs of ['0','1']) {
    const first=stops.flatMap(stop=>stop.browseServices).find(service=>service.gtfs===gtfs);
    if(first) {const option=node('option','',first.name+' · '+first.destination);option.value=gtfs;$('sticker-direction').append(option);}
  }
  $('sticker-direction').disabled=!routeId;
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
function createStickerFace(sticker,svg) {
  const face=node('div','public-sticker');
  face.append(node('div','sticker-brand','Magnus’s Bus'),node('h3','sticker-question','Where’s my bus?'));
  const qrLink=node('a','sticker-qr');qrLink.href=sticker.url;qrLink.target='_blank';qrLink.rel='noopener noreferrer';
  qrLink.setAttribute('aria-label','Open all arrivals at '+sticker.stopName+', stop '+sticker.target);
  qrLink.innerHTML=svg;
  qrLink.querySelector('svg').setAttribute('aria-hidden','true');
  face.append(qrLink,node('p','sticker-public-route',sticker.stopName),node('p','sticker-public-stop','Stop #'+sticker.target));
  return face;
}
function renderExample() {
  const stop=allStops.get(selected.values().next().value)||allStops.get('22151')||allStops.values().next().value;
  if(!stop)return;
  try {
    const url=stickerURL($('sticker-address').value,stop),key=url+'|'+stop.stopName;
    if(key!==exampleKey) {
      $('example-sticker').replaceChildren(createStickerFace({...stop,url},stickerQR(url)));
      exampleKey=key;
    }
    $('example-caption').textContent=(selected.size?'Your first selected stop: ':'Example stop: ')+stop.stopName+' · #'+stop.target;
    $('example-link').textContent=url;$('example-link').href=url;$('example-link').hidden=false;
  }catch(cause) {
    exampleKey='';$('example-sticker').replaceChildren();$('example-link').hidden=true;$('example-link').removeAttribute('href');
    $('example-caption').textContent=cause instanceof Error?cause.message:'Enter a shorter app address to preview the QR code.';
  }
}
function renderSheets(next) {
  const fragment=document.createDocumentFragment(),qrCache=new Map();
  next.sheets.forEach((stickers,index)=>{
    const sheet=node('section','sticker-sheet '+next.paper);
    sheet.setAttribute('aria-label','Sheet '+(index+1)+' of '+next.sheets.length);
    const grid=node('div','sticker-grid');
    for(const sticker of stickers) {
      const cell=node('div','sticker-cell');
      if(!qrCache.has(sticker.url))qrCache.set(sticker.url,stickerQR(sticker.url));
      const publicSticker=createStickerFace(sticker,qrCache.get(sticker.url));
      cell.append(publicSticker);grid.append(cell);
    }
    sheet.append(grid);fragment.append(sheet);
  });
  $('sheet-preview').replaceChildren(fragment);
}
function generate(event) {
  event.preventDefault();invalidate();
  try {
    const next=planStickerSheets({directory:stopDirectory,selectedKeys:selected,
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
for(const id of ['sticker-address','sticker-copies'])$(id).addEventListener('input',()=>{invalidate();addressNote();renderExample();});
$('sticker-form').addEventListener('submit',generate);
$('print-sheets').addEventListener('click',()=>{if(plan)window.print();});

try {
  if(!stopDirectory?.routes?.length)throw new Error('The stop directory couldn’t load. Reload this page to try again.');
  allStops=new Map(stickerStops(stopDirectory).map(stop=>[stop.key,stop]));
  const allRoutes=node('option','','All routes');allRoutes.value='';$('sticker-route').append(allRoutes);
  for(const route of [...stopDirectory.routes].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}))) {
    const option=node('option','',(route.kind==='trolley'?'Trolley ':'Route ')+route.id);option.value=route.id;$('sticker-route').append(option);
  }
  $('sticker-route').value='';
  addressNote();chooseRoute();
}catch(cause){error(cause.message);$('generate-sheets').disabled=true;}
})();
