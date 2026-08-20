'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Campaign extends Model {
    static associate(models) {
      Campaign.hasMany(models.Notification, {
        foreignKey: 'campaignId'
      });
    }
  }
  Campaign.init({
    name: DataTypes.STRING,
    status: DataTypes.ENUM('CREATED', 'PROCESSING', 'COMPLETED', 'FAILED'),
    totalRecipients: DataTypes.INTEGER,
    successCount: DataTypes.INTEGER,
    failedCount: DataTypes.INTEGER,
    sendAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Campaign',
    tableName: 'Campaigns',
  });
  return Campaign;
};