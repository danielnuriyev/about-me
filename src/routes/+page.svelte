<script>
	// Basic about me page component
	import Chat from '$lib/Chat.svelte';
	import { onMount } from 'svelte';

	let currentTime = '';
	let weather = { temp: '--', feelsLike: '--', condition: 'Loading...', icon: '' };
	let tempUnit = 'F';

	onMount(() => {
		// Update Eastern time every second
		const updateTime = () => {
			const now = new Date();
			const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
			currentTime = easternTime.toLocaleTimeString('en-US', {
				hour12: true,
				hour: 'numeric',
				minute: '2-digit',
				second: '2-digit'
			});
		};

		updateTime();
		const timeInterval = setInterval(updateTime, 1000);

		// Fetch weather data for Massachusetts (with fallback)
		setTimeout(fetchWeather, 1000); // Delay to avoid blocking initial render

		return () => {
			clearInterval(timeInterval);
		};
	});

	function fahrenheitToCelsius(f) {
		if (f === '--') return '--';
		return Math.round((f - 32) * 5/9);
	}

	function toggleTempUnit() {
		tempUnit = tempUnit === 'F' ? 'C' : 'F';
	}

	$: displayTemp = tempUnit === 'F' ? 
		(weather.temp === '--' ? '--' : Math.round(weather.temp)) : 
		fahrenheitToCelsius(weather.temp);

	$: displayFeelsLike = tempUnit === 'F' ? 
		(weather.feelsLike === '--' ? '--' : Math.round(weather.feelsLike)) : 
		fahrenheitToCelsius(weather.feelsLike);

	async function fetchWeather() {
		try {
			// Using Open-Meteo API (free, no API key required)
			// Boston, MA coordinates: 42.3601, -71.0589
			// Using current parameter for more accurate real-time data including apparent temperature
			const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=42.3601&longitude=-71.0589&current=temperature_2m,apparent_temperature,weather_code&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch');

			if (!response.ok) {
				throw new Error('Weather API unavailable');
			}

			const data = await response.json();
			const current = data.current;

			// Map weather codes to conditions (simplified)
			const weatherConditions = {
				0: 'Clear sky',
				1: 'Mainly clear',
				2: 'Partly cloudy',
				3: 'Overcast',
				45: 'Foggy',
				48: 'Depositing rime fog',
				51: 'Light drizzle',
				53: 'Moderate drizzle',
				55: 'Dense drizzle',
				61: 'Slight rain',
				63: 'Moderate rain',
				65: 'Heavy rain',
				71: 'Slight snow',
				73: 'Moderate snow',
				75: 'Heavy snow',
				77: 'Snow grains',
				80: 'Slight rain showers',
				81: 'Moderate rain showers',
				82: 'Violent rain showers',
				85: 'Slight snow showers',
				86: 'Heavy snow showers',
				95: 'Thunderstorm',
				96: 'Thunderstorm with hail',
				99: 'Heavy thunderstorm with hail'
			};

			weather = {
				temp: current.temperature_2m,
				feelsLike: current.apparent_temperature,
				condition: weatherConditions[current.weather_code] || 'Unknown',
				icon: '' // Open-Meteo doesn't provide icons, but we can add custom ones if needed
			};
		} catch (error) {
			console.error('Weather fetch failed:', error);
			// Fallback to a simple weather display
			weather = {
				temp: '--',
				feelsLike: '--',
				condition: 'Weather unavailable',
				icon: ''
			};
		}
	}
</script>

