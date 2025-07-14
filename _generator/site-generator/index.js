const renderTemplate = require('./render-template.js')
const writeFileRoot = require('./write-file-root.js')
const generateRssFeedFromSeriesObject = require('./generate-rss-feed-from-series-object.js')
const config = require('../config.js')

module.exports = function writeFilesFromSeriesObjects(seriesObjectsArr, supporters) {
	// Calculate recently updated comics (last 7 days)
	const today = new Date()
	const recentlyUpdated = seriesObjectsArr
		.filter(series => series.strips && series.strips.length > 0)
		.map(series => {
			const lastUpdate = new Date(series.strips[0].date)
			const daysAgo = Math.floor((today - lastUpdate) / (1000 * 60 * 60 * 24))
			return { ...series, daysAgo }
		})
		.filter(series => series.daysAgo <= 7)
		.sort((a, b) => a.daysAgo - b.daysAgo)
		.slice(0, 12) // Show top 12 recently updated

	const renderData = {
		subtemplate: 'index',
		seriesObjects: seriesObjectsArr,
		supporters,
		generatedDate: new Date().toDateString(),
		config,
	}

	const discoverData = {
		...renderData,
		subtemplate: 'discover',
		recentlyUpdated,
	}

	writeFileRoot('index.html', renderTemplate('master', { ...renderData, language: 'eng' }))
	writeFileRoot('espanol.html', renderTemplate('master', { ...renderData, language: 'spa' }))
	writeFileRoot('discover.html', renderTemplate('master', { ...discoverData, language: 'eng' }))

	const limit = global.DEBUG ? 10 : Infinity
	for (const seriesObject of seriesObjectsArr.slice(0, limit)) {
		const rss = generateRssFeedFromSeriesObject(seriesObject)
		if (rss) {
			writeFileRoot(`rss/${seriesObject.basename}.rss`, rss)
		}
	}
}
