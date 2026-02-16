const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { CONTEXT } = require('./context');

// Initialize clients
const region = process.env.AWS_REGION || 'us-east-1';
const useRealBedrock = process.env.USE_REAL_BEDROCK === 'true';

// Configure Bedrock client - use real AWS Bedrock if USE_REAL_BEDROCK=true
const bedrockConfig = { region };
if (useRealBedrock) {
    // Use real AWS Bedrock endpoint, bypassing LocalStack
    bedrockConfig.endpoint = `https://bedrock-runtime.${region}.amazonaws.com`;

    // Use credentials from environment variables when using real Bedrock
    // This is necessary because LocalStack's Lambda environment doesn't automatically
    // pick up the mounted ~/.aws/credentials from the host.
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        bedrockConfig.credentials = {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            sessionToken: process.env.AWS_SESSION_TOKEN // required for temporary credentials
        };
    }
}

const bedrockClient = new BedrockRuntimeClient(bedrockConfig);
const dynamoClient = new DynamoDBClient({ region });

// Security configuration
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000,https://d11eckupyynrjv.cloudfront.net,https://danielnuriyev.info,https://www.danielnuriyev.info').split(',');

const RATE_LIMITS = {
    requestsPerMinute: 10,       // Max requests per IP per minute
    requestsPerDay: 100,         // Max requests per IP per day
    globalRequestsPerMinute: 100, // Max total requests per minute from all IPs
    globalRequestsPerDay: 1000,  // Max total requests per day from all IPs
    maxMessageLength: 1000,      // Max characters per message
    maxMessagesPerRequest: 20    // Max conversation history messages
};

// DynamoDB rate limiting table
const RATE_LIMIT_TABLE = process.env.RATE_LIMIT_TABLE || 'rate-limits';

// Security helper functions
function validateOrigin(event) {
    const origin = event.headers?.origin || event.headers?.Origin;
    if (!origin) return true; // Allow if no origin (for local tests)

    if (ALLOWED_ORIGINS.includes('*')) return true;
    return ALLOWED_ORIGINS.includes(origin);
}

