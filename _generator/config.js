// Configuration for the Comics RSS site
// Update these values when forking the repository

module.exports = {
	// GitHub repository information
	github: {
		// Repository owner/name (change this when forking)
		repo: 'arsfeld/comicsrss',
		
		// Full GitHub repository URL
		get url() {
			return `https://github.com/${this.repo}`
		},
		
		// GitHub Pages URL for RSS previewer (relative to site root)
		get previewerUrl() {
			return './rss-previewer.html'
		}
	},
	
	// Site information
	site: {
		// Base URL for the site
		baseUrl: 'https://www.comicsrss.com',
		
		// Site name
		name: 'Comics RSS'
	}
}