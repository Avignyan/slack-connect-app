FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./
RUN npm install

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Expose the port your app runs on
EXPOSE 8000

# Set NODE_ENV
ENV NODE_ENV=production

# Start the application in dev mode (which includes dotenv loading)
CMD ["npm", "run", "dev"]