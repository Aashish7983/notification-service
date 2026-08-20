# Notification Service

## Features

- Single Email Notifications
- Bulk Email Campaigns
- CSV Upload Support
- Delayed/Scheduled Notifications
- BullMQ Queue Processing
- Retry Mechanism
- Rate Limiting
- Campaign Analytics
- SendGrid Integration

## Tech Stack

- Node.js
- Express.js
- PostgreSQL
- Sequelize
- Redis
- BullMQ
- SendGrid

## Architecture
Client
   ↓
API
   ↓
PostgreSQL
   ↓
BullMQ Queue
   ↓
Worker
   ↓
SendGrid

## Architecture Diagram
Client
   |
   v
Express API
   |
   +---- PostgreSQL
   |
   +---- BullMQ Queue
               |
               v
            Worker
               |
               v
           SendGrid
