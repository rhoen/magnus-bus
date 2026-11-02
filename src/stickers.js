(() => {
'use strict';
const {buildStopCatalog,serviceDate}=globalThis.MagnusBus;
const STICKER_SIZES=[2,2.5,3,3.5,4];
function stickerLayout(size=2.5) {
  if(!STICKER_SIZES.includes(size))throw new Error('Choose a sticker size between 2 and 4 inches from the list.');
  const margin=0.3,gap=0.35;
  const columns=Math.floor((8.5-2*margin+gap)/(size+gap));
  const rows=Math.floor((11-2*margin+gap)/(size+gap));
  return {size,margin,gap,columns,rows,perSheet:columns*rows};
}

function stickerStops(directory,routeId='',now=Date.now()) {
  const catalog=buildStopCatalog(directory,now);
  let stops;
  if(routeId) {
    const route=directory.routes.find(route=>route.id===routeId);
    if(!route)throw new Error('Choose a route from the list.');
    const release=Object.keys(route.releases).filter(date=>date<=serviceDate(now)).sort().at(-1);
    const ids=[...new Set(['0','1'].flatMap(gtfs=>(route.releases[release]?.[gtfs]||[]).map(index=>directory.stops[index]?.[0])))];
    stops=ids.map(id=>catalog.get(id)).filter(Boolean);
  } else {
    stops=[...catalog.values()].sort((a,b)=>a.stopName.localeCompare(b.stopName)||a.target.localeCompare(b.target,undefined,{numeric:true}));
  }
  return stops.map(stop=>({...stop,key:stop.target,
    browseServices:stop.services.filter(service=>!routeId||service.route===routeId)}));
}

function stickerLandingURL(value) {
  let url;
  try {url=new URL(value.trim());}catch{throw new Error('Enter the full app address, ending in /info.html.');}
  if(!['https:','http:'].includes(url.protocol) || url.username || url.password || !url.pathname.endsWith('/info.html') || url.search || url.hash) {
    throw new Error('Use an http or https address ending in /info.html, without query parameters, a fragment, or sign-in details.');
  }
  if(url.href.length>240)throw new Error('This app address is too long for these stickers. Use a shorter public address.');
  return url.href;
}

function stickerURL(base,stop) {
  const url=new URL(stickerLandingURL(base));
  url.search=new URLSearchParams({stop:stop.target}).toString();
  return url.href;
}

function planStickerSheets({directory,selectedKeys,copies=1,stickerSize=2.5,landingURL,now=Date.now()}) {
  if(!Number.isInteger(copies) || copies<1 || copies>10)throw new Error('Choose between 1 and 10 copies per stop.');
  const layout=stickerLayout(stickerSize);
  const base=stickerLandingURL(landingURL),keys=new Set(selectedKeys);
  if(!keys.size)throw new Error('Select at least one stop to make a sticker sheet.');
  const catalog=buildStopCatalog(directory,now);
  const stops=[...keys].map(key=>catalog.get(key)).filter(Boolean);
  if(stops.length!==keys.size)throw new Error('Some selected stops are no longer served in the current directory. Clear the selection and choose your stops again.');
  if(stops.length*copies>300)throw new Error('Make up to 300 stickers at a time. Select fewer stops or reduce the copies per stop.');
  const stickers=[];
  for(const stop of stops) {
    const url=stickerURL(base,stop);
    for(let copy=1;copy<=copies;copy++)stickers.push({...stop,url,copy,number:stickers.length+1});
  }
  const sheets=[];
  for(let i=0;i<stickers.length;i+=layout.perSheet)sheets.push(stickers.slice(i,i+layout.perSheet));
  return {paper:'letter',layout,copies,stopCount:stops.length,total:stickers.length,sheets,landingURL:base};
}

function stickerQR(url) {
  if(typeof globalThis.qrcode!=='function')throw new Error('The QR encoder couldn’t load. Reload this page to try again.');
  const qr=globalThis.qrcode(0,'Q');
  qr.addData(url,'Byte');qr.make();
  if(qr.getModuleCount()>65)throw new Error('This app address makes the QR code too dense for these stickers. Use a shorter public address.');
  // Keep a four-module quiet zone inside the printed image, away from all labels.
  return qr.createSvgTag({cellSize:2,margin:8,scalable:true});
}

Object.assign(globalThis.MagnusBus,{stickerStops,stickerLandingURL,stickerURL,planStickerSheets,stickerQR,stickerLayout,STICKER_SIZES});
})();
