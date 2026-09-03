import { Firestore, FieldValue, Timestamp } from '@google-cloud/firestore';
import { chromium } from 'playwright';

// A autenticação vem do GitHub OIDC -> Workload Identity Federation.
// Não existe chave JSON e não existe FIREBASE_SERVICE_ACCOUNT.
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'portifoleo-817ad';
const db = new Firestore({ projectId: PROJECT_ID });
const targetUid = String(process.env.TARGET_UID || '').trim();
const now = Date.now();
const MAX_PAGES = Number(process.env.ML_MAX_PAGES || 50);

const norm = s => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const targetMlb = s => (String(s || '').toUpperCase().match(/MLB\d{6,}/) || [])[0] || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = arr => {
  const a = arr.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};

async function resolveTarget(mlb) {
  const target = { mlb, userProductId: null, catalogProductId: null, sellerId: null, title: '' };
  try {
    const r = await fetch(`https://api.mercadolibre.com/items/${mlb}`);
    if (!r.ok) return target;
    const j = await r.json();
    target.title = j.title || '';
    target.sellerId = j.seller_id || null;
    target.catalogProductId = j.catalog_product_id || null;
    target.userProductId = j.user_product_id || null;
  } catch {}
  return target;
}

async function pageCards(page) {
  return await page.evaluate(() => {
    const selectors = [
      'li.ui-search-layout__item',
      'div.ui-search-result',
      'div.poly-card',
      'li[class*="ui-search-layout__item"]'
    ];
    let nodes = [];
    for (const s of selectors) {
      const n = [...document.querySelectorAll(s)];
      if (n.length >= 5) { nodes = n; break; }
    }
    if (!nodes.length) {
      nodes = [...document.querySelectorAll('li.ui-search-layout__item,div.poly-card,div.ui-search-result')];
    }

    return nodes.map((el, index) => {
      const titleEl = el.querySelector('.poly-component__title,.ui-search-item__title,h2,h3');
      const title = (titleEl?.textContent || '').trim();
      const hrefs = [...el.querySelectorAll('a[href]')].map(a => a.href);
      const raw = el.outerHTML || '';
      const mlbs = [...new Set((raw.match(/MLB\d{6,}/gi) || []).map(x => x.toUpperCase()))];
      const mlbus = [...new Set((raw.match(/MLBU\d{6,}/gi) || []).map(x => x.toUpperCase()))];
      const leaves = [...el.querySelectorAll('span,small,div,p')]
        .filter(x => x.children.length === 0)
        .map(x => (x.textContent || '').trim())
        .filter(Boolean);
      const aria = [...el.querySelectorAll('[aria-label],[title]')]
        .flatMap(x => [x.getAttribute('aria-label') || '', x.getAttribute('title') || '']);
      const adTokens = [...leaves, ...aria];
      const isAd = adTokens.some(t => /^(ad|patrocinado|publicidade|sponsored)$/i.test(t)) ||
        adTokens.some(t => /^an[uú]ncio patrocinado$/i.test(t));
      return { index, title, hrefs, mlbs, mlbus, isAd };
    });
  });
}

function matchCard(card, target) {
  if (card.mlbs.includes(target.mlb)) return true;
  if (card.hrefs.some(h => String(h).toUpperCase().includes(target.mlb))) return true;
  if (target.userProductId && card.mlbus.includes(String(target.userProductId).toUpperCase())) return true;
  if (target.userProductId && card.hrefs.some(h => String(h).toUpperCase().includes(String(target.userProductId).toUpperCase()))) return true;

  // Último fallback apenas quando o card não expõe ID útil.
  if (!card.mlbs.length && !card.mlbus.length && target.title && card.title && norm(card.title) === norm(target.title)) {
    return true;
  }
  return false;
}

async function prepareContext(browser) {
  const context = await browser.newContext({
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1365, height: 900 },
    geolocation: { latitude: -23.5505, longitude: -46.6333 },
    permissions: ['geolocation'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' }
  });

  await context.route('**/*', route => {
    const type = route.request().resourceType();
    if (type === 'image' || type === 'media' || type === 'font') return route.abort();
    return route.continue();
  });
  return context;
}

