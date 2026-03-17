# Stage 1: Backend Builder
FROM golang:1.21-alpine AS backend-builder

WORKDIR /build
COPY backend/ .
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Stage 2: Frontend Builder
FROM node:18-alpine AS frontend-builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 3: Backend Runtime
FROM alpine:3.18 AS backend

RUN apk add --no-cache ca-certificates
WORKDIR /app/backend
COPY --from=backend-builder /build/main .

EXPOSE 8080
CMD ["./main"]

# Stage 4: Frontend Dev
FROM node:18-alpine AS frontend-dev

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .

EXPOSE 5173
CMD ["npm", "run", "dev"]

# Stage 5: Production Image (frontend + backend)
FROM alpine:3.18 AS production

RUN apk add --no-cache ca-certificates
WORKDIR /app

# Copy backend
COPY --from=backend-builder /build/main ./backend/main

# Copy frontend built assets
COPY --from=frontend-builder /app/dist ./frontend/dist

EXPOSE 8080
CMD ["./backend/main"]
