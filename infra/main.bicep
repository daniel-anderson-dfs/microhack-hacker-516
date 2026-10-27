targetScope = 'resourceGroup'

param location string = resourceGroup().location
@minLength(2)
@maxLength(12)
param namePrefix string = 'octocat'
param environmentName string = 'lab'
param apiImage string
param frontendImage string

var baseName = '${namePrefix}-${environmentName}'
var tags = {
  project: 'octocat-supply'
  challenge: 'challenge-5'
  environment: environmentName
  managedBy: 'bicep'
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: toLower(replace('${namePrefix}${environmentName}acr', '-', ''))
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: '${baseName}-pull'
}

module logs 'modules/loganalytics.bicep' = {
  name: 'loganalytics'
  params: {
    location: location
    workspaceName: '${baseName}-logs'
    tags: tags
  }
}

module environment 'modules/containerapp-env.bicep' = {
  name: 'containerapp-env'
  params: {
    location: location
    environmentName: '${baseName}-env'
    logAnalyticsWorkspaceId: logs.outputs.workspaceId
    tags: tags
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    environmentId: environment.outputs.environmentId
    storageAccountName: 'octocat${uniqueString(resourceGroup().id)}'
    tags: tags
  }
}

module apiApp 'modules/containerapp.bicep' = {
  name: 'api-app'
  params: {
    location: location
    appName: '${baseName}-api'
    environmentId: environment.outputs.environmentId
    image: apiImage
    targetPort: 3000
    externalIngress: false
    registryLoginServer: registry.properties.loginServer
    identityId: pullIdentity.id
    storageName: storage.outputs.storageName
    maxReplicas: 1
    tags: tags
    env: [
      { name: 'DB_FILE', value: '/data/octocat.db' }
      { name: 'DB_ENABLE_WAL', value: 'false' }
      { name: 'NODE_ENV', value: 'production' }
    ]
  }
}

module frontendApp 'modules/containerapp.bicep' = {
  name: 'frontend-app'
  params: {
    location: location
    appName: '${baseName}-frontend'
    environmentId: environment.outputs.environmentId
    image: frontendImage
    targetPort: 80
    externalIngress: true
    registryLoginServer: registry.properties.loginServer
    identityId: pullIdentity.id
    maxReplicas: 2
    tags: tags
    env: [
      { name: 'API_HOST', value: apiApp.outputs.fqdn }
      { name: 'API_PORT', value: '443' }
      { name: 'API_PROTOCOL', value: 'https' }
    ]
  }
}

output frontendUrl string = 'https://${frontendApp.outputs.fqdn}'
output acrLoginServer string = registry.properties.loginServer
