param location string
param appName string
param environmentId string
param image string
param targetPort int
param externalIngress bool
param registryLoginServer string
param identityId string
param env array = []
param tags object = {}
@minValue(1)
param maxReplicas int = 1

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: externalIngress
        targetPort: targetPort
        transport: 'http'
        allowInsecure: false
        traffic: [{ weight: 100, latestRevision: true }]
      }
      registries: [{
        server: registryLoginServer
        identity: identityId
      }]
    }
    template: {
      containers: [{
        name: appName
        image: image
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: env
        volumeMounts: []
        probes: [
          {
            type: 'Startup'
            httpGet: { path: '/', port: targetPort }
            periodSeconds: 5
            failureThreshold: 60
          }
          {
            type: 'Readiness'
            httpGet: { path: '/', port: targetPort }
            periodSeconds: 5
            failureThreshold: 3
          }
          {
            type: 'Liveness'
            httpGet: { path: '/', port: targetPort }
            periodSeconds: 30
            failureThreshold: 3
          }
        ]
      }]
      volumes: []
      scale: {
        minReplicas: 1
        maxReplicas: maxReplicas
        rules: [{
          name: 'http'
          http: { metadata: { concurrentRequests: '20' } }
        }]
      }
    }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
