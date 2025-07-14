// Comic preview image loader script
// This will be included in the discover page to load comic previews

(function() {
	const previewCache = new Map();
	
	async function loadComicPreview(comicBasename) {
		if (previewCache.has(comicBasename)) {
			return previewCache.get(comicBasename);
		}
		
		try {
			// Fetch the RSS feed
			const response = await fetch(`/rss/${comicBasename}.rss`);
			const text = await response.text();
			
			// Parse the RSS to find the first comic image
			const parser = new DOMParser();
			const doc = parser.parseFromString(text, 'text/xml');
			
			// Get the first item's description
			const firstItem = doc.querySelector('item description');
			if (!firstItem) return null;
			
			// Extract image URL from the description HTML
			const descHtml = firstItem.textContent;
			const imgMatch = descHtml.match(/<img[^>]+src="([^"]+)"/);
			
			if (imgMatch && imgMatch[1]) {
				const imageUrl = imgMatch[1];
				previewCache.set(comicBasename, imageUrl);
				return imageUrl;
			}
		} catch (error) {
			console.error(`Failed to load preview for ${comicBasename}:`, error);
		}
		
		return null;
	}
	
	async function initializePreviews() {
		const previewElements = document.querySelectorAll('.comic-preview-image[data-src]');
		console.log(`Found ${previewElements.length} comic previews to load`);
		
		for (const element of previewElements) {
			const comicBasename = element.getAttribute('data-src');
			console.log(`Loading preview for: ${comicBasename}`);
			const imageUrl = await loadComicPreview(comicBasename);
			
			if (imageUrl) {
				element.style.backgroundImage = `url(${imageUrl})`;
				element.classList.add('loaded');
				console.log(`Loaded preview for ${comicBasename}`);
			} else {
				// Show placeholder if no image found
				element.innerHTML = '<span class="no-preview-text">No preview</span>';
				element.classList.add('no-preview');
				console.log(`No preview found for ${comicBasename}`);
			}
		}
	}
	
	// Load previews when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initializePreviews);
	} else {
		initializePreviews();
	}
	
	// Export for use in random comics feature and manual initialization
	window.loadComicPreview = loadComicPreview;
	window.initializePreviews = initializePreviews;
})();