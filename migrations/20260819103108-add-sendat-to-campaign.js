'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Campaigns', 'sendAt', {
      type: Sequelize.DATE,
      allowNull:true
    })
  },

  async down (queryInterface, Sequelize) {
    
  }
};
