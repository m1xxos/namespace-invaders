import axios from 'axios'

const API_BASE = '/api'

export interface Namespace {
  name: string
}

export interface Resource {
  uid: string
  name: string
  namespace: string
  kind: string
  apiVersion?: string
  ownerPods?: string[]
}

export async function getNamespaces(): Promise<Namespace[]> {
  const response = await axios.get(`${API_BASE}/namespaces`)
  return response.data
}

export async function getResources(namespace: string): Promise<Resource[]> {
  const response = await axios.get(`${API_BASE}/resources`, {
    params: { namespace },
  })
  return response.data || []
}

export async function deleteResource(namespace: string, kind: string, name: string): Promise<void> {
  await axios.post(`${API_BASE}/resources/delete`, {
    namespace,
    kind,
    name,
  })
}
