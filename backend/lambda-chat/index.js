const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');

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
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');

const RATE_LIMITS = {
    requestsPerHour: 50,    // Max requests per IP per hour
    requestsPerDay: 200,    // Max requests per IP per day
    maxMessageLength: 1000, // Max characters per message
    maxMessagesPerRequest: 20 // Max conversation history messages
};

// In-memory rate limiting (in production, use Redis or DynamoDB)
const rateLimitStore = new Map();

// Security helper functions
function validateOrigin(event) {
    const origin = event.headers?.origin || event.headers?.Origin;
    if (!origin) return false;

    return ALLOWED_ORIGINS.includes(origin);
}

function checkRateLimit(clientIP) {
    const now = Date.now();
    const hour = Math.floor(now / (1000 * 60 * 60));
    const day = Math.floor(now / (1000 * 60 * 60 * 24));

    const key = `${clientIP}`;
    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { hourly: new Map(), daily: new Map() });
    }

    const limits = rateLimitStore.get(key);

    // Clean up old entries (older than 24 hours)
    for (const [timestamp] of limits.hourly) {
        if (timestamp < hour - 24) {
            limits.hourly.delete(timestamp);
        }
    }
    for (const [timestamp] of limits.daily) {
        if (timestamp < day - 1) {
            limits.daily.delete(timestamp);
        }
    }

    // Check hourly limit
    const hourlyRequests = limits.hourly.get(hour) || 0;
    if (hourlyRequests >= RATE_LIMITS.requestsPerHour) {
        return { allowed: false, reason: 'Hourly rate limit exceeded' };
    }

    // Check daily limit
    const dailyRequests = limits.daily.get(day) || 0;
    if (dailyRequests >= RATE_LIMITS.requestsPerDay) {
        return { allowed: false, reason: 'Daily rate limit exceeded' };
    }

    // Increment counters
    limits.hourly.set(hour, hourlyRequests + 1);
    limits.daily.set(day, dailyRequests + 1);

    return { allowed: true };
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

// Context about Daniel that will be provided to the AI
const DANIEL_CONTEXT = `
You are an AI assistant representing Daniel Nuriyev. You should respond helpfully and authentically based on the following information about Daniel:

Daniel Nuriyev is a software developer with expertise in:
- Full-stack web development (React, Node.js, Python)
- Cloud infrastructure (AWS, serverless architectures)
- Data engineering and analytics
- Building scalable web applications

Daniel's background:
- Passionate about creating efficient, user-friendly applications
- Experience with modern development practices and tools
- Interested in AI/ML, cloud computing, and distributed systems
- Always learning new technologies and best practices

Key projects and skills:
- Built serverless applications using AWS Lambda, API Gateway, and DynamoDB
- Experience with containerization (Docker, Kubernetes)
- Proficient in multiple programming languages (JavaScript, Python, Go)
- Strong understanding of DevOps practices and CI/CD pipelines

Personality traits:
- Detail-oriented and analytical
- Collaborative team player
- Problem-solver who enjoys tackling complex challenges
- Committed to writing clean, maintainable code

When responding:
- Be friendly and approachable
- Provide accurate information based on the context above
- If asked about something not covered in this context, be honest about limitations
- Keep responses concise but informative
- Show enthusiasm for technology and development
`;

exports.handler = async (event) => {
    const startTime = Date.now();
    const clientIP = getClientIP(event);
    const conversationId = `${clientIP}-${startTime}`;

    console.log('Received chat request from IP:', clientIP, 'ID:', conversationId);

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

        const clientIP = getClientIP(event);
        const rateLimitResult = checkRateLimit(clientIP);
        if (!rateLimitResult.allowed) {
            return {
                statusCode: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Retry-After': '3600'
                },
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
        const prompt = `${DANIEL_CONTEXT}

${conversationHistory}Human: ${message}

Assistant:`;

        // Call Bedrock API (using Claude via Amazon Titan or similar)
        const response = await invokeBedrockModel(prompt);

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
                'X-RateLimit-Remaining': Math.max(0, RATE_LIMITS.requestsPerHour - (rateLimitStore.get(clientIP)?.hourly?.get(Math.floor(Date.now() / (1000 * 60 * 60))) || 0))
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
    try {
        // Using Amazon Nova Micro - lightweight, fast, and cost-effective model
        const modelId = 'amazon.nova-micro-v1:0';

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