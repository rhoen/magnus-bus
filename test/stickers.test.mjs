import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import '../src/directions.js';
import '../src/tracking.js';
import '../src/stop.js';
import '../src/stickers.js';
import '../data/stop-directory.js';

const {stickerStops,stickerLandingURL,stickerURL,planStickerSheets,resolveStopLink,stopDirectory}=globalThis.MagnusBus;
const now=Date.parse('2026-11-02T15:00:00Z');
const base='https://example.com/magnus-bus/info.html';
const options={directory:stopDirectory,routeId:'42',selectedKeys:['0:22120','1:22151'],landingURL:base,now};

test('route stops retain direction-specific identity and directory travel order',()=>{
  const stops=stickerStops(stopDirectory,'42',now);
  assert.ok(stops.length>30);
  assert.equal(new Set(stops.map(s=>s.key)).size,stops.length);
  assert.equal(stops.find(s=>s.key==='0:22120').name,'Eastbound');
  assert.equal(stops.find(s=>s.key==='1:22151').name,'Westbound');
  const route=stopDirectory.routes.find(r=>r.id==='42');
  const release=Object.keys(route.releases).filter(r=>r<='20261102').sort().at(-1);
  assert.deepEqual(stops.filter(s=>s.gtfs==='0').map(s=>s.target),route.releases[release][0].map(i=>stopDirectory.stops[i][0]));
  const shared={stops:[['shared','Shared platform']],routes:[{id:'T2',kind:'trolley',directions:{0:{name:'Eastbound',destination:'East'},1:{name:'Westbound',destination:'West'}},releases:{20261101:{0:[0,0],1:[0]}}}]};
  const trolleys=stickerStops(shared,'T2',now);
  assert.equal(trolleys.length,2);assert.notEqual(trolleys[0].key,trolleys[1].key);
});

test('sticker URLs preserve the published subdirectory and round-trip through the landing page',()=>{
  const plan=planStickerSheets(options);
  for(const sticker of plan.sheets.flat()) {
    const url=new URL(sticker.url);
    assert.equal(url.pathname,'/magnus-bus/info.html');
    assert.equal(url.searchParams.size,3);
    const config=resolveStopLink(url.search,stopDirectory,now);
    assert.equal(config.route,sticker.route);assert.equal(config.target,sticker.target);assert.equal(config.gtfs,sticker.gtfs);
  }
  assert.equal(stickerURL(base,{route:'A B',target:'123&4',gtfs:'0'}),base+'?route=A+B&stop=123%264&direction=0');
});

test('sheet planning keeps route order, repeats copies together, and fills six slots per sheet',()=>{
  const plan=planStickerSheets({...options,selectedKeys:['1:22151','0:22120','0:22120'],copies:4,paper:'a4'});
  assert.equal(plan.stopCount,2);assert.equal(plan.total,8);assert.equal(plan.paper,'a4');
  assert.deepEqual(plan.sheets.map(s=>s.length),[6,2]);
  const stickers=plan.sheets.flat();
  assert.deepEqual(stickers.map(s=>s.number),[1,2,3,4,5,6,7,8]);
  assert.deepEqual(stickers.map(s=>s.copy),[1,2,3,4,1,2,3,4]);
  assert.deepEqual(stickers.slice(0,4).map(s=>s.gtfs),['0','0','0','0']);
  const six=planStickerSheets({...options,copies:3});
  assert.equal(six.sheets.length,1);assert.equal(six.sheets[0].length,6);
});

test('invalid addresses, quantities, and selections cannot generate printable stickers',()=>{
  for(const landingURL of ['', '/info.html','file:///tmp/info.html','javascript:alert(1)',
    'https://user:pass@example.com/info.html',base+'?route=42',base+'#stop','https://example.com/stop.html',
    'https://example.com/'+('x'.repeat(250))+'/info.html'])assert.throws(()=>stickerLandingURL(landingURL));
  assert.equal(stickerLandingURL(' '+base+' '),base);
  assert.equal(stickerLandingURL('http://localhost:3000/info.html'),'http://localhost:3000/info.html');
  for(const copies of [0,-1,1.5,11,NaN,Infinity])assert.throws(()=>planStickerSheets({...options,copies}));
  for(const selectedKeys of [[],['1:22120'],['0:fake']])assert.throws(()=>planStickerSheets({...options,selectedKeys}));
  assert.throws(()=>planStickerSheets({...options,paper:'unknown'}));
  assert.throws(()=>planStickerSheets({...options,directory:null}),/directory/);
  assert.throws(()=>planStickerSheets({...options,routeId:'unknown'}),/route/);
  assert.throws(()=>planStickerSheets({...options,selectedKeys:stickerStops(stopDirectory,'42',now).map(s=>s.key),copies:10}),/300/);
});

test('expired route selections are revalidated at generation time',()=>{
  const directory={stops:[['old','Old stop'],['new','New stop']],routes:[{id:'42',kind:'bus',
    directions:{0:{name:'Eastbound',destination:'Terminal'}},releases:{20261001:{0:[0]},20261102:{0:[1]}}}]};
  assert.equal(stickerStops(directory,'42',Date.parse('2026-11-01T15:00:00Z'))[0].target,'old');
  assert.equal(stickerStops(directory,'42',now)[0].target,'new');
  assert.throws(()=>planStickerSheets({...options,directory,selectedKeys:['0:old']}),/no longer/);
  assert.equal(stickerStops(directory,'42',Date.parse('2026-09-01')).length,0);
});

test('vendored QR encoder produces scalable black-on-white SVG with a four-module quiet zone',async()=>{
  const context=vm.createContext({MagnusBus:{},URL,URLSearchParams});
  vm.runInContext(await readFile(new URL('../vendor/qrcode.js',import.meta.url),'utf8'),context);
  vm.runInContext(await readFile(new URL('../src/stickers.js',import.meta.url),'utf8'),context);
  const svg=context.MagnusBus.stickerQR(base+'?route=42&stop=22120&direction=0');
  assert.match(svg,/<svg/);assert.match(svg,/fill="white"/);assert.match(svg,/fill="black"/);
  assert.doesNotMatch(svg,/<script|<image|href=|width="\d+px"/);
  const size=Number(svg.match(/viewBox="0 0 (\d+)/)[1]);
  const cells=[...svg.matchAll(/M(\d+),(\d+)l2,0 0,2 -2,0 0,-2z/g)].map(m=>[Number(m[1]),Number(m[2])]);
  assert.ok(cells.length>100);
  assert.equal(Math.min(...cells.flat()),8);
  assert.equal(Math.max(...cells.flat()),size-10);
  assert.ok((size-16)/2<=65);
  assert.throws(()=>context.MagnusBus.stickerQR('x'.repeat(1000)),/too dense/);
  context.qrcode=undefined;
  assert.throws(()=>context.MagnusBus.stickerQR(base),/encoder couldn’t load/);
});
