const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

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
    console.log('Received chat event:', JSON.stringify(event, null, 2));

    try {
        const body = JSON.parse(event.body || '{}');
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

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                response: response,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Error processing chat request:', error);

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
                    content: prompt
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
        console.error('Error invoking Bedrock model:', error);

        // Fallback response if Bedrock fails
        return 'I apologize, but I\'m having trouble connecting to my knowledge base right now. Daniel is a skilled software developer with expertise in full-stack development, cloud infrastructure, and modern web technologies. Feel free to ask me about his background, skills, or projects!';
    }
}