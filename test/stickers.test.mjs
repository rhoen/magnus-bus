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
const options={directory:stopDirectory,selectedKeys:['22120','22151'],landingURL:base,now};

test('route browsing deduplicates shared stop IDs while keeping every serving route and direction',()=>{
  const stops=stickerStops(stopDirectory,'42',now);
  assert.ok(stops.length>30);
  assert.equal(new Set(stops.map(s=>s.key)).size,stops.length);
  assert.equal(stops.find(s=>s.key==='22120').browseServices[0].name,'Eastbound');
  assert.equal(stops.find(s=>s.key==='22151').browseServices[0].name,'Westbound');
  assert.ok(stops.find(s=>s.key==='22151').services.length>1);
  const shared={stops:[['shared','Shared platform']],routes:[{id:'T2',kind:'trolley',directions:{0:{name:'Eastbound',destination:'East'},1:{name:'Westbound',destination:'West'}},releases:{20261101:{0:[0,0],1:[0]}}}]};
  const trolleys=stickerStops(shared,'T2',now);
  assert.equal(trolleys.length,1);assert.equal(trolleys[0].browseServices.length,2);
  assert.ok(stickerStops(stopDirectory,'',now).length>stops.length);
});

test('finding a shared stop through different routes always gives the same URL and one sticker',()=>{
  const via42=stickerStops(stopDirectory,'42',now).find(s=>s.target==='22151');
  const viaT2=stickerStops(stopDirectory,'T2',now).find(s=>s.target==='22151');
  assert.ok(via42&&viaT2);assert.equal(via42.key,viaT2.key);
  assert.equal(stickerURL(base,via42),stickerURL(base,viaT2));
  const plan=planStickerSheets({...options,selectedKeys:[via42.key,viaT2.key]});
  assert.equal(plan.total,1);assert.equal(plan.stopCount,1);
});

test('sticker URLs preserve the published subdirectory and round-trip through the landing page',()=>{
  const plan=planStickerSheets(options);
  for(const sticker of plan.sheets.flat()) {
    const url=new URL(sticker.url);
    assert.equal(url.pathname,'/magnus-bus/info.html');
    assert.equal(url.searchParams.size,1);
    const config=resolveStopLink(url.search,stopDirectory,now);
    assert.equal(config.target,sticker.target);assert.deepEqual(config.services,sticker.services);
  }
  assert.equal(stickerURL(base,{route:'A B',target:'123&4',gtfs:'0'}),base+'?stop=123%264');
});

test('sheet planning keeps selection order, repeats copies together, and fills six slots per sheet',()=>{
  const plan=planStickerSheets({...options,selectedKeys:['22151','22120','22120'],copies:4});
  assert.equal(plan.stopCount,2);assert.equal(plan.total,8);assert.equal(plan.paper,'letter');
  assert.deepEqual(plan.sheets.map(s=>s.length),[6,2]);
  const stickers=plan.sheets.flat();
  assert.deepEqual(stickers.map(s=>s.number),[1,2,3,4,5,6,7,8]);
  assert.deepEqual(stickers.map(s=>s.copy),[1,2,3,4,1,2,3,4]);
  assert.deepEqual(stickers.slice(0,4).map(s=>s.target),['22151','22151','22151','22151']);
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
  for(const selectedKeys of [[],['unknown'],['0:22120']])assert.throws(()=>planStickerSheets({...options,selectedKeys}));
  assert.throws(()=>planStickerSheets({...options,directory:null}),/directory/);
  assert.throws(()=>stickerStops(stopDirectory,'unknown',now),/route/);
  assert.throws(()=>planStickerSheets({...options,selectedKeys:stickerStops(stopDirectory,'42',now).map(s=>s.key),copies:10}),/300/);
});

test('expired route selections are revalidated at generation time',()=>{
  const directory={stops:[['old','Old stop'],['new','New stop']],routes:[{id:'42',kind:'bus',
    directions:{0:{name:'Eastbound',destination:'Terminal'}},releases:{20261001:{0:[0]},20261102:{0:[1]}}}]};
  assert.equal(stickerStops(directory,'42',Date.parse('2026-11-01T15:00:00Z'))[0].target,'old');
  assert.equal(stickerStops(directory,'42',now)[0].target,'new');
  assert.throws(()=>planStickerSheets({...options,directory,selectedKeys:['old']}),/no longer/);
  assert.equal(stickerStops(directory,'42',Date.parse('2026-09-01')).length,0);
});

test('vendored QR encoder produces scalable black-on-white SVG with a four-module quiet zone',async()=>{
  const context=vm.createContext({MagnusBus:{},URL,URLSearchParams});
  vm.runInContext(await readFile(new URL('../vendor/qrcode.js',import.meta.url),'utf8'),context);
  vm.runInContext(await readFile(new URL('../src/stickers.js',import.meta.url),'utf8'),context);
  const svg=context.MagnusBus.stickerQR(base+'?stop=22120');
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
