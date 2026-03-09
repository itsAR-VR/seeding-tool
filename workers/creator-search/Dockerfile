FROM mcr.microsoft.com/playwright:v1.58.1-noble

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-fund --no-audit

COPY server.mjs ./

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.mjs"]
