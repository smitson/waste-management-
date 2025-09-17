// Virtual network and subnets for app and database
param location string
param appName string

resource vnet 'Microsoft.Network/virtualNetworks@2022-07-01' = {
  name: '${appName}-vnet'
  location: location
  properties: {
    addressSpace: { addressPrefixes: [ '10.10.0.0/16' ] }
    subnets: [
      {
        name: 'app'
        properties: { addressPrefix: '10.10.1.0/24' }
      }
      {
        name: 'db'
        properties: { addressPrefix: '10.10.2.0/24' }
      }
    ]
  }
}

output vnetId string = vnet.id
output appSubnetId string = vnet.properties.subnets[0].id
output dbSubnetId string = vnet.properties.subnets[1].id
