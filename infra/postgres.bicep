// Azure Database for PostgreSQL Flexible Server
param location string
param dbName string
param adminUser string
param adminPassword string
param vnetId string
param subnetId string

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2022-01-20-preview' = {
  name: dbName
  location: location
  properties: {
    administratorLogin: adminUser
    administratorLoginPassword: adminPassword
    version: '13'
    storage: { storageSizeGB: 32 }
    network: {
      delegatedSubnetResourceId: subnetId
      privateDnsZoneArmResourceId: ''
    }
    highAvailability: { mode: 'ZoneRedundant' }
    createMode: 'Default'
  }
  sku: {
    name: 'Standard_D2s_v3'
    tier: 'GeneralPurpose'
    capacity: 2
    family: 'Gen5'
  }
}

output connectionString string = 'Host=' + postgres.name + '.postgres.database.azure.com;Database=postgres;User Id=' + adminUser + '@' + postgres.name + ';Password=' + adminPassword
