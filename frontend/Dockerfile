# Stage 1: Build the Angular app
FROM node:22-alpine AS build
WORKDIR /app
# Copy package manifests first to leverage Docker cache for dependencies
COPY frontend-app/package*.json ./
RUN npm ci --silent
COPY frontend-app/ .
# Build production bundle
RUN npx ng build --configuration production

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy built artifacts from Angular output folder
COPY --from=build /app/dist/frontend-app/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
