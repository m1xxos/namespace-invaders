package k8s

import (
	"context"
	"fmt"
	"log"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// DeleteResourceWithForce deletes a resource by kind and name with force option
func DeleteResourceWithForce(namespace, kind, name string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	gracePeriod := int64(0)
	deleteOptions := &metav1.DeleteOptions{
		GracePeriodSeconds: &gracePeriod,
	}

	switch kind {
	case "Pod":
		return clientset.CoreV1().Pods(namespace).Delete(ctx, name, *deleteOptions)
	case "Deployment":
		return clientset.AppsV1().Deployments(namespace).Delete(ctx, name, *deleteOptions)
	case "ReplicaSet":
		// Delete ReplicaSet and its owned pods
		return clientset.AppsV1().ReplicaSets(namespace).Delete(ctx, name, *deleteOptions)
	case "StatefulSet":
		return clientset.AppsV1().StatefulSets(namespace).Delete(ctx, name, *deleteOptions)
	case "ConfigMap":
		return clientset.CoreV1().ConfigMaps(namespace).Delete(ctx, name, *deleteOptions)
	case "Secret":
		return clientset.CoreV1().Secrets(namespace).Delete(ctx, name, *deleteOptions)
	case "Service":
		return clientset.CoreV1().Services(namespace).Delete(ctx, name, *deleteOptions)
	case "Ingress":
		return clientset.NetworkingV1().Ingresses(namespace).Delete(ctx, name, *deleteOptions)
	default:
		// Try dynamic client for custom resources
		return deleteCustomResource(ctx, namespace, kind, name)
	}
}

// deleteCustomResource deletes a custom resource
func deleteCustomResource(ctx context.Context, namespace, kind, name string) error {
	// Try common CRD groups
	crdGroups := []string{
		"sample.k8s.io",
		"example.com",
		"apps.example.com",
	}

	for _, group := range crdGroups {
		for _, version := range []string{"v1", "v1alpha1", "v1beta1"} {
			gvr := metav1.GroupVersionKind{
				Group:   group,
				Version: version,
				Kind:    kind,
			}

			// Try to delete
			unversioned := dynamicClient.Resource(
				gvr.GroupVersion().WithResource(pluralizeKind(kind)),
			).Namespace(namespace)

			err := unversioned.Delete(ctx, name, *metav1.NewDeleteOptions(0))
			if err == nil {
				log.Printf("Deleted %s/%s from %s", kind, name, group)
				return nil
			}
			log.Printf("Failed to delete from %s: %v", group, err)
		}
	}

	return fmt.Errorf("resource not found or unable to delete: %s", kind)
}

// pluralizeKind converts Kind to resource name (simplified)
func pluralizeKind(kind string) string {
	// Simple pluralization rules
	lowerKind := kind
	if len(lowerKind) > 0 {
		lowerKind = string(lowerKind[0] + 32) + lowerKind[1:]
	}

	switch {
	case lowerKind == "configmap":
		return "configmaps"
	case lowerKind == "secret":
		return "secrets"
	case lowerKind[len(lowerKind)-1] == 's':
		return lowerKind + "es"
	case lowerKind[len(lowerKind)-1] == 'y':
		return lowerKind[:len(lowerKind)-1] + "ies"
	default:
		return lowerKind + "s"
	}
}
