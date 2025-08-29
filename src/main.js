const Apify = require('apify');

Apify.main(async () => {
    const requestQueue = await Apify.openRequestQueue();
    const proxyConfiguration = await Apify.createProxyConfiguration();

    // Add the starting URL to the queue
    await requestQueue.addRequest({ url: 'https://www.grancanaria.com/turismo/es/agenda/' });

    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        proxyConfiguration,
        // Handle page data
        handlePageFunction: async ({ request, $ }) => {
            console.log(`Processing ${request.url}...`);
            
            // Extract data from the page
            const events = [];
            
            // TODO: Implement the scraping logic here
            // Example:
            // $('.event-item').each((index, el) => {
            //     events.push({
            //         title: $(el).find('.title').text(),
            //         date: $(el).find('.date').text(),
            //         location: $(el).find('.location').text(),
            //     });
            // });

            // Save the results
            await Apify.pushData(events);
        },
    });

    await crawler.run();
});