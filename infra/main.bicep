// Main Bicep file for Waste Management System Azure deployment
// This file orchestrates all modules

param location string = resourceGroup().location
param appName string = 'waste-mgmt-app'
param dbName string = 'wastemgmtdb'
param adminUser string = 'pgadmin'
param adminPassword string

module network 'network.bicep' = {
  name: 'network'
  params: {
    location: location
    appName: appName
  }
}

module postgres 'postgres.bicep' = {
  name: 'postgres'
  params: {
    location: location
    dbName: dbName
    adminUser: adminUser
    adminPassword: adminPassword
    vnetId: network.outputs.vnetId
    subnetId: network.outputs.dbSubnetId
  }
}

module appservice 'appservice.bicep' = {
  name: 'appservice'
  params: {
    location: location
    appName: appName
    dbConnectionString: postgres.outputs.connectionString
    subnetId: network.outputs.appSubnetId
  }

module keyVault 'keyvault.bicep' = {
  name: 'keyVault'
  params: {
    location: location
    appName: appName
    dbConnectionString: postgres.outputs.connectionString
  }
}

module storage 'storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    appName: appName
  }
}
}

module keyvault 'keyvault.bicep' = {
  name: 'keyvault'
  params: {
    location: location
    appName: appName
    dbConnectionString: postgres.outputs.connectionString
  }
}
