const { resolve } = require('url')

module.exports = async function multipageScraper({ getSeriesObjects, getStrip, cachedSeriesObjects }) {
	const newSeriesObjects = await getSeriesObjects()

	let seriesObjectsKeys = Object.keys(newSeriesObjects)
	if (! seriesObjectsKeys.length) {
		throw new Error('No comics found')
	}
	if (global.DEBUG) {
		seriesObjectsKeys = seriesObjectsKeys.slice(0, 10)
	}
	const processComic = async (basename, index) => {
		// Stagger requests to avoid overwhelming the server
		await new Promise(resolve => setTimeout(resolve, index * 100))
		
		const newSeriesObject = newSeriesObjects[basename]
		const cachedSeriesObject = cachedSeriesObjects[basename]
		const cachedStrips = cachedSeriesObject && cachedSeriesObject.strips || []
		if (global.VERBOSE) {
			console.log((cachedSeriesObject ? '' : 'New: ') + basename)
		}

		try {
			const finalSeriesObject = await getStrips(getStrip, newSeriesObject, cachedStrips)

			if (finalSeriesObject) {
				// insert the series into into the cache, or overwrite the cached series
				cachedSeriesObjects[basename] = finalSeriesObject
			}
		} catch (err) {
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

	return cachedSeriesObjects
}

async function getStrips(getStrip, newSeriesObject, cachedStrips) {
	const strips = []
	const previousUrls = cachedStrips.map(strip => strip.url)

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
			return Object.assign(newSeriesObject, {
				strips: strips.concat(cachedStrips),
				imageUrl: strips[0].headerImageUrl,
				author: strips[0].author,
			})
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
			return resolve(stripPageUrl, strip.olderRelUrl)
		}
	}
}
