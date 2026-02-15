// API endpoint to proxy chat requests to LocalStack Lambda via API Gateway

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

export async function POST({ request }) {
	try {
		// Check if request comes from a browser
		if (!isBrowserRequest(request)) {
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

		const body = await request.json();
		const apiGatewayId = 'pvlq39vakd';

		// Proxy to LocalStack API Gateway
		const chatApiUrl = `http://localhost:4566/restapis/${apiGatewayId}/prod/_user_request_/chat`;

		console.log('[api/chat] Proxying to:', chatApiUrl);
		console.log('[api/chat] Request body:', body);

		// Make request to Lambda via API Gateway
		const response = await fetch(chatApiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Origin': 'http://localhost:5173'
			},
			body: JSON.stringify(body)
		});

		const data = await response.json();

		console.log('[api/chat] Response status:', response.status);
		console.log('[api/chat] Response data:', data);

		if (response.ok) {
			return new Response(JSON.stringify(data), {
				status: 200,
				headers: {
					'Content-Type': 'application/json'
				}
			});
		} else {
			return new Response(
				JSON.stringify({
					error: data.error || 'Failed to get response from Bedrock',
					message: data.message || 'Unknown error'
				}),
				{
					status: response.status,
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
		}
	} catch (error) {
		console.error('[api/chat] Error:', error);
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
