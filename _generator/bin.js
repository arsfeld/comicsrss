#!/usr/bin/env node

const defaultScrapers = [
	// When two scrapers have the same comic, the higher scraper in this list will take priority
	'dilbert',
	'gocomics',
	'arcamax',
	'comicskingdom',
]
const expirationDays = 90
const expirationCount = 50

function migration([ id, seriesObject ]) {
	// seriesObject.strips = seriesObject.strips.filter(s => s.date !== null && s.date.slice(7) !== '2020-09') // bye bye all this month
	return [ id, seriesObject ]
}


const fs = require('fs')
const path = require('path')
const jsonStableStringify = require('json-stable-stringify')

main(parseCliOptions(process.argv.slice(2)))

async function main(options) {
	const startTime = new Date()
	const { debug, verbose, help, scrape, generate, migrate } = options
	global.DEBUG = debug || false
	global.VERBOSE = verbose || global.DEBUG

	if (help || (! scrape && ! generate && ! migrate)) {
		if (! help) console.error('ERROR: You must enable scrape and/or generate.\r\n')
		console.log('node bin OPTIONS')
		console.log('--help               Show this help text.')
		console.log('--debug              When enabled, this will cause the scrapers and generator to work on fewer files, so everything runs more quickly, but the site is only partially generated. Defaults to processing all files.')
		console.log('--verbose            When enabled, more information will be logged to the console. --debug implies --verbose.')
		console.log('--scrape             When enabled, it will scrape the websites, which updates the cached comic information.')
		console.log('--scrape=<scraper>   Only scrape the specified site.')
		console.log('--generate           Generate the static site from the cached comic information. --scrape or --generate must be enabled.')
		console.log('--migrate            Transform the cached comic objects from an old format to a new format.')
		console.log('--migrate=<scraper>  Only transform the specified temp file.')
		console.log('')
		console.log('The leading hyphens are optional.')
		console.log('Example: node bin debug scrape')
		process.exit(help ? 0 : 1)
	}

	let scraperNames = defaultScrapers

	if (migrate) {
		if (typeof migrate === 'string') {
			scraperNames = [ migrate ]
		}
		for (const scraperName of scraperNames) {
			const seriesObjects = readSeriesObjectsFile(scraperName)
			writeSeriesObjectsFile(scraperName, objMap(seriesObjects, migration))
			console.log(`Updated ${scraperName} tmp file`)
		}

		process.exit(0)
	}

	if (typeof scrape === 'string') {
		scraperNames = [ scrape ]
	}
	let scrapeErrors = []
	let scrapeStats = []
	if (scrape) {
		console.log(`\n📊 Starting to scrape ${scraperNames.length} scrapers...\n`)
		const scrapeStartTime = new Date()
		
		// Run scrapers sequentially to avoid overwhelming servers
		const scrapeResults = []
		for (const scraperName of scraperNames) {
			try {
				const result = await runScraper(scraperName)
				scrapeResults.push({ status: 'fulfilled', value: result })
			} catch (error) {
				// Create a detailed error object
				const errorDetail = {
					scraperName,
					message: error.message || error.toString(),
					stack: error.stack,
					logs: [] // Logs would be captured if we had access to them
				}
				scrapeResults.push({ status: 'rejected', reason: errorDetail })
			}
		}
		
		const scrapeEndTime = new Date()
		
		scrapeErrors = scrapeResults
			.filter(({ status }) => status === 'rejected')
			.map(({ reason }) => reason)
		
		scrapeStats = scrapeResults
			.filter(({ status }) => status === 'fulfilled')
			.map(({ value }) => value)

		// Print summary
		console.log('\n' + '─'.repeat(60))
		console.log('📈 SCRAPING SUMMARY')
		console.log('─'.repeat(60))
		console.log(`⏱️  Total time: ${((scrapeEndTime - scrapeStartTime) / 1000).toFixed(1)}s`)
		console.log(`✅ Successful: ${scrapeStats.length}/${scraperNames.length} scrapers`)
		if (scrapeErrors.length > 0) {
			console.log(`❌ Failed: ${scrapeErrors.length} scrapers`)
		}
		
		const totalComics = scrapeStats.reduce((sum, s) => sum + s.comicCount, 0)
		const totalNewStrips = scrapeStats.reduce((sum, s) => sum + s.newStrips, 0)
		console.log(`📚 Total comics: ${totalComics}`)
		console.log(`🆕 New strips: ${totalNewStrips}`)
		console.log('─'.repeat(60))
		
		// Show comics with new content
		const comicsWithNewContent = scrapeStats
			.flatMap(scraper => scraper.comicDetails
				.filter(comic => comic.newStrips > 0)
				.map(comic => ({ ...comic, scraper: scraper.scraperName }))
			)
			.sort((a, b) => b.newStrips - a.newStrips)
		
		if (comicsWithNewContent.length > 0) {
			console.log('\n📰 COMICS WITH NEW CONTENT:')
			console.log('─'.repeat(60))
			console.log('Comic Name                     | New | Latest Date')
			console.log('─'.repeat(60))
			comicsWithNewContent.slice(0, 20).forEach(comic => {
				const name = comic.name.padEnd(30).slice(0, 30)
				const newStrips = comic.newStrips.toString().padStart(3)
				console.log(`${name} | ${newStrips} | ${comic.latestDate}`)
			})
			if (comicsWithNewContent.length > 20) {
				console.log(`... and ${comicsWithNewContent.length - 20} more comics with updates`)
			}
			console.log('─'.repeat(60))
		}
		
		// Show all comics in verbose mode
		if (global.VERBOSE && scrapeStats.length > 0) {
			console.log('\n📋 ALL COMICS BY SCRAPER:')
			console.log('─'.repeat(60))
			
			scrapeStats.forEach(scraper => {
				if (scraper.comicDetails.length === 0) return
				
				console.log(`\n${scraper.scraperName.toUpperCase()} (${scraper.comicDetails.length} comics):`)
				console.log('Comic Name                     | Strips | Latest Date')
				console.log('─'.repeat(60))
				
				scraper.comicDetails
					.sort((a, b) => a.name.localeCompare(b.name))
					.forEach(comic => {
						const name = comic.name.padEnd(30).slice(0, 30)
						const strips = comic.totalStrips.toString().padStart(6)
						console.log(`${name} | ${strips} | ${comic.latestDate}`)
					})
			})
			console.log('─'.repeat(60))
		}
	}
	if (generate) {
		const siteGenerator = require('./site-generator/index.js')
		const supporters = require('./tmp/supporters.json')
		const seriesObjectsArr = mergeSeriesObjects(scraperNames)

		siteGenerator(seriesObjectsArr, supporters)
	}


	if (scrapeErrors.length > 0) {
		console.log('\n❌ ERRORS:')
		scrapeErrors.forEach(e => console.error(e))
	}

	console.log(`\n✨ Total time: ${((new Date() - startTime) / 1000).toFixed(1)}s\n`)
	
	// Output JSON summary for GitHub Actions
	if (process.env.GITHUB_ACTIONS && scrape) {
		// Create a summary focused on errors and comic updates
		const summary = {
			totalTime: ((new Date() - startTime) / 1000).toFixed(1),
			scrapers: {
				total: scraperNames.length,
				successful: scrapeStats.length,
				failed: scrapeErrors.length
			},
			comics: {
				total: scrapeStats.reduce((sum, s) => sum + s.comicCount, 0),
				newStrips: scrapeStats.reduce((sum, s) => sum + s.newStrips, 0)
			},
			// Simple scraper summary without detailed logs
			details: scrapeStats.map(s => ({
				scraperName: s.scraperName,
				comicCount: s.comicCount,
				newStrips: s.newStrips,
				timeTaken: s.timeTaken
			})),
			// Keep ALL errors - they're important
			errors: scrapeErrors,
			// Focus on comics with new content - this is what matters
			comicsWithNewContent: scrapeStats
				.flatMap(scraper => scraper.comicDetails
					.filter(comic => comic.newStrips > 0)
					.map(comic => ({
						name: comic.name,
						newStrips: comic.newStrips,
						latestDate: comic.latestDate,
						scraper: scraper.scraperName
					}))
				)
				.sort((a, b) => b.newStrips - a.newStrips)
		}
		console.log('::GITHUB_ACTIONS_SUMMARY::' + JSON.stringify(summary))
	}

	const exitCode = scrapeErrors.length === scraperNames.length ? 1 : 0 // this will exit non-zero if some scrapers worked
	process.exit(exitCode)
}


