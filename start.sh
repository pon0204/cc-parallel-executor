#!/bin/bash

# Start Socket.IO server in background
echo "Starting Socket.IO server on port 3001..."
node server-simple.js &
SERVER_PID=$!

# Wait a bit for server to start
sleep 2

# Start Next.js dev server
echo "Starting Next.js on port 3000..."
npm run dev

# When Next.js exits, kill the server too
kill $SERVER_PID 2>/dev/null