const { CheerioCrawler, RequestQueue, Dataset, log } = require('crawlee');
const Apify = require('apify');

// Conjunto para deduplicar eventos por calendarBookingId
const processedIds = new Set();

function extractBookingId(url) {
  if (!url) return null;
  const m = url.match(/calendarBookingId=(\d+)/i);
  return m ? m[1] : null;
}

function offsetYearMonth(offset) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return { year: target.getFullYear(), month: target.getMonth() + 1 };
}

function buildMonthUrl(baseUrl, portletPrefix, year, month) {
  if (!portletPrefix) return null;
  const mm = String(month).padStart(2, '0');
  const params = new URLSearchParams();
  params.set(`${portletPrefix}_month`, mm);
  params.set(`${portletPrefix}_year`, String(year));
  return `${baseUrl}?${params.toString()}`;
}

function detectPortletPrefix($) {
  const link = $('a[href*="_month="][href*="_year="]').first().attr('href');
  if (!link) return null;
  const m = link.match(/([A-Za-z0-9_]+)_month=/);
  return m ? m[1] : null;
}

async function main() {
  const input = await Apify.getInput() || {};
  const { monthsAhead = 0 } = input;
  log.info(`Iniciando actor. monthsAhead=${monthsAhead}`);

  const BASE_URL = 'https://cultura.grancanaria.com/en/agenda-completa';
  let portletPrefix = null;
  const requestQueue = await RequestQueue.open();

  await requestQueue.addRequest({
    url: BASE_URL,
    userData: { label: 'LIST', monthOffset: 0, injected: true },
  });

  const crawler = new CheerioCrawler({
    requestQueue,
    maxRequestsPerCrawl: 5000,
    maxConcurrency: 5,
    requestHandlerTimeoutSecs: 90,
    retryAttempts: 3,

    async requestHandler(ctx) {
      const { request, $ } = ctx;
      const { label } = request.userData;

      if (label === 'LIST') {
        log.info(`(LIST) Procesando: ${request.url}`);

        if (!portletPrefix) {
          portletPrefix = detectPortletPrefix($);
          if (portletPrefix) {
            log.info(`Prefijo detectado: ${portletPrefix}`);
            if (monthsAhead > 0) {
              for (let offset = 1; offset <= monthsAhead; offset++) {
                const { year, month } = offsetYearMonth(offset);
                const monthUrl = buildMonthUrl(BASE_URL, portletPrefix, year, month);
                if (monthUrl) {
                  await ctx.requestQueue.addRequest({
                    url: monthUrl,
                    userData: { label: 'LIST', monthOffset: offset, constructed: true },
                  });
                }
              }
            }
          } else {
            log.warning('No se pudo detectar el prefijo del portlet todavía.');
          }
        }

        $('a[href*="detalle-agenda?calendarBookingId="]').each((_, el) => {
          const $a = $(el);
          const relHref = $a.attr('href');
          if (!relHref) return;

          const detailUrl = new URL(relHref, request.url).toString();
          const bookingId = extractBookingId(detailUrl);
          if (!bookingId) return;
          if (processedIds.has(bookingId)) return;
          processedIds.add(bookingId);

          const title = $a.find('.evento-titulo').text().trim() || null;
          let rawSummary = null;
          const mb2Divs = $a.find('div.mb-2').toArray();
          if (mb2Divs.length > 0) {
            rawSummary = mb2Divs
              .map(d => {
                const c = $(d);
                if (c.hasClass('hora')) return null;
                return c.text().replace(/\s+/g, ' ').trim();
              })
              .filter(Boolean)[0] || null;
          }
          const timeText = $a.find('.hora').text().replace(/\s+/g, ' ').trim() || null;
          const location = $a.find('.evento-localizacion').text().trim() || null;

          const baseData = {
            id: bookingId,
            title,
            rawSummary,
            timeText,
            location,
            listUrl: request.url,
          };

          ctx.requestQueue.addRequest({
            url: detailUrl,
            userData: { label: 'DETAIL', baseData },
          });
        });

        if (!portletPrefix) {
          const $next = $('a[href*="_month="][href*="_year="]').filter((_, a) => {
            const href = $(a).attr('href') || '';
            return /next|siguiente|›|»/i.test($(a).text()) || href.includes('month=');
          }).first();
          if ($next.length) {
            const href = $next.attr('href');
            if (href) {
              const nextUrl = new URL(href, request.url).toString();
              log.info(`(Fallback) Encolando potencial siguiente mes: ${nextUrl}`);
              await ctx.requestQueue.addRequest({
                url: nextUrl,
                userData: { label: 'LIST', discovered: true },
              });
            }
          }
        }
      } else if (label === 'DETAIL') {
        const { baseData } = request.userData;
        log.info(`(DETAIL) id=${baseData.id}`);

        let imageUrl =
          $('meta[property="og:image"]').attr('content') ||
          $('.event-image img').attr('src') ||
          $('img.evento-imagen').attr('src') ||
          null;
        if (imageUrl) imageUrl = new URL(imageUrl, request.url).toString();

        let descriptionHtml =
          $('.event-description').html() ||
          $('.descripcion-evento').html() ||
          $('.content').find('p,div').slice(0, 8).html() ||
          null;

        const detailed = {
          ...baseData,
          detailUrl: request.url,
          imageUrl,
          descriptionHtml,
          scrapedAt: new Date().toISOString(),
        };

        await Dataset.pushData(detailed);
      }
    },

    failedRequestHandler({ request }) {
      log.error(`Fallo definitivo: ${request.url}`);
    },
  });

  await crawler.run();
  log.info(`Crawl finalizado. Eventos únicos: ${processedIds.size}`);
  log.info('Consulta el dataset para los resultados.');
}

Apify.main(main);