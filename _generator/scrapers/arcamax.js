const fetch = require('./lib/fetch.js')
const multipageScraper = require('./lib/multipage-scraper.js')
const { query_html, element_to_text } = require('./lib/query-html.js')

const unavailableComics = [
	'thepajamadiaries',
	'nestheads',
	'poorlydrawnlines', // Missing required Facebook sharing elements
]

async function getSeriesObjects() {
	const html = await fetch('https://www.arcamax.com/comics')
	const $ = query_html(html)

	const seriesEntries = $('.side-column ul:first-child li a')
		.map(a_element => {
			const href = a_element.attribs.href
			const basename = a_element.attribs['data-code']
			const title = element_to_text(a_element)

			return [ basename, {
				// author, // The author info is not in the sidebar
				title,
				url: 'https://www.arcamax.com/thefunnies/' + basename, // these should be the same as each other in arcamax
				mostRecentStripUrl: new URL(href, 'https://www.arcamax.com').toString(), // these should be the same as each other in arcamax
				isPolitical: false,
				language: 'eng'
			}]
		})
		.filter(kv => !unavailableComics.includes(kv[0]))
	return Object.fromEntries(seriesEntries)
}

async function getStrip(stripPageUrl) {
	const html = await fetch(stripPageUrl)
	const $ = query_html(html)

	const facebookElement = $('.facebook')[0]
	if (!facebookElement || !facebookElement.attribs || !facebookElement.attribs.href) {
		throw new Error(`Facebook sharing element not found on page: ${stripPageUrl}`)
	}

	const facebook_url = facebookElement.attribs.href.replace(/&amp;/g, '&')
	const facebook_url_params = new URL(facebook_url).searchParams
	// https://www.facebook.com/sharer.php?u=https%3A%2F%2Fwww.arcamax.com%2Fthefunnies%2Fmutts%2Fs-2375148&amp;h=Mutts+for+6%2F23%2F2020
	const url = facebook_url_params.get('u')
	const m_d_yyyyDate = facebook_url_params.get('h').trim().split(' ').pop()
	
	const curElement = $('span.cur')[0]
	const mmm_d_date = curElement ? element_to_text(curElement) : null
	const date = m_d_yyyyDate.includes('/')
		? usDateToIsoDate(m_d_yyyyDate)
		: mmm_d_date && humanReadableDateToIsoDate(mmm_d_date)

	const comicImageElement = $('img#comic-zoom')[0]
	if (!comicImageElement || !comicImageElement.attribs || !comicImageElement.attribs.src) {
		throw new Error(`Comic image not found on page: ${stripPageUrl}`)
	}

	const imageUrl = new URL(comicImageElement.attribs.src, 'https://www.arcamax.com').toString()
	
	const authorElement = $('cite')[0]
	const author = authorElement ? element_to_text(authorElement).replace(/^by /, '') : ''
	const isOldestStrip = /class="prev-off"/.test(html)
	const prevElement = $('a.prev')[0]
	const olderRelUrl = isOldestStrip || (prevElement && prevElement.attribs && prevElement.attribs.href)
	// const newerRelUrl = $('a.next')[0].attribs.href
	
	const ogImageElement = $('meta[property="og:image"]')[0]
	const headerImageUrl = ogImageElement && ogImageElement.attribs && ogImageElement.attribs.content

	return {
		imageUrl,
		date,
		author,
		url,
		isOldestStrip,
		olderRelUrl,
		// newerRelUrl: newerRelUrlMatches[1],
		headerImageUrl,
	}
}

function pad2(n) { return n.padStart(2, '0') }

function usDateToIsoDate(monthDayYear) {
	const [ month, day, year ] = monthDayYear.split('/')
	return `${year}-${pad2(month)}-${pad2(day)}`
}

function humanReadableDateToIsoDate(mmmDay) {
	const currentYear = new Date().toISOString().slice(0, 4)
	const currentMonth = new Date().toISOString().slice(5, 7)

	const [ monthName, day ] = mmmDay.split(/\s+/)

	const month = {
		January: '01',
		February: '02',
		March: '03',
		April: '04',
		May: '05',
		June: '06',
		July: '07',
		August: '08',
		September: '09',
		October: '10',
		November: '11',
		December: '12',
	}[monthName]

	let year = currentYear
	if (currentMonth < month) {
		year = (parseInt(year, 10) - 1).toString()
	}
	const yyyymmdd = `${currentYear}-${month}-${pad2(day)}`
	return yyyymmdd
}

module.exports = cachedSeriesObjects => multipageScraper({ getSeriesObjects, getStrip, cachedSeriesObjects })
