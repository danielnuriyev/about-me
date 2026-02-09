exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Simple API response for the about me page
    const response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify({
            name: 'Daniel Nuriyev',
            title: 'Software Developer',
            bio: 'Passionate about building web applications and cloud infrastructure.',
            skills: ['JavaScript', 'Python', 'AWS', 'React', 'Node.js'],
            contact: {
                email: 'daniel@example.com',
                linkedin: 'https://linkedin.com/in/danielnuriyev'
            }
        })
    };

    return response;
};