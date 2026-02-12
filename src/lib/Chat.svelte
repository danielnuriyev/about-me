<script>
	import { onMount } from 'svelte';

	let messages = [];
	let inputMessage = '';
	let isLoading = false;
	let messageCount = 0;
	let rateLimitReached = false;
	const MAX_MESSAGES = 10;

	// Function to send message to backend
	async function sendMessage() {
		if (!inputMessage.trim() || isLoading) return;

		// Check rate limit
		if (messageCount >= MAX_MESSAGES) {
			messages = [...messages, {
				role: 'assistant',
				content: `You've reached the maximum of ${MAX_MESSAGES} messages per session. This limit helps ensure fair usage for all visitors.`
			}];
			rateLimitReached = true;
			return;
		}

		const userMessage = inputMessage.trim();
		inputMessage = '';

		// Add user message to chat
		messages = [...messages, { role: 'user', content: userMessage }];
		messageCount++;
		isLoading = true;

	try {
		// Use SvelteKit server endpoint to avoid CORS issues
		const response = await fetch('/api/chat', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				message: userMessage,
				context: messages.slice(-10) // Send last 10 messages for context
			})
		});

		const data = await response.json();

			if (response.ok) {
				messages = [...messages, { role: 'assistant', content: data.response }];
			} else {
				messages = [...messages, {
					role: 'assistant',
					content: `Error: ${data.error || 'Something went wrong'}`
				}];
			}
		} catch (error) {
			messages = [...messages, {
				role: 'assistant',
				content: `Error: ${error.message}`
			}];
		}

		isLoading = false;

		// Scroll to bottom
		setTimeout(() => {
			const chatContainer = document.querySelector('.chat-messages');
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		}, 100);
	}

	// Handle Enter key
	function handleKeydown(event) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	// Scroll to profile section
	function scrollToProfile() {
		const profileElement = document.getElementById('profile');
		if (profileElement) {
			profileElement.scrollIntoView({
				behavior: 'smooth',
				block: 'start'
			});
		}
	}

	onMount(() => {
		// Add welcome message
		messages = [{
			role: 'assistant',
			content: 'Hi! I\'m dAnIel, Daniel\'s AI spokesbot. Feel free to ask me anything about his professional skills.'
		}];
	});
</script>

