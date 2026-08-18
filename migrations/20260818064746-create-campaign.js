'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Campaigns', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING, 
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('CREATED', 'PROCESSING', 'COMPLETED', 'FAILED'),
        defaultValue: 'CREATED'
      },
      totalRecipients: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      successCount: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      failedCount: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Campaigns');
  }
};