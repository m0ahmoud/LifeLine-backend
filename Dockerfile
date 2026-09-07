# Step 1: Build TypeScript Code
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript compiler)
RUN npm install

# Copy application source code
COPY . .

# Compile TypeScript to JavaScript
RUN npx tsc

# Copy static email templates (.ejs files) to the compiled dist folder
RUN mkdir -p dist/mails && cp -r mails/* dist/mails/

# Step 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy dependency definitions
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy compiled JavaScript code and templates from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the application port
EXPOSE 8080

# Start the Node.js server
CMD ["node", "dist/server.js"]
