#!/usr/bin/env node

import { StreamableMCPServer } from './streamable-server.js';

const PORT = parseInt(process.env.MCP_PORT || '3002');
const PROJECT_SERVER_URL = process.env.PROJECT_SERVER_URL || 'http://localhost:3001';

console.log('Starting Claude Code MCP Server...');
console.log(`Port: ${PORT}`);
console.log(`Project Server: ${PROJECT_SERVER_URL}`);

const server = new StreamableMCPServer(PORT, PROJECT_SERVER_URL);
server.start(PORT);