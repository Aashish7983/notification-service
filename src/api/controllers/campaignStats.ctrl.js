const campaign = require('../services/campaignStats.service');


const getCampaignStatsController = async (req, res) => {
    const {campaignId} = req.params;
    const campaignStats = await campaign.getCampaignStatsById(campaignId);
    res.json(campaignStats);
};

module.exports = {
    getCampaignStatsController
}