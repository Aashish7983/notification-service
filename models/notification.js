'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Notification.belongsTo(models.Campaign, {
        foreignKey: 'campaignId',
      });
    }
  }
  Notification.init({
    notificationType: DataTypes.ENUM('EMAIL', 'SMS', 'WHATSAPP'),
    sendTo: DataTypes.STRING,
    message: DataTypes.TEXT,
    status: DataTypes.ENUM('PENDING', 'PROCESSING', 'FAILED', 'SUCCESS'),
    attempts: DataTypes.INTEGER,
    sendAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
  });
  return Notification;
};