function parseCliOptions(args) {
	return Object.fromEntries(args
		.map(arg => arg.replace(/^--/, '').toLowerCase().split('=', 2))
		.map(([ key, value = true ]) => [ key, value ]))
}

function readSeriesObjectsFile(scraperName) {
	const filePath = getSeriesObjectsPath(scraperName)
	if (!fs.existsSync(filePath)) {
		return {}
	}
	const json = fs.readFileSync(filePath, 'utf-8')
	return JSON.parse(json)
}

function writeSeriesObjectsFile(scraperName, contents) {
	const filePath = getSeriesObjectsPath(scraperName)
	const json = jsonStableStringify(contents, { space: '\t' })
	fs.writeFileSync(filePath, json, 'utf-8')
}

function getSeriesObjectsPath(scraperName) {
	return path.resolve(__dirname, 'tmp', `${scraperName}-series-objects.json`)
}

async function runScraper(scraperName) {
	if (global.VERBOSE) console.log('Scraping ' + scraperName)
	const startTime = new Date()
	const cachedSeriesObjects = readSeriesObjectsFile(scraperName)
	const cachedComicCount = Object.keys(cachedSeriesObjects).length
	const cachedStripCount = Object.values(cachedSeriesObjects).reduce((sum, obj) => sum + (obj.strips?.length || 0), 0)
	
	// Track scraper-specific logs
	const scraperLogs = []
	const originalConsoleLog = console.log
	const originalConsoleError = console.error
	
	// Capture logs during scraper execution
	console.log = (...args) => {
		const message = args.join(' ')
		if (message.includes(scraperName + ':') || message.includes('Error') || message.includes('error')) {
			scraperLogs.push({ type: 'log', message })
		}
		originalConsoleLog(...args)
	}
	
	console.error = (...args) => {
		scraperLogs.push({ type: 'error', message: args.join(' ') })
		originalConsoleError(...args)
	}
	
	let newSeriesObjects
	try {
		const scraper = require(`./scrapers/${scraperName}.js`)
		newSeriesObjects = await scraper(cachedSeriesObjects)
	} finally {
		// Restore original console methods
		console.log = originalConsoleLog
		console.error = originalConsoleError
	}
	if (Array.isArray(newSeriesObjects)) {
		throw new Error('Did not expect resulting seriesObjects variable to be an array.')
	}
	const expirationDate = new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * expirationDays)

	const verifiedSeriesObjects = objMapValue(newSeriesObjects, newSeriesObject => {
		const strips = newSeriesObject.strips
			.map(({ url, date, imageUrl }) => ({ url, date, imageUrl }))
			.filter((strip, i) => (i === 0 || new Date(strip.date) > expirationDate)) // keeps recent strips
			.slice(0, expirationCount)
		return strips ? { ...newSeriesObject, strips } : null
	})

	writeSeriesObjectsFile(scraperName, verifiedSeriesObjects)
	
	// Calculate statistics
	const endTime = new Date()
	const newComicCount = Object.keys(verifiedSeriesObjects).length
	const newStripCount = Object.values(verifiedSeriesObjects).reduce((sum, obj) => sum + (obj.strips?.length || 0), 0)
	const timeTaken = ((endTime - startTime) / 1000).toFixed(1)
	
	// Collect per-comic details
	const comicDetails = Object.entries(verifiedSeriesObjects).map(([name, comic]) => {
		const cachedComic = cachedSeriesObjects[name]
		const oldStripCount = cachedComic?.strips?.length || 0
		const currentStripCount = comic.strips?.length || 0
		const newStripsForComic = Math.max(0, currentStripCount - oldStripCount)
		
		return {
			name: comic.title || name,
			basename: name,
			totalStrips: currentStripCount,
			newStrips: newStripsForComic,
			latestDate: comic.strips?.[0]?.date || 'N/A'
		}
	}).filter(comic => comic.totalStrips > 0) // Only include comics with strips
	
	console.log(`✓ ${scraperName}: ${newComicCount} comics, ${newStripCount - cachedStripCount} new strips (${timeTaken}s)`)
	
	return {
		scraperName,
		comicCount: newComicCount,
		stripCount: newStripCount,
		newStrips: newStripCount - cachedStripCount,
		timeTaken: parseFloat(timeTaken),
		comicDetails,
		logs: scraperLogs
	}
}


