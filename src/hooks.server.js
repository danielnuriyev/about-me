// Function to check if request comes from a browser
function isBrowserRequest(request) {
	const userAgent = request.headers.get('user-agent') || '';

	// Reject known non-browser clients
	const nonBrowserPatterns = [
		/^curl\//i,
		/^postman/i,
		/^python-requests\//i,
		/^wget\//i,
		/^axios\//i,
		/^fetch$/i,  // standalone fetch without browser context
		/^node-fetch\//i,
		/^undici\//i,
		/^got\//i,
		/^httpie\//i,
		/^insomnia\//i,
		/^paw\//i,
		/^restclient\//i
	];

	// Check for non-browser patterns
	for (const pattern of nonBrowserPatterns) {
		if (pattern.test(userAgent)) {
			return false;
		}
	}

	// Require Mozilla/5.0 prefix (standard for modern browsers)
	if (!userAgent.includes('Mozilla/5.0')) {
		return false;
	}

	// Check for common browser engines
	const browserPatterns = [
		/AppleWebKit/i,
		/Gecko/i,
		/Trident/i,  // IE
		/Edge/i
	];

	return browserPatterns.some(pattern => pattern.test(userAgent));
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	// Proxy /api/chat requests to LocalStack
	if (event.request.url.endsWith('/api/chat') && event.request.method === 'POST') {
		// Skip browser validation for development (LocalStack)
		// TODO: Re-enable for production deployment
		/*
		if (!isBrowserRequest(event.request)) {
			return new Response(
				JSON.stringify({
					error: 'Access denied',
					message: 'This endpoint only accepts requests from web browsers'
				}),
				{
					status: 403,
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
		}
		*/

		try {
			const body = await event.request.json();
			const chatApiUrl = 'http://localhost:4566/restapis/ibpaj1kk82/prod/_user_request_/chat';

			const response = await fetch(chatApiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Origin': 'http://localhost:5173'
				},
				body: JSON.stringify(body)
			});

			const data = await response.json();

			return new Response(JSON.stringify(data), {
				status: response.status,
				headers: {
					'Content-Type': 'application/json'
				}
			});
		} catch (error) {
			console.error('[hooks] Error:', error);
			return new Response(
				JSON.stringify({
					error: 'Internal server error',
					message: error.message
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
		}
	}

	const response = await resolve(event);
	return response;
}
