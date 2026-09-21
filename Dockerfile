FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 QUOTA_FILE=/data/api-usage.json
COPY --chown=node:node package.json server.mjs integrations.mjs tourism.mjs request-guard.mjs ./
COPY --chown=node:node public ./public
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 4173
CMD ["node", "server.mjs"]
