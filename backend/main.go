package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/m1xxos/namespace-invaders/api"
	"github.com/m1xxos/namespace-invaders/k8s"
)

func main() {
	port := flag.String("port", "8080", "Server port")
	flag.Parse()

	// Initialize K8s client
	if err := k8s.InitClient(); err != nil {
		log.Fatalf("Failed to initialize K8s client: %v", err)
	}

	// Setup HTTP routes
	mux := http.NewServeMux()
	
	// CORS middleware
	handler := corsMiddleware(mux)

	// Routes
	mux.HandleFunc("/api/namespaces", api.GetNamespacesHandler)
	mux.HandleFunc("/api/resources", api.GetResourcesHandler)
	mux.HandleFunc("/api/resources/delete", api.DeleteResourceHandler)

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok"}`)
	})

	addr := ":" + *port
	log.Printf("Server starting on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
		os.Exit(1)
	}
}

func corsMiddleware(next *http.ServeMux) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