<main class="container">
	<div class="profile">
		<img src="https://avatars.githubusercontent.com/danielnuriyev" alt="Profile photo" class="profile-photo" />
		<h1>Daniel Nuriyev</h1>
		<p class="bio">To learn more about me, please, follow the links below or talk with my AI assistant.</p>

		<div class="social-links">
			<a href="https://www.linkedin.com/in/danielnuriyev/" target="_blank" rel="noopener noreferrer" class="social-link linkedin" aria-label="LinkedIn Profile">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
					<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
				</svg>
			</a>

			<a href="https://github.com/danielnuriyev" target="_blank" rel="noopener noreferrer" class="social-link github" aria-label="GitHub Profile">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
				</svg>
			</a>

			<a href="https://danielnuriyev.github.io/engineering-blog/" target="_blank" rel="noopener noreferrer" class="social-link blog" aria-label="Engineering Blog">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
					<polyline points="14,2 14,8 20,8"></polyline>
					<line x1="16" y1="13" x2="8" y2="13"></line>
					<line x1="16" y1="17" x2="8" y2="17"></line>
					<polyline points="10,9 9,9 8,9"></polyline>
				</svg>
			</a>
		</div>

		<!-- Widgets Section -->
		<div class="widgets">
			<div class="widget time-widget">
				<div class="widget-header">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"></circle>
						<polyline points="12,6 12,12 16,14"></polyline>
					</svg>
					<span>US Eastern Time</span>
				</div>
				<div class="widget-content">
					<div class="time-display">{currentTime}</div>
				</div>
			</div>

			<div class="widget weather-widget">
				<div class="widget-header">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
						<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9l-.707.707M14.828 6.343l.707-.707m-9.9 9.9l.707.707M21 15a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					<span>Massachusetts Weather</span>
				</div>
				<div class="widget-content">
					{#if weather.icon}
						<img src="https:{weather.icon}" alt="Weather icon" class="weather-icon" />
					{/if}
					<div class="weather-info">
						<div class="temperature-row">
							<div class="temperature">{displayTemp}°{tempUnit}</div>
							<div class="feels-like-container">
								<div class="feels-like">Feels like {displayFeelsLike}°{tempUnit}</div>
								<button class="unit-toggle-icon" on:click={toggleTempUnit} title="Switch to {tempUnit === 'F' ? 'Celsius' : 'Fahrenheit'}">
									{tempUnit === 'F' ? 'C' : 'F'}
								</button>
							</div>
						</div>
						<div class="condition">{weather.condition}</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<Chat />
</main>

<style>
	/* GitHub Dark Theme */
	:global(body) {
		background-color: #0d1117;
		color: #f0f6fc;
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
	}

	.container {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
		text-align: center;
		min-height: 100vh;
	}

	.profile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		background: #161b22;
		padding: 2rem;
		border-radius: 12px;
		border: 1px solid #30363d;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		margin-bottom: 2rem;
	}

	.profile-photo {
		width: 200px;
		height: 200px;
		border-radius: 50%;
		object-fit: cover;
		border: 4px solid #58a6ff;
		box-shadow: 0 0 20px rgba(88, 166, 255, 0.3);
		transition: border-color 0.3s ease;
	}

	.profile-photo:hover {
		border-color: #79c0ff;
	}

	h1 {
		font-size: 2.5rem;
		margin: 0;
		color: #f0f6fc;
		font-weight: 600;
		background: linear-gradient(135deg, #58a6ff, #79c0ff);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.bio {
		font-size: 1.2rem;
		color: #c9d1d9;
		max-width: 500px;
		line-height: 1.6;
		opacity: 0.9;
		text-align: left;
	}

	.social-links {
		display: flex;
		gap: 1.5rem;
		justify-content: center;
		margin-top: 0.5rem;
	}

	.social-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 12px;
		background: #21262d;
		border: 1px solid #30363d;
		color: #8b949e;
		text-decoration: none;
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}

	.social-link:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(88, 166, 255, 0.3);
		border-color: #58a6ff;
		color: #f0f6fc;
	}

	.social-link.linkedin:hover {
		background: linear-gradient(135deg, #0077b5, #00a0dc);
		border-color: #0077b5;
	}

	.social-link.github:hover {
		background: linear-gradient(135deg, #333, #24292e);
		border-color: #24292e;
	}

	.social-link.blog:hover {
		background: linear-gradient(135deg, #ff6b35, #f7931e);
		border-color: #ff6b35;
		color: #fff;
	}

	.social-link svg {
		width: 20px;
		height: 20px;
		transition: transform 0.3s ease;
	}

	.social-link:hover svg {
		transform: scale(1.1);
	}

	.widgets {
		display: flex;
		gap: 1.5rem;
		justify-content: center;
		margin-top: 1.5rem;
		flex-wrap: wrap;
	}

	.widget {
		background: #21262d;
		border: 1px solid #30363d;
		border-radius: 12px;
		padding: 1rem;
		min-width: 200px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.widget:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
	}

	.widget-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		font-size: 0.85rem;
		color: #8b949e;
		font-weight: 500;
	}

	.widget-header svg {
		color: #58a6ff;
	}

	.widget-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.time-display {
		font-size: 1.5rem;
		font-weight: 600;
		color: #f0f6fc;
		font-variant-numeric: tabular-nums;
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
	}

	.weather-icon {
		width: 32px;
		height: 32px;
		filter: brightness(0) invert(1); /* Make weather icons white */
	}

	.weather-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.temperature-row {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}

	.temperature {
		font-size: 1.5rem;
		font-weight: 600;
		color: #f0f6fc;
	}

	.feels-like {
		font-size: 0.9rem;
		color: #8b949e;
		font-weight: 500;
	}

	.feels-like-container {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.unit-toggle-icon {
		background: #30363d;
		border: 1px solid #484f58;
		color: #58a6ff;
		cursor: pointer;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s ease;
		width: 20px;
		height: 20px;
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1;
	}

	.unit-toggle-icon:hover {
		background: #484f58;
		color: #f0f6fc;
		border-color: #58a6ff;
	}

	.condition {
		font-size: 0.85rem;
		color: #c9d1d9;
		text-transform: capitalize;
		margin-top: 0.5rem;
		text-align: left;
	}


	@media (max-width: 640px) {
		.social-links {
			gap: 1rem;
		}

		.social-link {
			width: 44px;
			height: 44px;
		}

		.social-link svg {
			width: 18px;
			height: 18px;
		}

		.widgets {
			flex-direction: column;
			align-items: center;
		}

		.widget {
			min-width: 250px;
			max-width: 300px;
		}

		.time-display {
			font-size: 1.25rem;
		}

		.temperature {
			font-size: 1.25rem;
		}

		.feels-like {
			font-size: 0.8rem;
		}

		.temperature-row {
			flex-direction: column;
			gap: 0.25rem;
			align-items: flex-start;
		}
	}
</style>