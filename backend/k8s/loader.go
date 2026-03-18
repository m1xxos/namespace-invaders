package k8s

import (
	"context"
	"log"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// GetNamespaces returns list of all namespaces
func GetNamespaces() ([]Namespace, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	namespaces, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]Namespace, 0)
	for _, ns := range namespaces.Items {
		result = append(result, Namespace{Name: ns.Name})
	}
	return result, nil
}

// GetResourcesInNamespace returns all resources in a namespace
func GetResourcesInNamespace(namespace string) ([]Resource, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	resources := make([]Resource, 0)

	// Get Pods
	pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Error getting pods: %v", err)
	} else {
		for _, p := range pods.Items {
			// Skip pods that belong to a ReplicaSet
			if len(p.OwnerReferences) > 0 {
				isOwnedByRS := false
				for _, owner := range p.OwnerReferences {
					if owner.Kind == "ReplicaSet" {
						isOwnedByRS = true
						break
					}
				}
				if isOwnedByRS {
					continue
				}
			}
			resources = append(resources, Resource{
				UID:       string(p.UID),
				Name:      p.Name,
				Namespace: p.Namespace,
				Kind:      "Pod",
			})
		}
	}

	// Get Deployments and ReplicaSets
	deployments, err := clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Error getting deployments: %v", err)
	}

	replicaSets, err := clientset.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Error getting replicasets: %v", err)
	}

	deploymentOwnerPods := map[string][]string{}
	if deployments != nil && replicaSets != nil && pods != nil {
		rsToDeployment := map[string]string{}
		for _, rs := range replicaSets.Items {
			for _, owner := range rs.OwnerReferences {
				if owner.Kind == "Deployment" {
					rsToDeployment[rs.Name] = owner.Name
					break
				}
			}
		}

		for _, p := range pods.Items {
			for _, owner := range p.OwnerReferences {
				if owner.Kind == "ReplicaSet" {
					if deploymentName, ok := rsToDeployment[owner.Name]; ok {
						deploymentOwnerPods[deploymentName] = append(
							deploymentOwnerPods[deploymentName],
							p.Name,
						)
					}
				}
			}
		}
	}

	if deployments != nil {
		for _, d := range deployments.Items {
			ownerPods := []string{}
			if podsForDeployment, ok := deploymentOwnerPods[d.Name]; ok {
				seen := map[string]bool{}
				for _, uid := range podsForDeployment {
					if !seen[uid] {
						seen[uid] = true
						ownerPods = append(ownerPods, uid)
					}
				}
			}

			resources = append(resources, Resource{
				UID:       string(d.UID),
				Name:      d.Name,
				Namespace: d.Namespace,
				Kind:      "Deployment",
				OwnerPods: ownerPods,
			})
		}
	}

	if replicaSets != nil {
		for _, rs := range replicaSets.Items {
			// Skip ReplicaSets that belong to a Deployment
			if len(rs.OwnerReferences) > 0 {
				isOwnedByDeployment := false
				for _, owner := range rs.OwnerReferences {
					if owner.Kind == "Deployment" {
						isOwnedByDeployment = true
						break
					}
				}
				if isOwnedByDeployment {
					continue
				}
			}

			// Get pods owned by this ReplicaSet
			ownerPods := []string{}
			if pods != nil {
				for _, p := range pods.Items {
					for _, owner := range p.OwnerReferences {
						if owner.Kind == "ReplicaSet" && owner.Name == rs.Name {
							ownerPods = append(ownerPods, p.Name)
							break
						}
					}
				}
			}

			resources = append(resources, Resource{
				UID:       string(rs.UID),
				Name:      rs.Name,
				Namespace: rs.Namespace,
				Kind:      "ReplicaSet",
				OwnerPods: ownerPods,
			})
		}
	}

	// Get StatefulSets
	statefulSets, err := clientset.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Error getting statefulsets: %v", err)
	} else {
		for _, ss := range statefulSets.Items {
			resources = append(resources, Resource{
				UID:       string(ss.UID),
				Name:      ss.Name,
				Namespace: ss.Namespace,
				Kind:      "StatefulSet",
			})
		}
	}

	// Get ConfigMaps
	configMaps, err := clientset.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Error getting configmaps: %v", err)
	} else {
		for _, cm := range configMaps.Items {
			resources = append(resources, Resource{
				UID:       string(cm.UID),
				Name:      cm.Name,
				Namespace: cm.Namespace,
				Kind:      "ConfigMap",
			})
		}
	}

	// Get Secrets
	secrets, err := clientset.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Error getting secrets: %v", err)
	} else {
		for _, s := range secrets.Items {
			resources = append(resources, Resource{
				UID:       string(s.UID),
				Name:      s.Name,
				Namespace: s.Namespace,
				Kind:      "Secret",
			})
		}
	}

	// Get Services
	services, err := clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Error getting services: %v", err)
	} else {
		for _, svc := range services.Items {
			resources = append(resources, Resource{
				UID:       string(svc.UID),
				Name:      svc.Name,
				Namespace: svc.Namespace,
				Kind:      "Service",
			})
		}
	}

	// Get Ingresses
	ingresses, err := clientset.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Error getting ingresses: %v", err)
	} else {
		for _, ing := range ingresses.Items {
			resources = append(resources, Resource{
				UID:       string(ing.UID),
				Name:      ing.Name,
				Namespace: ing.Namespace,
				Kind:      "Ingress",
			})
		}
	}

	// Get Custom Resources
	customResources, err := getCustomResources(namespace)
	if err != nil {
		log.Printf("Error getting custom resources: %v", err)
	} else {
		resources = append(resources, customResources...)
	}

	return resources, nil
}