<div class="chat-container">
	<div class="chat-header">
		<h3>💬 Chat with my AI spokesbot</h3>
	</div>

	<div class="chat-messages">
		{#each messages as message, index (index)}
			<div class="message {message.role}">
				<div class="message-content">
					{message.content}
				</div>
			</div>
		{/each}
		{#if isLoading}
			<div class="message assistant loading">
				<div class="message-content">
					<span class="typing-indicator">
						<span></span>
						<span></span>
						<span></span>
					</span>
				</div>
			</div>
		{/if}
	</div>

	{#if messageCount >= MAX_MESSAGES - 1 && !rateLimitReached}
		<div class="rate-limit-warning">
			⚠️ {MAX_MESSAGES - messageCount} message{MAX_MESSAGES - messageCount === 1 ? '' : 's'} remaining
		</div>
	{/if}

	<div class="chat-input">
		<textarea
			bind:value={inputMessage}
			on:keydown={handleKeydown}
			placeholder={rateLimitReached ? "Message limit reached" : "Type your message here..."}
			rows="1"
			disabled={isLoading || rateLimitReached}
		></textarea>
		<button
			on:click={sendMessage}
			disabled={isLoading || !inputMessage.trim() || rateLimitReached}
			class="send-button"
		>
			{isLoading ? '...' : rateLimitReached ? 'Limit Reached' : 'Send'}
		</button>
	</div>

	{#if rateLimitReached}
		<div class="rate-limit-actions">
			<p>Want to learn more about me?</p>
			<button class="profile-link" on:click={scrollToProfile}>
				👆 Check out my profile above
			</button>
		</div>
	{/if}

	<div class="chat-footer">
		<a
			href="https://github.com/danielnuriyev/about-me"
			target="_blank"
			rel="noopener noreferrer"
			class="github-link"
		>
			<svg class="github-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
				<path d="m8 0c-4.42 0-8 3.58-8 8 0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c-4.42 0-8-3.58-8-8z"></path>
			</svg>
			View Source on GitHub
		</a>
	</div>
</div>

<style>
	.chat-container {
		max-width: 800px;
		margin: 2rem auto;
		border: 1px solid #30363d;
		border-radius: 12px;
		background: #161b22;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
		overflow: hidden;
	}

	.chat-header {
		background: #0d1117;
		color: #f0f6fc;
		padding: 1rem;
		text-align: center;
		border-bottom: 1px solid #21262d;
	}

	.chat-header h3 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 600;
	}

	.chat-messages {
		height: 400px;
		overflow-y: auto;
		padding: 1rem;
		background: #0d1117;
		scrollbar-width: thin;
		scrollbar-color: #30363d #161b22;
	}

	.chat-messages::-webkit-scrollbar {
		width: 8px;
	}

	.chat-messages::-webkit-scrollbar-track {
		background: #161b22;
	}

	.chat-messages::-webkit-scrollbar-thumb {
		background: #30363d;
		border-radius: 4px;
	}

	.chat-messages::-webkit-scrollbar-thumb:hover {
		background: #484f58;
	}

	.message {
		margin-bottom: 1rem;
		display: flex;
	}

	.message.user {
		justify-content: flex-end;
	}

	.message.assistant {
		justify-content: flex-start;
	}

	.message-content {
		max-width: 70%;
		padding: 0.75rem 1rem;
		border-radius: 18px;
		font-size: 0.95rem;
		line-height: 1.4;
		word-wrap: break-word;
	}

	.message.user .message-content {
		background: #238636;
		color: #f0f6fc;
		border-bottom-right-radius: 4px;
		box-shadow: 0 2px 8px rgba(35, 134, 54, 0.3);
	}

	.message.assistant .message-content {
		background: #21262d;
		color: #c9d1d9;
		border: 1px solid #30363d;
		border-bottom-left-radius: 4px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		text-align: left;
	}

	.message.loading .message-content {
		color: #8b949e;
		font-style: italic;
	}

	.typing-indicator {
		display: inline-flex;
		gap: 2px;
	}

	.typing-indicator span {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #8b949e;
		animation: typing 1.4s infinite;
	}

	.typing-indicator span:nth-child(1) { animation-delay: 0s; }
	.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
	.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

	@keyframes typing {
		0%, 60%, 100% { transform: translateY(0); }
		30% { transform: translateY(-8px); }
	}

	.chat-input {
		display: flex;
		padding: 1rem;
		background: #161b22;
		border-top: 1px solid #21262d;
		gap: 0.5rem;
	}

	.chat-input textarea {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid #30363d;
		border-radius: 20px;
		resize: none;
		font-family: inherit;
		font-size: 0.95rem;
		outline: none;
		transition: border-color 0.2s, box-shadow 0.2s;
		background: #0d1117;
		color: #f0f6fc;
	}

	.chat-input textarea:focus {
		border-color: #58a6ff;
		box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
	}

	.chat-input textarea::placeholder {
		color: #8b949e;
	}

	.chat-input textarea:disabled {
		background: #161b22;
		color: #8b949e;
		cursor: not-allowed;
		opacity: 0.6;
	}

	.send-button {
		padding: 0.75rem 1.5rem;
		background: #58a6ff;
		color: #f0f6fc;
		border: none;
		border-radius: 20px;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s, box-shadow 0.2s;
	}

	.send-button:hover:not(:disabled) {
		background: #79c0ff;
		box-shadow: 0 0 8px rgba(88, 166, 255, 0.4);
	}

	.send-button:disabled {
		background: #30363d;
		color: #8b949e;
		cursor: not-allowed;
		box-shadow: none;
	}

	.rate-limit-warning {
		padding: 0.75rem 1rem;
		background: #bb800926;
		border: 1px solid #bb80094d;
		border-radius: 6px;
		margin: 0 1rem 0.5rem 1rem;
		color: #f85149;
		font-size: 0.9rem;
		font-weight: 500;
		text-align: center;
	}

	.rate-limit-actions {
		padding: 1rem;
		text-align: center;
		border-top: 1px solid #30363d;
		background: #161b22;
		margin-top: 0.5rem;
	}

	.rate-limit-actions p {
		margin: 0 0 0.75rem 0;
		color: #c9d1d9;
		font-size: 0.95rem;
	}

	.chat-footer {
		padding: 1rem;
		text-align: center;
		border-top: 1px solid #21262d;
		background: #161b22;
	}

	.github-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: #58a6ff;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		transition: background-color 0.2s, color 0.2s;
	}

	.github-link:hover {
		background: rgba(88, 166, 255, 0.1);
		color: #79c0ff;
		text-decoration: none;
	}

	.github-icon {
		flex-shrink: 0;
	}

	@media (max-width: 640px) {
		.chat-container {
			margin: 1rem;
			max-width: none;
		}

		.chat-messages {
			height: 300px;
		}

		.message-content {
			max-width: 85%;
		}

		.chat-footer {
			padding: 0.75rem;
		}

		.github-link {
			font-size: 0.85rem;
			padding: 0.5rem 0.75rem;
		}
	}
</style>