function isBrowserRequest(event) {
    const userAgent = event.headers?.['user-agent'] || event.headers?.['User-Agent'] || '';

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

async function checkRateLimit(clientIP) {
    const now = Date.now();
    const minute = Math.floor(now / (1000 * 60));
    const currentDate = new Date();
    const day = currentDate.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format

    try {
        // Get per-IP rate limit data
        const ipRateLimitData = await getRateLimitData(clientIP);
        // Get global rate limit data
        const globalRateLimitData = await getRateLimitData('GLOBAL');

        // Clean up old entries (older than 1 hour for minutes, 7 days for daily) in both data sets
        const oldMinutesIP = Object.keys(ipRateLimitData.minutely).filter(m => parseInt(m) < minute - 60);
        oldMinutesIP.forEach(oldMinute => {
            delete ipRateLimitData.minutely[oldMinute];
        });

        const oldMinutesGlobal = Object.keys(globalRateLimitData.minutely).filter(m => parseInt(m) < minute - 60);
        oldMinutesGlobal.forEach(oldMinute => {
            delete globalRateLimitData.minutely[oldMinute];
        });

        // Check per-IP minute limit
        const ipMinuteRequests = ipRateLimitData.minutely[minute] || 0;
        if (ipMinuteRequests >= RATE_LIMITS.requestsPerMinute) {
            return { allowed: false, reason: 'Rate limit exceeded' };
        }

        // Check per-IP daily limit
        const ipDailyRequests = ipRateLimitData.daily[day] || 0;
        if (ipDailyRequests >= RATE_LIMITS.requestsPerDay) {
            return { allowed: false, reason: 'Daily limit exceeded (100 requests per day per IP)' };
        }

        // Check global minute limit
        const globalMinuteRequests = globalRateLimitData.minutely[minute] || 0;
        if (globalMinuteRequests >= RATE_LIMITS.globalRequestsPerMinute) {
            return { allowed: false, reason: 'Service temporarily overloaded (global rate limit exceeded)' };
        }

        // Check global daily limit
        const globalDailyRequests = globalRateLimitData.daily[day] || 0;
        if (globalDailyRequests >= RATE_LIMITS.globalRequestsPerDay) {
            return { allowed: false, reason: 'Service daily limit exceeded (1000 requests per day globally)' };
        }

        // All limits passed - increment all counters and update DynamoDB
        const newIPMinuteCount = ipMinuteRequests + 1;
        const newIPDailyCount = ipDailyRequests + 1;
        const newGlobalMinuteCount = globalMinuteRequests + 1;
        const newGlobalDailyCount = globalDailyRequests + 1;

        ipRateLimitData.minutely[minute] = newIPMinuteCount;
        ipRateLimitData.daily[day] = newIPDailyCount;
        globalRateLimitData.minutely[minute] = newGlobalMinuteCount;
        globalRateLimitData.daily[day] = newGlobalDailyCount;

        await updateRateLimit(clientIP, minute, newIPMinuteCount, day, newIPDailyCount);
        await updateRateLimit('GLOBAL', minute, newGlobalMinuteCount, day, newGlobalDailyCount);

        return { allowed: true };
    } catch (error) {
        console.error('Error in checkRateLimit:', error);
        // On error, allow the request to continue (fail open)
        return { allowed: true };
    }
}

function validateRequest(body) {
    if (!body || typeof body !== 'object') {
        return { valid: false, reason: 'Invalid request body' };
    }

    const { message, context } = body;

    if (!message || typeof message !== 'string') {
        return { valid: false, reason: 'Message is required and must be a string' };
    }

    if (message.length > RATE_LIMITS.maxMessageLength) {
        return { valid: false, reason: `Message too long (max ${RATE_LIMITS.maxMessageLength} characters)` };
    }

    if (context && Array.isArray(context) && context.length > RATE_LIMITS.maxMessagesPerRequest) {
        return { valid: false, reason: `Too many context messages (max ${RATE_LIMITS.maxMessagesPerRequest})` };
    }

    // Basic content filtering
    const forbiddenPatterns = [
        /<script/i,
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i
    ];

    const fullContent = message + (context ? context.map(m => m.content || '').join(' ') : '');

    for (const pattern of forbiddenPatterns) {
        if (pattern.test(fullContent)) {
            return { valid: false, reason: 'Potentially malicious content detected' };
        }
    }

    return { valid: true };
}

function getClientIP(event) {
    return event.requestContext?.identity?.sourceIp ||
           event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
           event.headers?.['x-real-ip'] ||
           'unknown';
}

// DynamoDB rate limiting functions
async function getRateLimitData(clientIP) {
    try {
        const command = new GetItemCommand({
            TableName: RATE_LIMIT_TABLE,
            Key: {
                clientIP: { S: clientIP }
            }
        });

        const response = await dynamoClient.send(command);
        if (!response.Item) {
            return { minutely: {}, daily: {} };
        }

        const minutelyLimits = response.Item.minutelyLimits?.M || {};
        const dailyLimits = response.Item.dailyLimits?.M || {};

        const minutely = {};
        const daily = {};

        // Convert DynamoDB maps to regular objects
        for (const [minute, count] of Object.entries(minutelyLimits)) {
            minutely[parseInt(minute)] = parseInt(count.N);
        }
        for (const [day, count] of Object.entries(dailyLimits)) {
            daily[day] = parseInt(count.N);
        }

        return { minutely, daily };
    } catch (error) {
        console.error('Error getting rate limit data:', error);
        // Return empty object on error to allow request but log the issue
        return { minutely: {} };
    }
}

async function updateRateLimit(clientIP, minute, minuteCount, day, dayCount) {
    try {
        // First try to update assuming the maps exist
        const updateCommand = new UpdateItemCommand({
            TableName: RATE_LIMIT_TABLE,
            Key: {
                clientIP: { S: clientIP }
            },
            UpdateExpression: 'SET minutelyLimits.#minute = :minuteCount, dailyLimits.#day = :dayCount, lastUpdated = :timestamp',
            ExpressionAttributeNames: {
                '#minute': minute.toString(),
                '#day': day
            },
            ExpressionAttributeValues: {
                ':minuteCount': { N: minuteCount.toString() },
                ':dayCount': { N: dayCount.toString() },
                ':timestamp': { N: Date.now().toString() }
            }
        });

        try {
            await dynamoClient.send(updateCommand);
        } catch (updateError) {
            // If the map doesn't exist, we'll get a ValidationException
            if (updateError.name === 'ValidationException') {
                // Initialize the item with the first values
                const putCommand = new PutItemCommand({
                    TableName: RATE_LIMIT_TABLE,
                    Item: {
                        clientIP: { S: clientIP },
                        minutelyLimits: { M: { [minute.toString()]: { N: minuteCount.toString() } } },
                        dailyLimits: { M: { [day]: { N: dayCount.toString() } } },
                        lastUpdated: { N: Date.now().toString() }
                    }
                });
                await dynamoClient.send(putCommand);
            } else {
                throw updateError;
            }
        }
    } catch (error) {
        console.error('Error updating rate limit:', error);
        // Don't throw - allow request to continue even if rate limiting fails
    }
}

async function cleanupOldRateLimits() {
    try {
        const now = Date.now();
        const currentMinute = Math.floor(now / (1000 * 60));
        const cutoffMinute = currentMinute - 60; // Clean up minute entries older than 1 hour

        // Get current date and cutoff date for daily cleanup (7 days ago)
        const currentDate = new Date();
        const cutoffDate = new Date(currentDate);
        cutoffDate.setDate(currentDate.getDate() - 7);
        const cutoffDay = cutoffDate.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format

        // Scan for all items and clean up old limits
        const scanCommand = new ScanCommand({
            TableName: RATE_LIMIT_TABLE
        });

        const response = await dynamoClient.send(scanCommand);

        for (const item of response.Items || []) {
            const clientIP = item.clientIP.S;
            const minutelyLimits = item.minutelyLimits?.M || {};
            const dailyLimits = item.dailyLimits?.M || {};

            // Check for old minute entries (older than 1 hour)
            const oldMinutes = Object.keys(minutelyLimits).filter(minute => parseInt(minute) < cutoffMinute);

            // Check for old daily entries (older than 7 days)
            const oldDays = Object.keys(dailyLimits).filter(day => day < cutoffDay);

            const updates = [];

            if (oldMinutes.length > 0) {
                updates.push(`REMOVE ${oldMinutes.map(minute => `minutelyLimits.#minute${minute}`).join(', ')}`);
            }

            if (oldDays.length > 0) {
                updates.push(`REMOVE ${oldDays.map(day => `dailyLimits.#day${day}`).join(', ')}`);
            }

            if (updates.length > 0) {
                const updateExpression = updates.join(', ');
                const expressionAttributeNames = {};

                oldMinutes.forEach(minute => {
                    expressionAttributeNames[`#minute${minute}`] = minute;
                });
                oldDays.forEach(day => {
                    expressionAttributeNames[`#day${day}`] = day;
                });

                const updateCommand = new UpdateItemCommand({
                    TableName: RATE_LIMIT_TABLE,
                    Key: {
                        clientIP: { S: clientIP }
                    },
                    UpdateExpression: updateExpression,
                    ExpressionAttributeNames: expressionAttributeNames
                });

                await dynamoClient.send(updateCommand);
            }
        }
    } catch (error) {
        console.error('Error cleaning up old rate limits:', error);
    }
}

// Logging function to store conversations in DynamoDB
async function logConversation(conversationData) {
    try {
        const tableName = process.env.CHAT_LOGS_TABLE || 'chat-conversations';

        const item = {
            conversationId: { S: conversationData.conversationId },
            timestamp: { S: conversationData.timestamp },
            clientIP: { S: conversationData.clientIP },
            userAgent: { S: conversationData.userAgent || 'unknown' },
            origin: { S: conversationData.origin || 'unknown' },
            message: { S: conversationData.message },
            contextLength: { N: conversationData.contextLength.toString() },
            response: { S: conversationData.response || '' },
            status: { S: conversationData.status },
            processingTime: { N: conversationData.processingTime.toString() },
            errorMessage: { S: conversationData.errorMessage || '' }
        };

        const command = new PutItemCommand({
            TableName: tableName,
            Item: item
        });

        await dynamoClient.send(command);
        console.log('Conversation logged successfully:', conversationData.conversationId);
    } catch (error) {
        console.error('Failed to log conversation:', error);
        // Don't throw error - logging failure shouldn't break the chat
    }
}


exports.handler = async (event) => {
    const startTime = Date.now();
    const clientIP = getClientIP(event);
    const conversationId = `${clientIP}-${startTime}`;

    console.log('Received chat request from IP:', clientIP, 'ID:', conversationId);

    // Periodic cleanup of old rate limit entries (1% chance per request)
    if (Math.random() < 0.01) {
        await cleanupOldRateLimits();
    }

    try {
        // Security validations
        if (!validateOrigin(event)) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Access denied: Invalid origin'
                })
            };
        }

        // Skip browser validation for development (LocalStack)
        // TODO: Re-enable for production deployment
        /*
        if (!isBrowserRequest(event)) {
            return {
                statusCode: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Access denied',
                    message: 'This endpoint only accepts requests from web browsers'
                })
            };
        }
        */

        const clientIP = getClientIP(event);
        const rateLimitResult = await checkRateLimit(clientIP);
        if (!rateLimitResult.allowed) {
            const isGlobalLimit = rateLimitResult.reason.includes('global');
            const isDailyLimit = rateLimitResult.reason.includes('daily');
            const headers = {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Retry-After': isDailyLimit ? '86400' : '60', // 24 hours for daily, 1 minute for minute limits
            };

            if (isGlobalLimit && isDailyLimit) {
                // Global daily limit exceeded
                headers['X-RateLimit-Global-Daily-Limit'] = RATE_LIMITS.globalRequestsPerDay.toString();
            } else if (isGlobalLimit) {
                // Global minute limit exceeded
                headers['X-RateLimit-Global-Limit'] = RATE_LIMITS.globalRequestsPerMinute.toString();
            } else if (isDailyLimit) {
                // Per-IP daily limit exceeded
                headers['X-RateLimit-Daily-Limit'] = RATE_LIMITS.requestsPerDay.toString();
            } else {
                // Per-IP minute limit exceeded
                headers['X-RateLimit-Limit'] = RATE_LIMITS.requestsPerMinute.toString();
                headers['X-RateLimit-Reset'] = (Math.floor(Date.now() / (1000 * 60)) * 60 + 60).toString();
            }

            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({
                    error: 'Rate limit exceeded',
                    message: rateLimitResult.reason
                })
            };
        }

        const body = JSON.parse(event.body || '{}');
        const validation = validateRequest(body);
        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Invalid request',
                    message: validation.reason
                })
            };
        }

        const { message, context = [] } = body;

        if (!message) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
                },
                body: JSON.stringify({ error: 'Message is required' })
            };
        }

        // Prepare conversation history for context
        let conversationHistory = '';

        if (context && context.length > 0) {
            // Convert context to a readable format for the AI
            conversationHistory = context.map(msg => {
                return `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`;
            }).join('\n\n') + '\n\n';
        }

        // Prepare the prompt for Bedrock
        const prompt = `${CONTEXT}

${conversationHistory}Human: ${message}

Assistant:`;

        // Call Bedrock API (using Claude via Amazon Titan or similar)
        const response = await invokeBedrockModel(prompt);

        // Get current rate limit data for headers
        const currentRateLimitData = await getRateLimitData(clientIP);
        const globalRateLimitData = await getRateLimitData('GLOBAL');
        const currentMinute = Math.floor(Date.now() / (1000 * 60));
        const currentDate = new Date();
        const currentDay = currentDate.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format

        const currentMinutelyRequests = currentRateLimitData.minutely[currentMinute] || 0;
        const currentDailyRequests = currentRateLimitData.daily[currentDay] || 0;
        const currentGlobalRequests = globalRateLimitData.minutely[currentMinute] || 0;
        const currentGlobalDailyRequests = globalRateLimitData.daily[currentDay] || 0;

        const remainingRequests = Math.max(0, RATE_LIMITS.requestsPerMinute - currentMinutelyRequests);
        const remainingDailyRequests = Math.max(0, RATE_LIMITS.requestsPerDay - currentDailyRequests);
        const remainingGlobalRequests = Math.max(0, RATE_LIMITS.globalRequestsPerMinute - currentGlobalRequests);
        const remainingGlobalDailyRequests = Math.max(0, RATE_LIMITS.globalRequestsPerDay - currentGlobalDailyRequests);

        // Log successful conversation
        await logConversation({
            conversationId,
            timestamp: new Date().toISOString(),
            clientIP,
            userAgent: event.headers?.['user-agent'] || 'unknown',
            origin: event.headers?.origin || 'unknown',
            message,
            contextLength: context.length,
            response,
            status: 'success',
            processingTime: Date.now() - startTime
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': event.headers?.origin || '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'X-RateLimit-Remaining': remainingRequests.toString(),
                'X-RateLimit-Limit': RATE_LIMITS.requestsPerMinute.toString(),
                'X-RateLimit-Reset': (Math.floor(Date.now() / (1000 * 60)) * 60 + 60).toString(), // Next minute in Unix timestamp
                'X-RateLimit-Daily-Remaining': remainingDailyRequests.toString(),
                'X-RateLimit-Daily-Limit': RATE_LIMITS.requestsPerDay.toString(),
                'X-RateLimit-Global-Remaining': remainingGlobalRequests.toString(),
                'X-RateLimit-Global-Limit': RATE_LIMITS.globalRequestsPerMinute.toString(),
                'X-RateLimit-Global-Daily-Remaining': remainingGlobalDailyRequests.toString(),
                'X-RateLimit-Global-Daily-Limit': RATE_LIMITS.globalRequestsPerDay.toString()
            },
            body: JSON.stringify({
                response: response,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Error processing chat request:', error);

        // Log failed conversation
        await logConversation({
            conversationId,
            timestamp: new Date().toISOString(),
            clientIP,
            userAgent: event.headers?.['user-agent'] || 'unknown',
            origin: event.headers?.origin || 'unknown',
            message: event.body ? JSON.parse(event.body).message || '' : '',
            contextLength: 0,
            status: 'error',
            processingTime: Date.now() - startTime,
            errorMessage: error.message
        });

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};

async function invokeBedrockModel(prompt) {
    // If not using real Bedrock (LocalStack mode), return mock response
    if (!useRealBedrock) {
        console.log('Using LocalStack mock mode - returning simulated response');
        return 'I apologize, but I\'m having trouble connecting to my knowledge base right now. Daniel is a skilled software developer with expertise in full-stack development, cloud infrastructure, and modern web technologies. Feel free to ask me about his background, skills, or projects!';
    }

    try {
        // Using Amazon Nova Lite - lightweight, fast, and cost-effective model
        const modelId = 'amazon.nova-lite-v1:0';

        const requestBody = {
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            text: prompt
                        }
                    ]
                }
            ],
            inferenceConfig: {
                max_new_tokens: 512,
                temperature: 0.7,
                top_p: 0.9
            }
        };

        const command = new InvokeModelCommand({
            modelId: modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(requestBody)
        });

        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        // Extract the generated text from Nova response structure
        return responseBody.output?.message?.content[0]?.text || 'I apologize, but I couldn\'t generate a response right now.';

    } catch (error) {
        console.error('Error invoking Bedrock model:', error.message);

        // Fallback response if Bedrock fails
        return 'I apologize, but I\'m having trouble connecting to my knowledge base right now. Daniel is a skilled software developer with expertise in full-stack development, cloud infrastructure, and modern web technologies. Feel free to ask me about his background, skills, or projects!';
    }
}