async function scanOnce(browser, keyword, mlb, onProgress) {
  const target = await resolveTarget(mlb);
  const context = await prepareContext(browser);
  const page = await context.newPage();
  let generalChecked = 0;
  let organicChecked = 0;
  let adChecked = 0;
  let adHit = null;

  try {
    const slug = encodeURIComponent(keyword.trim()).replace(/%20/g, '-');
    await page.goto(`https://lista.mercadolivre.com.br/${slug}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    for (let p = 1; p <= MAX_PAGES; p++) {
      await page.waitForSelector('li.ui-search-layout__item,.poly-card,.ui-search-result', { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
      await page.waitForTimeout(450);

      const body = await page.locator('body').innerText().catch(() => '');
      if (/captcha|verifique sua identidade|n[aã]o sou um rob[oô]|seguran[cç]a/i.test(body)) {
        throw new Error('Mercado Livre exibiu tela de segurança/CAPTCHA.');
      }

      const cards = await pageCards(page);
      if (!cards.length) throw new Error(`Página ${p}: nenhum card lido.`);

      for (const card of cards) {
        const generalPosition = generalChecked + 1;
        if (card.isAd) {
          adChecked++;
          if (!adHit && matchCard(card, target)) {
            adHit = {
              generalPosition,
              adsPosition: adChecked,
              page: p,
              title: target.title || card.title
            };
          }
        } else {
          organicChecked++;
          if (matchCard(card, target)) {
            const result = {
              found: true,
              organicFound: true,
              adFound: !!adHit,
              generalPosition,
              organicPosition: organicChecked,
              adsPosition: adHit?.adsPosition || null,
              adGeneralPosition: adHit?.generalPosition || null,
              adsBefore: adChecked,
              page: p,
              adPage: adHit?.page || null,
              checked: generalPosition,
              title: target.title || card.title
            };
            await onProgress?.({ page: p, checked: generalPosition });
            return result;
          }
        }
        generalChecked++;
      }

      await onProgress?.({ page: p, checked: generalChecked });

      const next = page.locator(
        'a[title="Seguinte"][data-andes-pagination-control="next"],li.andes-pagination__button--next a,button[aria-label*="Seguinte"]'
      ).first();

      if (!(await next.count())) break;
      const disabled = await next.getAttribute('aria-disabled').catch(() => null);
      if (disabled === 'true') break;

      const sig = cards.slice(0, 4)
        .map(c => c.title + '|' + c.mlbs.join(',') + '|' + c.mlbus.join(','))
        .join(';;');
      const href = await next.getAttribute('href').catch(() => null);

      try {
        await next.scrollIntoViewIfNeeded();
        await next.click({ timeout: 7000, force: true });
      } catch {
        if (href) await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 45000 });
        else break;
      }

      await page.waitForFunction(old => {
        const list = [...document.querySelectorAll('li.ui-search-layout__item,.poly-card,.ui-search-result')]
          .slice(0, 4)
          .map(e => (e.querySelector('.poly-component__title,.ui-search-item__title,h2,h3')?.textContent || '').trim())
          .join(';;');
        return list && list !== old;
      }, sig, { timeout: 14000 }).catch(() => {});
    }

    if (adHit) {
      return {
        found: true,
        organicFound: false,
        adFound: true,
        generalPosition: adHit.generalPosition,
        organicPosition: null,
        adsPosition: adHit.adsPosition,
        adGeneralPosition: adHit.generalPosition,
        adsBefore: Math.max(0, adHit.adsPosition - 1),
        page: adHit.page,
        checked: generalChecked,
        title: adHit.title
      };
    }

    return {
      found: false,
      organicFound: false,
      adFound: false,
      generalPosition: null,
      organicPosition: null,
      adsPosition: null,
      adsBefore: adChecked,
      page: null,
      checked: generalChecked,
      title: target.title || ''
    };
  } finally {
    await context.close();
  }
}

function aggregate(samples) {
  const found = samples.filter(x => x.found);
  const organic = samples.filter(x => x.organicFound && Number.isFinite(x.organicPosition));
  const ads = samples.filter(x => x.adFound && Number.isFinite(x.adsPosition));
  const generalSource = organic.length ? organic : found;
  const generalPositions = generalSource.map(x => x.generalPosition).filter(Number.isFinite);
  const organicPositions = organic.map(x => x.organicPosition).filter(Number.isFinite);
  const adPositions = ads.map(x => x.adsPosition).filter(Number.isFinite);

  return {
    found: found.length > 0,
    organicFound: organic.length > 0,
    adFound: ads.length > 0,
    referenceGeneralPosition: median(generalPositions),
    referenceOrganicPosition: median(organicPositions),
    referenceAdsPosition: median(adPositions),
    referenceMin: generalPositions.length ? Math.min(...generalPositions) : null,
    referenceMax: generalPositions.length ? Math.max(...generalPositions) : null,
    foundRuns: found.length,
    organicRuns: organic.length,
    adRuns: ads.length,
    sampleCount: samples.length,
    samples,
    page: organic[0]?.page || ads[0]?.page || null,
    checked: Math.max(0, ...samples.map(x => Number(x.checked) || 0)),
    title: samples.find(x => x.title)?.title || ''
  };
}

async function collectTasks() {
  const tasks = [];

  const qSnap = await db.collectionGroup('queue').get();
  for (const d of qSnap.docs) {
    const x = d.data();
    if (x.status !== 'pending') continue;
    const userRef = d.ref.parent.parent;
    if (!userRef) continue;
    const uid = userRef.id;
    if (targetUid && uid !== targetUid) continue;

    tasks.push({
      uid,
      adId: x.adId,
      keywordId: x.keywordId,
      keyword: x.keyword,
      queueRef: d.ref,
      requestedRuns: Math.min(3, Math.max(1, Number(x.requestedRuns) || 1))
    });
  }
  if (tasks.length) return tasks.slice(0, 16);

  const kSnap = await db.collectionGroup('keywords').get();
  for (const d of kSnap.docs) {
    const x = d.data();
    if (!x.autoEnabled) continue;
    const next = x.nextScanAt?.toMillis?.() || 0;
    if (next > now) continue;

    const adRef = d.ref.parent.parent;
    const userRef = adRef?.parent?.parent;
    if (!adRef || !userRef) continue;
    const uid = userRef.id;
    if (targetUid && uid !== targetUid) continue;

    tasks.push({
      uid,
      adId: adRef.id,
      keywordId: d.id,
      keyword: x.keyword,
      queueRef: null,
      requestedRuns: Number(x.autoRuns) === 3 ? 3 : 1
    });
  }
  return tasks.slice(0, 16);
}

async function run() {
  const tasks = await collectTasks();
  console.log(`Projeto Firestore: ${PROJECT_ID}`);
  console.log(`Tarefas: ${tasks.length}`);
  if (!tasks.length) return;

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage']
  });

  try {
    for (const task of tasks) {
      const { uid, adId, keywordId, keyword, queueRef, requestedRuns } = task;
      const kwRef = db.doc(`users/${uid}/ads/${adId}/keywords/${keywordId}`);
      const adRef = db.doc(`users/${uid}/ads/${adId}`);

      if (queueRef) {
        await queueRef.set({
          status: 'running',
          startedAt: FieldValue.serverTimestamp(),
          progressPage: 1,
          progressChecked: 0
        }, { merge: true });
      }

      try {
        const before = (await kwRef.get()).data() || {};
        const samples = [];

        for (let i = 0; i < requestedRuns; i++) {
          const result = await scanOnce(browser, keyword, targetMlb(adId), async p => {
            if (queueRef) {
              await queueRef.set({
                progressPage: p.page,
                progressChecked: p.checked,
                run: i + 1
              }, { merge: true });
            }
          });
          samples.push(result);
          if (i < requestedRuns - 1) await sleep(700);
        }

        const agg = aggregate(samples);
        const checkedAt = Timestamp.now();
        const prevOrg = Number(before.referenceOrganicPosition) || null;
        const prevGen = Number(before.referenceGeneralPosition) || null;
        const deltaOrganic = prevOrg && agg.referenceOrganicPosition ? prevOrg - agg.referenceOrganicPosition : null;
        const deltaGeneral = prevGen && agg.referenceGeneralPosition ? prevGen - agg.referenceGeneralPosition : null;
        const freq = Number(before.frequencyHours || 24);
        const nextScanAt = Timestamp.fromMillis(Date.now() + freq * 3600_000);

        const latest = {
          lastCheckedAt: checkedAt,
          nextScanAt,
          requestedRuns,
          latestFound: agg.found,
          referenceGeneralPosition: agg.referenceGeneralPosition,
          referenceOrganicPosition: agg.referenceOrganicPosition,
          referenceAdsPosition: agg.referenceAdsPosition,
          referenceMin: agg.referenceMin,
          referenceMax: agg.referenceMax,
          deltaOrganic,
          deltaGeneral,
          latestPage: agg.page,
          latestCheckedCards: agg.checked,
          organicFound: agg.organicFound,
          adFound: agg.adFound,
          updatedAt: checkedAt
        };

        await kwRef.set(latest, { merge: true });
        await kwRef.collection('history').add({
          checkedAt,
          source: 'github-actions-wif-neutral-chromium',
          ...agg,
          requestedRuns,
          deltaOrganic,
          deltaGeneral
        });

        if (agg.title) {
          await adRef.set({ title: agg.title, lastCheckedAt: checkedAt, updatedAt: checkedAt }, { merge: true });
        } else {
          await adRef.set({ lastCheckedAt: checkedAt, updatedAt: checkedAt }, { merge: true });
        }

        if (queueRef) {
          await queueRef.set({
            status: 'done',
            finishedAt: checkedAt,
            result: {
              found: agg.found,
              general: agg.referenceGeneralPosition,
              organic: agg.referenceOrganicPosition,
              ads: agg.referenceAdsPosition
            }
          }, { merge: true });
        }

        console.log(`${adId} | ${keyword}: org=${agg.referenceOrganicPosition ?? '-'} ad=${agg.referenceAdsPosition ?? '-'} geral=${agg.referenceGeneralPosition ?? '-'} (${requestedRuns}x)`);
      } catch (e) {
        console.error(`${adId} | ${keyword}:`, e);
        if (queueRef) {
          await queueRef.set({
            status: 'error',
            finishedAt: FieldValue.serverTimestamp(),
            error: String(e.message || e).slice(0, 500)
          }, { merge: true });
        }
      }
      await sleep(500);
    }
  } finally {
    await browser.close();
  }
}

await run();
