package k8s

import (
	"log"
	"os"
	"path/filepath"

	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

var (
	clientset       kubernetes.Interface
	dynamicClient   dynamic.Interface
	discoveryClient interface{}
)

// InitClient initializes the K8s client
func InitClient() error {
	var config *rest.Config
	var err error

	// Try to load in-cluster config first
	config, err = rest.InClusterConfig()
	if err != nil {
		// Fallback to kubeconfig
		kubeconfig := os.Getenv("KUBECONFIG")
		if kubeconfig == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return err
			}
			kubeconfig = filepath.Join(home, ".kube", "config")
		}

		log.Printf("Using kubeconfig: %s", kubeconfig)
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return err
		}
	}

	var errClient error
	clientset, errClient = kubernetes.NewForConfig(config)
	if errClient != nil {
		return errClient
	}

	var errDynamic error
	dynamicClient, errDynamic = dynamic.NewForConfig(config)
	if errDynamic != nil {
		return errDynamic
	}

	log.Println("K8s client initialized successfully")
	return nil
}

// GetClientset returns Kubernetes clientset
func GetClientset() kubernetes.Interface {
	return clientset
}

// GetDynamicClient returns dynamic client for arbitrary resources
func GetDynamicClient() dynamic.Interface {
	return dynamicClient
}