function mergeSeriesObjects(scraperNames) {
	const s = seriesObject => seriesObject.title.toLowerCase()
	const sortSeriesObjects = (a, b) => s(a) > s(b) ? 1 : (s(b) > s(a) ? -1 : 0)
	const normalizeBasename = basename => basename.toLowerCase().replace(/\W+/g, '')

	const seriesObjectsFileArr = scraperNames.map(scraperName => {
		const seriesObjectFile = readSeriesObjectsFile(scraperName)

		return objMap(seriesObjectFile, ([ basename, seriesObject ]) => [
			normalizeBasename(basename),
			{ ...seriesObject, basename, scraper: scraperName },
		])
	})

	// If gocomics and arcamax have the same comic (e.g. "agnes", or "1-and-done" aka "1anddone") then this clobbers one
	// seriesObjectsFileArr is reversed so earlier scraperNames take priority over later
	const flatSeriesCollection = Object.assign({}, ...seriesObjectsFileArr.reverse())
	// -> { "1anddone": {...}, "dilbert": {...}, etc }
	const seriesObjectsArr = Object.values(flatSeriesCollection).sort(sortSeriesObjects)

	return seriesObjectsArr
}

function objMap(obj, fn) {
	return Object.fromEntries(Object.entries(obj).map(([ key, val ]) => fn([ key, val ])))
}
function objMapValue(obj, fn) {
	return Object.fromEntries(Object.entries(obj).map(([ key, val ]) => [ key, fn(val) ]))
}
