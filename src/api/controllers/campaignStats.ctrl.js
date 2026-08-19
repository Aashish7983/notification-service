const campaign = require('../services/campaignStats.service');
const notification = require('../services/notification.service');

const getCampaignStatsController = async (req, res) => {
    const {campaignId} = req.params;
    const campaignStats = await campaign.getCampaignStatsById(campaignId);
    res.json(campaignStats);
};

const getAllCampaigns = async (req, res) => {
    const campaigns = await campaign.getAllCampaigns();
    res.json(campaigns);
}

const uploadCampaignCsv = async(req, res) => {
    console.log(req.file);
    const emails = await notification.extractEmailFromCsv(req.file.path);
    // res.json(campaigns);

    res.json({
    totalEmails: emails.length,
    emails,
    });
}

module.exports = {
    getCampaignStatsController,
    getAllCampaigns,
    uploadCampaignCsv
}