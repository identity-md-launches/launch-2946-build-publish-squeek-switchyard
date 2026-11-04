// Optional Playwright validation of the actual static export. No test data ships in the app.
// Set IMD_PLAYWRIGHT to an installed playwright/index.mjs, or install Playwright for development.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { API_URL, selectBoard, solve, capacitiesFor } from '../src/rules.js';

const playwright = await import(process.env.IMD_PLAYWRIGHT ? pathToFileURL(process.env.IMD_PLAYWRIGHT).href : 'playwright');
const out = new URL('./scratch/browser-checks/', import.meta.url);
await mkdir(out, {recursive:true});
const results = [];
const record = (engine, check, status, detail) => {
  const result = {engine, check, status, detail};
  results.push(result);
  console.log(JSON.stringify(result));
};
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png'};
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const name = pathname === '/preview/' ? 'index.html' : pathname.slice('/preview/'.length);
  if (!pathname.startsWith('/preview/') || !/^[\w.-]+$/.test(name)) return res.writeHead(404).end();
  try {
    const body = await readFile(new URL('../dist/' + name, import.meta.url));
    res.writeHead(200, {'content-type':types[extname(name)] ?? 'application/octet-stream'}).end(body);
  } catch {res.writeHead(404).end();}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const viewport = {width:390, height:844};

// Deliberately synthetic API-shaped data, only for deterministic interaction tests.
const fixture = {
  status:'available', chain:{chainId:'11155111'},
  recentSettlements:[48,41,44,41,45].map((blocks, i) => ({
    confirmationStatus:'safe', transactionHash:`0x${String(i + 1).padStart(64, '0')}`,
    logIndex:String(i), completedBlockCount:String(blocks), previousSettledThroughRound:String(i * 2),
    settledThroughRound:String(i * 2 + 2), ...(i === 0 ? {} : {workAdded:'0'}),
  })),
};

async function snapshot(page) {
  return page.locator('#manifest').innerText();
}
async function finish(page, routing = ['1','2','1','2','3']) {
  for (const key of routing) await page.keyboard.press(key);
  await page.locator('#result').waitFor({state:'visible'});
}
async function noOverflow(page) {
  const layout = await page.evaluate(() => ({
    width:innerWidth, scroll:document.documentElement.scrollWidth,
    outside:[...document.querySelectorAll('body *')].filter(el=>{
      const r=el.getBoundingClientRect(); return r.width && r.right>innerWidth+1;
    }).slice(0,8).map(el=>({tag:el.tagName,class:el.className,text:el.textContent.slice(0,80)})),
  }));
  assert.ok(layout.scroll <= layout.width, `horizontal overflow: ${JSON.stringify(layout)}`);
}

