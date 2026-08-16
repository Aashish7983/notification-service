'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.INTEGER, 
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      notificationType:{
        type: Sequelize.ENUM('EMAIL', 'SMS', 'WHATSAPP'),
        allowNull: false,
      },

      sendTo: {
        type: Sequelize.STRING,
        allowNull: false
      }, 
      message:{
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'PROCESSING', 'FAILED', 'SUCCESS'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      sendAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    })
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('notifications');
  }
};