// getCustomResources discovers and fetches all custom resources in a namespace
func getCustomResources(namespace string) ([]Resource, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resources := make([]Resource, 0)

	// Try to discover API groups using the discovery client
	discoveryClient := clientset.Discovery()

	// Get all API groups
	apiLists, err := discoveryClient.ServerGroups()
	if err != nil {
		log.Printf("Error discovering API groups: %v", err)
		return resources, nil
	}

	// Process each API group
	for _, group := range apiLists.Groups {
		// Skip core Kubernetes groups
		if isCoreName(group.Name) {
			continue
		}

		// Get preferred version
		if len(group.Versions) == 0 {
			continue
		}

		version := group.Versions[0]
		gvr := schema.GroupVersionResource{
			Group:    group.Name,
			Version:  version.Version,
			Resource: pluralizeKind("resource"),
		}

		// Try to list resources from this group
		dynamicResource := dynamicClient.Resource(gvr).Namespace(namespace)
		list, err := dynamicResource.List(ctx, metav1.ListOptions{})
		if err != nil {
			continue
		}

		if list != nil {
			for _, item := range list.Items {
				kind := extractKind(&item)
				resources = append(resources, Resource{
					UID:       string(item.GetUID()),
					Name:      item.GetName(),
					Namespace: item.GetNamespace(),
					Kind:      kind,
				})
			}
		}
	}

	return resources, nil
}

// isCoreName checks if a group name is a core K8s group
func isCoreName(name string) bool {
	coreName := map[string]bool{
		"":                          true,
		"apps":                      true,
		"batch":                     true,
		"networking.k8s.io":         true,
		"rbac.authorization.k8s.io": true,
		"storage.k8s.io":            true,
		"policy":                    true,
		"autoscaling":               true,
		"extensions":                true,
	}
	return coreName[name]
}

// findResourceName tries to find the correct resource name for a group/version
func findResourceName(groupName, version string) string {
	// For now, use lowercase singular form
	// In production, this would use discovery API
	resourceMap := map[string]string{
		"sample.k8s.io": "sampleresources",
		"example.com":   "exampleresources",
	}
	if r, ok := resourceMap[groupName]; ok {
		return r
	}
	return "resources"
}

// extractKind extracts the Kind from an unstructured object
func extractKind(obj *unstructured.Unstructured) string {
	kind, ok := obj.Object["kind"].(string)
	if ok && kind != "" {
		return kind
	}
	return "UnknownResource"
}
