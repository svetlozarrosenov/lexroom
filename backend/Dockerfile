FROM node:22-slim
WORKDIR /app
COPY package*.json ./
# --ignore-scripts: better-sqlite3 ships prebuilt binaries for every platform, but npm,
# when installing from a lockfile, does not see its "gypfile": false and tries to run
# `node-gyp rebuild`, which fails without python/make/g++. The only package in the
# lockfile with an install script is fsevents (macOS-only), so skipping scripts is safe.
RUN npm ci --legacy-peer-deps --ignore-scripts
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]