async function measureContrast(page) {
  return page.evaluate(() => {
    const luminance = rgb => rgb.map(c=>c/255).map(c=>c<=0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4).reduce((n,c,i)=>n+c*[0.2126,0.7152,0.0722][i],0);
    return [...document.querySelectorAll('body, .lede, .send, .tunnel-facts dt, .tunnel[data-state="over"] .tunnel-state, #practice-banner')]
      .filter(el=>el.getBoundingClientRect().height && !el.disabled).map(el=>{
        const foreground = getComputedStyle(el).color;
        let background, ancestor = el;
        while(ancestor) {
          const color=getComputedStyle(ancestor).backgroundColor;
          if(color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {background=color;break;}
          ancestor=ancestor.parentElement;
        }
        const fg=luminance(foreground.match(/[\d.]+/g).slice(0,3).map(Number));
        const bg=luminance(background.match(/[\d.]+/g).slice(0,3).map(Number));
        return {element:el.className || el.tagName,foreground,background,ratio:Number(((Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05)).toFixed(2))};
      });
  });
}

try {
  for (const name of (process.env.BROWSER_ENGINES ?? 'chromium,webkit').split(',')) {
    let browser;
    try {
      browser = await playwright[name].launch({headless:true, ...(name === 'chromium' && process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})});
    } catch(error) {
      record(name,'browser runtime','unavailable',error.message.split('\n').slice(0,5).join('\n'));
      continue;
    }
    try {
      // First try the unchanged public GET in a real browser. No API interception here.
      const liveContext = await browser.newContext({viewport, ...(process.env.HTTP_PROXY ? {proxy:{server:process.env.HTTP_PROXY,bypass:'127.0.0.1,localhost'}} : {})});
      const live = await liveContext.newPage();
      let livePayload;
      let apiStatus;
      live.on('response', async response => {
        if (response.url() !== API_URL) return;
        apiStatus = response.status();
        try {livePayload = await response.json();} catch {}
      });
      await live.goto(url);
      await live.waitForFunction(() => !document.querySelector('#view-game').hidden || !document.querySelector('#view-unavailable').hidden, null, {timeout:15000});
      if (await live.locator('#view-game').isVisible()) {
        const selected = selectBoard(livePayload);
        assert.ok(selected.ok, 'live payload selectable');
        const frozen = await snapshot(live);
        for (const wagon of selected.board.wagons) assert.ok(frozen.includes(wagon.txHash));
        await finish(live);
        const expected = solve(selected.board.wagons.map(w=>w.blocks), capacitiesFor(selected.board.wagons.map(w=>w.blocks)));
        assert.equal(await live.locator('#result-best').innerText(), `${expected.best.toLocaleString('en-US')} blocks`);
        await live.locator('#undo').click();
        assert.ok(await live.locator('#result').isHidden());
        await live.keyboard.press('3');
        await live.locator('#replay').click();
        assert.equal((await live.locator('#train [data-state="sent"]').count()),0);
        assert.equal((await snapshot(live)).replaceAll('Not sent yet',''),frozen.replaceAll('Not sent yet',''));
        await finish(live);
        await live.screenshot({path:new URL(`${name}-live-result.png`,out).pathname,fullPage:true});
        record(name,'real live game, undo and replay','passed',{apiStatus,confirmationStatus:[...new Set(livePayload.recentSettlements.map(r=>r.confirmationStatus))],blocks:selected.board.wagons.map(w=>String(w.blocks)),best:String(expected.best)});
      } else {
        record(name,'real live game','unavailable',{apiStatus,reason:await live.locator('#unavailable-reason').innerText()});
      }
      await liveContext.close();

      const context = await browser.newContext({viewport,hasTouch:true,isMobile:true});
      const page = await context.newPage();
      const scriptErrors = [];
      const resourceErrors = [];
      let requests = 0;
      page.on('pageerror', error => scriptErrors.push(error.message));
      page.on('response', response => {if(response.url().startsWith(url) && response.status() >= 400) resourceErrors.push(response.url());});
      await page.clock.install();
      let mode = 'fixture';
      let release;
      await page.route(API_URL, async route => {
        requests += 1;
        assert.equal(route.request().method(),'GET');
        if(mode === 'pending') {await new Promise(resolve => {release = resolve;}); return route.abort();}
        if(mode === 'offline') return route.abort();
        if(mode === 'http-error') return route.fulfill({status:503,body:'Unavailable'});
        return route.fulfill({contentType:'application/json', body:JSON.stringify(mode === 'short' ? {...fixture,recentSettlements:fixture.recentSettlements.slice(0,4)} : fixture)});
      });
      await page.goto(url);
      await page.locator('#view-game').waitFor({state:'visible'});
      assert.equal(await page.locator('#manifest a').count(),5);
      assert.equal(await page.locator('#current-work').innerText(),'unknown');
      assert.deepEqual(await page.locator('.tunnel-facts > div:nth-child(2) dd').allTextContents(),['98','72','49']);
      await page.evaluate(()=>scrollTo(0,0));
      for(const send of await page.locator('.send').all()) {
        const box = await send.boundingBox();
        assert.ok(box.height >= 44 && box.y + box.height <= 844,'primary actions visible and comfortable at 390');
      }
      await page.screenshot({path:new URL(`${name}-api-fixture-390.png`,out).pathname});
      const liveContrast = await measureContrast(page);
      assert.ok(liveContrast.every(pair=>pair.ratio>=4.5));
      await page.clock.runFor(40000);
      assert.equal(await page.locator('#clock').innerText(),'0:00','clock waits for first dispatch');
      await page.keyboard.press('1');
      assert.equal(await page.locator('#current-work').innerText(),'0','reported zero preserved');
      await page.keyboard.press('u');
      assert.equal(await page.locator('#train [data-state="sent"]').count(),0,'mid-game Undo restores the first wagon');
      await page.keyboard.press('1');
      await page.clock.runFor(30000);
      await finish(page,['2','1','2','3']);
      assert.equal(await page.locator('#result-title').innerText(),'Your overflow: 10 blocks');
      assert.equal(await page.locator('#result-best').innerText(),'10 blocks');
      assert.deepEqual(await page.locator('#result-routing td:last-child').allTextContents(),['A','B','A','B','C']);
      assert.equal(await page.locator('#result-time').innerText(),'0:30, under a minute');
      assert.ok(await page.locator('#result-note').innerText().then(t=>t.includes('243 routings')));
      assert.equal(await page.locator('#result-title').evaluate(el=>document.activeElement===el),true);
      const sizes = await page.evaluate(()=>({title:parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),result:parseFloat(getComputedStyle(document.querySelector('#result-title')).fontSize)}));
      assert.ok(sizes.title > sizes.result);
      await page.clock.runFor(40000);
      await page.locator('#undo').click();
      assert.equal(await page.locator('#clock').innerText(),'0:30','result reading excluded after Undo');
      assert.ok(await page.locator('#result').isHidden());
      await page.clock.runFor(5000);
      await page.keyboard.press('3');
      assert.equal(await page.locator('#result-time').innerText(),'0:35, under a minute');
      await page.clock.runFor(40000);
      await page.keyboard.press('u');
      await page.keyboard.press('3');
      assert.equal(await page.locator('#result-time').innerText(),'0:35, under a minute','repeated undo excludes every pause');
      assert.equal(requests,1,'dispatch and undo never refetch');
      record(name,'mock API game and timer regression','passed',{capacities:[98,72,49],best:10,initial:'0:30',afterUndo:'0:35',headings:sizes});

      const receiptLinks = await page.locator('#manifest a').evaluateAll(links=>links.map(a=>a.href));
      await page.keyboard.press('r');
      assert.equal(await page.locator('#clock').innerText(),'0:00');
      assert.equal(await page.locator('#undo').isDisabled(),true);
      assert.deepEqual(await page.locator('#manifest a').evaluateAll(links=>links.map(a=>a.href)),receiptLinks);
      await page.clock.runFor(30000);
      assert.equal(await page.locator('#clock').innerText(),'0:00');
      await page.locator('#shortcuts').uncheck();
      await page.keyboard.press('1');
      assert.equal(await page.locator('#train [data-state="sent"]').count(),0);
      await page.locator('#shortcuts').check();
      await page.locator('.send').first().focus();
      await page.screenshot({path:new URL(`${name}-keyboard-focus.png`,out).pathname});
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      await page.keyboard.press('1');
      assert.equal(await page.locator('#train [data-state="sent"]').count(),3);
      const progress = await snapshot(page);
      mode = 'pending';
      await page.keyboard.press('n');
      await page.waitForFunction(()=>document.querySelector('#refresh-status').textContent.includes('Fetching'));
      assert.ok(await page.locator('#view-game').isVisible());
      assert.equal(await snapshot(page),progress,'board preserved during refresh');
      // Route promises start asynchronously; wait for the pending GET without a timer.
      for(let i=0;!release && i<100;i++) await page.evaluate(()=>new Promise(requestAnimationFrame));
      assert.ok(release,'pending GET began');
      release();
      await page.waitForFunction(()=>document.querySelector('#refresh-status').textContent.includes('Could not refresh'));
      assert.equal(await snapshot(page),progress,'failed refresh preserves assignments and receipts');
      assert.equal(await page.locator('#unavailable-title').isVisible(),false);
      mode = 'http-error';
      await page.locator('#new-game').click();
      await page.waitForFunction(()=>document.querySelector('#refresh-status').textContent.includes('HTTP 503'));
      assert.equal(await snapshot(page),progress);
      mode = 'short';
      await page.locator('#new-game').click();
      await page.waitForFunction(()=>document.querySelector('#refresh-status').textContent.includes('4 qualify'));
      assert.equal(await snapshot(page),progress);
      mode = 'fixture';
      await page.locator('#new-game').click();
      await page.locator('#refresh-status').waitFor({state:'hidden'});
      assert.equal(await page.locator('#train [data-state="sent"]').count(),0);
      assert.equal(await page.locator('#clock').innerText(),'0:00');
      record(name,'replay, keyboard, pending/failed/successful refresh','passed','Same board and receipts on replay; shortcuts toggle; Enter/Space/Tab; network, HTTP 503 and insufficient-row failures retain three assignments; successful GET replaces game.');

      mode = 'short';
      await page.reload();
      await page.locator('#view-unavailable').waitFor({state:'visible'});
      assert.match(await page.locator('#unavailable-reason').innerText(),/4 qualify/);
      mode = 'offline';
      await page.locator('#retry').click();
      await page.waitForFunction(()=>document.querySelector('#unavailable-reason').textContent.includes('could not be reached'));
      await page.locator('#practice').click();
      assert.equal(await page.locator('body').getAttribute('data-board'),'practice');
      assert.ok(await page.locator('#practice-banner').isVisible());
      assert.equal(await page.locator('#manifest a').count(),0);
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:new URL(`${name}-practice-390.png`,out).pathname});
      const practiceContrast = await measureContrast(page);
      assert.ok(practiceContrast.every(pair=>pair.ratio>=4.5));
      await finish(page);
      assert.equal(await page.locator('#result-title').innerText(),'Your overflow: 10 blocks');
      assert.equal(await page.locator('#result-best').innerText(),'10 blocks');
      await page.locator('#undo').click();
      await page.keyboard.press('3');
      await page.locator('#replay').click();
      for (const tunnel of [0,0,1,1,2]) await page.locator('.send').nth(tunnel).tap();
      assert.equal(await page.locator('#result-title').innerText(),'Your overflow: 13 blocks');
      assert.equal(await page.locator('#result-best').innerText(),'10 blocks');
      assert.match(await page.locator('#result-verdict').innerText(),/3 blocks above/);
      await page.locator('#replay').click();
      await finish(page);
      await page.screenshot({path:new URL(`${name}-practice-result.png`,out).pathname,fullPage:true});
      record(name,'practice fallback, completion, undo and replay','passed','Both initial network failure and four eligible rows offer Practice; fixed board [48,41,44,41,45], visibly distinct; best 10.');

      for (const width of [320,390,768,1440]) {
        await page.setViewportSize({width,height:844});
        await noOverflow(page);
      }
      await page.setViewportSize(viewport);
      await page.emulateMedia({reducedMotion:'reduce'});
      assert.equal(await page.locator('.send').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
      await page.evaluate(()=>document.documentElement.style.fontSize='200%');
      await page.screenshot({path:new URL(`${name}-text-200.png`,out).pathname,fullPage:true});
      await noOverflow(page);
      await page.evaluate(()=>document.documentElement.style.fontSize='');
      assert.deepEqual(scriptErrors,[]);
      assert.deepEqual(resourceErrors,[]);
      record(name,'responsive, text enlargement, reduced motion, resources','passed','No horizontal overflow at 320/390/768/1440 and 200% text enlargement at 390; transitions off with reduced motion; no page errors or failed local resources.');
      record(name,'rendered contrast','passed',{apiFixture:liveContrast,practice:practiceContrast});
      await context.close();
    } catch(error) {
      record(name,'interaction validation','failed',error.stack);
      process.exitCode = 1;
    } finally {await browser.close();}
  }
} finally {
  await new Promise(resolve => server.close(resolve));
  await writeFile(new URL('results.json',out),JSON.stringify(results,null,2));
}
