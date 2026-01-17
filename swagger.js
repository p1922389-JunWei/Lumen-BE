const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LUMEN Backend API',
      version: '1.0.0',
      description: 'API documentation for LUMEN - A system for managing events with participants and volunteers',
      contact: {
        name: 'LUMEN Team'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            userID: {
              type: 'integer',
              description: 'Unique user identifier'
            },
            fullName: {
              type: 'string',
              description: 'Full name of the user'
            },
            NRIC: {
              type: 'string',
              description: 'National Registration Identity Card'
            },
            role: {
              type: 'string',
              enum: ['participant', 'volunteer', 'staff'],
              description: 'User role'
            },
            image_url: {
              type: 'string',
              description: 'URL to user profile image'
            }
          }
        },
        Event: {
          type: 'object',
          properties: {
            eventID: {
              type: 'integer',
              description: 'Unique event identifier'
            },
            eventName: {
              type: 'string',
              description: 'Name of the event'
            },
            eventDescription: {
              type: 'string',
              description: 'Description of the event'
            },
            disabled_friendly: {
              type: 'boolean',
              description: 'Whether the event is disabled-friendly'
            },
            datetime: {
              type: 'string',
              format: 'date-time',
              description: 'Event date and time'
            },
            location: {
              type: 'string',
              description: 'Event location'
            },
            additional_information: {
              type: 'string',
              description: 'Additional event information'
            },
            created_by: {
              type: 'integer',
              description: 'ID of staff member who created the event'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            token: {
              type: 'string',
              description: 'JWT token for authentication'
            },
            data: {
              type: 'object',
              properties: {
                userID: { type: 'integer' },
                fullName: { type: 'string' },
                NRIC: { type: 'string' },
                role: { type: 'string' },
                image_url: { type: 'string' }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Error message'
            }
          }
        }
      }
    }
  },
  apis: ['./routes/api.js']
};

const specs = swaggerJsdoc(options);

module.exports = specs;
