// Azure Storage Account for file storage (e.g., reports, uploads)
param location string
param appName string

resource storage 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: toLower('${appName}storage')
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
  }
}

output storageAccountName string = storage.name
output storageAccountConnectionString string = listKeys(storage.id, storage.apiVersion).keys[0].value
