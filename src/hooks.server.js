/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	// Proxy /api/chat requests to LocalStack
	if (event.request.url.endsWith('/api/chat') && event.request.method === 'POST') {
		try {
			const body = await event.request.json();
			const chatApiUrl = 'http://localhost:4566/restapis/pvlq39vakd/prod/_user_request_/chat';

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
