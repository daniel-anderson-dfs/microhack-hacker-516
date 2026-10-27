targetScope = 'resourceGroup'

param location string = resourceGroup().location
param namePrefix string = 'octocat'
param environmentName string = 'lab'
@description('Exact GitHub OIDC sub claim, including immutable owner/repository IDs when enabled.')
param githubSubject string
param enableRegistryAdmin bool = false

var baseName = '${namePrefix}-${environmentName}'
var registryName = toLower(replace('${namePrefix}${environmentName}acr', '-', ''))

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: { name: 'Basic' }
  properties: {
    // Disable only after existing apps have switched to managed-identity pulls.
    adminUserEnabled: enableRegistryAdmin
  }
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${baseName}-pull'
  location: location
}

resource deployIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${baseName}-github'
  location: location
}

resource federation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deployIdentity
  name: 'github-deploy'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: githubSubject
    audiences: ['api://AzureADTokenExchange']
  }
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, pullIdentity.id, 'AcrPull')
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: pullIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource deployContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, deployIdentity.id, 'Contributor')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')
    principalId: deployIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output clientId string = deployIdentity.properties.clientId
output tenantId string = tenant().tenantId
output registryName string = registry.name
