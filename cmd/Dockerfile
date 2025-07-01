# Build stage
FROM golang:1.22.5 as builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o server ./cmd

# Final stage
FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/web ./web
COPY --from=builder /app/forum.db .
COPY --from=builder /app/internal/database/migrations /app/internal/database/migrations
EXPOSE 8080
CMD ["./server"]
