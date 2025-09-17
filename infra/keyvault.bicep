// Azure Key Vault for storing secrets
param location string
param appName string
param dbConnectionString string

resource kv 'Microsoft.KeyVault/vaults@2022-07-01' = {
  name: '${appName}-kv'
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    accessPolicies: []
    enableSoftDelete: true
    enablePurgeProtection: true
  }
}

resource secret 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  name: '${kv.name}/DbConnectionString'
  properties: {
    value: dbConnectionString
  }
}
