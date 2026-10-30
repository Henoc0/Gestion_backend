FROM node:22.18.0
WORKDIR /usr/src/api-server
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]  
