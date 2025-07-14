// Use WHATWG URL API instead of deprecated url.resolve

module.exports = async function multipageScraper({ getSeriesObjects, getStrip, cachedSeriesObjects }) {
	const newSeriesObjects = await getSeriesObjects()

	let seriesObjectsKeys = Object.keys(newSeriesObjects)
	if (! seriesObjectsKeys.length) {
		throw new Error('No comics found')
	}
	if (global.DEBUG) {
		seriesObjectsKeys = seriesObjectsKeys.slice(0, 10)
	}
	
	let stats = { processed: 0, cacheHits: 0, newStrips: 0, filtered: 0, errors: 0 }
	const processComic = async (basename, index) => {
		// Stagger requests to avoid overwhelming the server
		await new Promise(resolve => setTimeout(resolve, index * 100))
		
		stats.processed++
		const newSeriesObject = newSeriesObjects[basename]
		const cachedSeriesObject = cachedSeriesObjects[basename]
		const cachedStrips = cachedSeriesObject && cachedSeriesObject.strips || []
		if (global.VERBOSE) {
			console.log((cachedSeriesObject ? '' : 'New: ') + basename)
		}

		try {
			const result = await getStrips(getStrip, newSeriesObject, cachedStrips, stats)

			if (result && result.finalSeriesObject) {
				// insert the series into into the cache, or overwrite the cached series
				cachedSeriesObjects[basename] = result.finalSeriesObject
				if (result.newStripsCount === 0 && cachedSeriesObject) {
					stats.cacheHits++
				}
			}
		} catch (err) {
			stats.errors++
			if (global.VERBOSE) {
				console.error(err)
			}

			console.error(basename + ' ' + err.message)
			if (newSeriesObject.mostRecentStripUrl) {
				console.error(newSeriesObject.mostRecentStripUrl)
			}
		}
	}

	// Process comics in parallel with limited concurrency
	const BATCH_SIZE = 5 // Process 5 comics at a time
	for (let i = 0; i < seriesObjectsKeys.length; i += BATCH_SIZE) {
		const batch = seriesObjectsKeys.slice(i, i + BATCH_SIZE)
		await Promise.allSettled(
			batch.map((basename, index) => processComic(basename, index))
		)
	}
	
	// Print statistics for scrapers using this module
	const scraperName = cachedSeriesObjects._scraperName || 'scraper'
	console.log(`${scraperName}: Processed ${stats.processed} comics - Cache hits: ${stats.cacheHits}, New strips: ${stats.newStrips}${stats.filtered > 0 ? `, Filtered: ${stats.filtered}` : ''}${stats.errors > 0 ? `, Errors: ${stats.errors}` : ''}`)
	
	// Clean up temporary property
	delete cachedSeriesObjects._scraperName

	return cachedSeriesObjects
}

async function getStrips(getStrip, newSeriesObject, cachedStrips, stats) {
	const strips = []
	// Filter out any cached strips with future dates
	const today = new Date().toISOString().slice(0, 10)
	const validCachedStrips = cachedStrips.filter(strip => strip.date <= today)
	if (cachedStrips.length > validCachedStrips.length) {
		const filtered = cachedStrips.length - validCachedStrips.length
		stats.filtered += filtered
		console.log(`Filtered out ${filtered} future-dated strips`)
	}
	const previousUrls = validCachedStrips.map(strip => strip.url)

	return Promise.resolve(newSeriesObject.mostRecentStripUrl)
		.then(getStripPage)
		.then(getStripPage)
		.then(getStripPage)
		.then(getStripPage)
		.then(getStripPage)
		.then(getStripPage)
		.then(getStripPage)
		.then(getStripPage)
		.then(getStripPage)
		.then(getStripPage)
		.then(getStripPage)
		.then(getStripPage)
		.then(getStripPage)
		.then(getStripPage)
		.then(getStripPage)
		.then(() => {
			if (! strips.length) {
				// If no new info was gathered, then avoid changing the cached copy
				return null
			}
			stats.newStrips += strips.length
			return {
				finalSeriesObject: Object.assign(newSeriesObject, {
					strips: strips.concat(validCachedStrips),
					imageUrl: strips[0].headerImageUrl,
					author: strips[0].author,
				}),
				newStripsCount: strips.length
			}
		})

	async function getStripPage(stripPageUrl) {
		if (! stripPageUrl || previousUrls.includes(stripPageUrl) || previousUrls.includes(decodeURI(stripPageUrl))) {
			return null
		}

		const strip = await getStrip(stripPageUrl)

		if (! previousUrls.includes(strip.url)) {
			strips.push(strip)
		}
		if (! strip.isOldestStrip) {
			return new URL(strip.olderRelUrl, stripPageUrl).toString()
		}
	}
}
