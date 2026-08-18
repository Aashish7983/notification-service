const router = require('express').Router();
const {getCampaignStatsController} = require('../controllers/campaignStats.ctrl');

router.get('/:campaignId/stats', getCampaignStatsController);

module.exports = router;