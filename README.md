# Gran Canaria Cultura Events Scraper

Scrapea eventos de: https://cultura.grancanaria.com/en/agenda-completa

## ¿Qué hace?

1. Carga la página principal de la agenda.
2. Encuentra enlaces a los detalles de cada evento (`detalle-agenda?calendarBookingId=...`).
3. Extrae campos básicos (id, título, horario, localización, resumen).
4. Visita cada página de detalle para añadir imagen y descripción.
5. (Opcional) Navega meses futuros construyendo URLs si se detecta el prefijo de portlet.
6. Guarda los resultados en el Dataset (Apify/Crawlee).

## Campos de salida (Dataset)

- `id`
- `title`
- `rawSummary`
- `timeText`
- `location`
- `listUrl`
- `detailUrl`
- `imageUrl`
- `descriptionHtml`
- `scrapedAt`

## Input

Archivo `INPUT_SCHEMA.json` define:
```json
{
  "monthsAhead": 0
}
```

`monthsAhead` = cuántos meses adicionales (además del actual) intentar. Ej: 1 = mes actual + siguiente.

## Ejecutar localmente

```bash
npm install
npm start
```

Resultados en: `apify_storage/datasets/default/`

Para configurar `monthsAhead` localmente:
Crear `apify_storage/key_value_stores/default/INPUT.json` con:
```json
{ "monthsAhead": 1 }
```

## Estructura

```
src/
  main.js        # Lógica principal del crawler
package.json
apify.json
INPUT_SCHEMA.json
README.md
.gitignore
```

## Futuro (ideas)

- Parsear fecha/hora a ISO real.
- Normalizar descripción (limpiar HTML).
- Extraer categorías si aparecen.
- Añadir tests mínimos (ej: validación de estructuras).
- Configurar CI (GitHub Actions) para lint / test.

## Licencia

(Define la que necesites: MIT, etc.)