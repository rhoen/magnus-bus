(() => {
'use strict';
const {serviceDate}=globalThis.MagnusBus;
const STICKERS_PER_SHEET=6;

function stickerStops(directory,routeId,now=Date.now()) {
  if(!directory?.routes?.length || !directory?.stops?.length)throw new Error('The stop directory couldn’t load. Reload this page to try again.');
  const route=directory.routes.find(route=>route.id===routeId);
  if(!route)throw new Error('Choose a route from the list.');
  const release=Object.keys(route.releases).filter(date=>date<=serviceDate(now)).sort().at(-1);
  const result=[];
  for(const gtfs of ['0','1']) {
    const direction=route.directions[gtfs],seen=new Set();
    if(!direction)continue;
    for(const index of route.releases[release]?.[gtfs]||[]) {
      const stop=directory.stops[index];
      if(!stop || seen.has(stop[0]))continue;
      seen.add(stop[0]);
      result.push({key:gtfs+':'+stop[0],route:route.id,kind:route.kind,gtfs,target:stop[0],stopName:stop[1],
        name:direction.name,destination:'Toward '+direction.destination});
    }
  }
  return result;
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
  url.search=new URLSearchParams({route:stop.route,stop:stop.target,direction:stop.gtfs}).toString();
  return url.href;
}

function planStickerSheets({directory,routeId,selectedKeys,copies=1,paper='letter',landingURL,now=Date.now()}) {
  if(!['letter','a4'].includes(paper))throw new Error('Choose US Letter or A4 paper.');
  if(!Number.isInteger(copies) || copies<1 || copies>10)throw new Error('Choose between 1 and 10 copies per stop.');
  const base=stickerLandingURL(landingURL),keys=new Set(selectedKeys);
  if(!keys.size)throw new Error('Select at least one stop to make a sticker sheet.');
  const stops=stickerStops(directory,routeId,now).filter(stop=>keys.has(stop.key));
  if(stops.length!==keys.size)throw new Error('Some selected stops are no longer in this route’s current directory. Choose the route again to refresh its stops.');
  if(stops.length*copies>300)throw new Error('Make up to 300 stickers at a time. Select fewer stops or reduce the copies per stop.');
  const stickers=[];
  for(const stop of stops) {
    const url=stickerURL(base,stop);
    for(let copy=1;copy<=copies;copy++)stickers.push({...stop,url,copy,number:stickers.length+1});
  }
  const sheets=[];
  for(let i=0;i<stickers.length;i+=STICKERS_PER_SHEET)sheets.push(stickers.slice(i,i+STICKERS_PER_SHEET));
  return {routeId,paper,copies,stopCount:stops.length,total:stickers.length,sheets,landingURL:base};
}

function stickerQR(url) {
  if(typeof globalThis.qrcode!=='function')throw new Error('The QR encoder couldn’t load. Reload this page to try again.');
  const qr=globalThis.qrcode(0,'Q');
  qr.addData(url,'Byte');qr.make();
  if(qr.getModuleCount()>65)throw new Error('This app address makes the QR code too dense for these stickers. Use a shorter public address.');
  // Keep a four-module quiet zone inside the printed image, away from all labels.
  return qr.createSvgTag({cellSize:2,margin:8,scalable:true});
}

Object.assign(globalThis.MagnusBus,{stickerStops,stickerLandingURL,stickerURL,planStickerSheets,stickerQR,STICKERS_PER_SHEET});
})();
