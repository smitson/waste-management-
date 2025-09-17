// App Service Plan and Web App for Docker container
param location string
param appName string
param dbConnectionString string
param subnetId string

resource plan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: '${appName}-plan'
  location: location
  sku: {
    name: 'P1v2'
    tier: 'PremiumV2'
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource app 'Microsoft.Web/sites@2022-03-01' = {
  name: appName
  location: location
  kind: 'app,linux,container'
  properties: {
    serverFarmId: plan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|<your-docker-image-url>' // Replace with your image
      appSettings: [
        {
          name: 'DATABASE_URL'
          value: dbConnectionString
        }
      ]
      virtualNetworkSubnetId: subnetId
    }
    httpsOnly: true
  }
}
