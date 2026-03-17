package k8s

// Namespace represents a K8s namespace
type Namespace struct {
	Name string `json:"name"`
}

// Resource represents a K8s resource
type Resource struct {
	UID        string   `json:"uid"`
	Name       string   `json:"name"`
	Namespace  string   `json:"namespace"`
	Kind       string   `json:"kind"`
	APIVersion string   `json:"apiVersion"`
	Status     string   `json:"status,omitempty"`
	Age        string   `json:"age,omitempty"`
	OwnerPods  []string `json:"ownerPods,omitempty"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error string `json:"error"`
}

// DeleteRequest represents a delete request
type DeleteRequest struct {
	UID       string `json:"uid"`
	Namespace string `json:"namespace"`
	Kind      string `json:"kind"`
	Name      string `json:"name"`
}
