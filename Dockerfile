FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY plugins ./plugins
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=4321
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/seed ./seed
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
