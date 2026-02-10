<script>
	// Basic about me page component
	import Chat from '$lib/Chat.svelte';
</script>

<main class="container">
	<div class="profile">
		<img src="https://avatars.githubusercontent.com/danielnuriyev" alt="Profile photo" class="profile-photo" />
		<h1>Daniel Nuriyev</h1>
		<p class="bio">To learn more about me, please, follow the links below or talk with my AI spokesbot.</p>

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
	}
</style>