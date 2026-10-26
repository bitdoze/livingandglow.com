# Debian (glibc), not alpine: the workerd sandbox runner ships a glibc-only
# binary and cannot execute under musl, which would leave registry plugins
# (widgets, contact forms) dead in the container.
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY plugins ./plugins
RUN npm ci

FROM deps AS build
# Adapter selection is baked at build time — flags carry no secrets.
ARG EMDASH_DB=sqlite
ARG EMDASH_STORAGE=local
ENV EMDASH_DB=$EMDASH_DB EMDASH_STORAGE=$EMDASH_STORAGE
COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-bookworm-slim AS runner
# workerd needs the system CA store for TLS (slim images ship none).
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=4321
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/seed ./seed
COPY scripts ./scripts
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
