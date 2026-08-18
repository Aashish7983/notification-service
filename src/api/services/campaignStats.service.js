const {Campaign, Notification} = require('../../../models');

const getCampaignStatsById = async (campaignId) => {
    const campaign = await Campaign.findByPk(campaignId, {
        attributes: ['id', 'name', 'status', 'totalRecipients', 'successCount', 'failedCount']
    });

    if(!campaign) throw new Error(`Campaign with ID ${campaignId} not found`);
    const successRate = campaign.totalRecipients > 0 ? (campaign.successCount / campaign.totalRecipients) * 100 : 0;
    const failedRate = campaign.totalRecipients > 0 ? (campaign.failedCount / campaign.totalRecipients) * 100 : 0;

    return {
        campaignName: campaign.name, 
        status: campaign.status,
        totalRecipients: campaign.totalRecipients,
        successCount: campaign.successCount,
        failedCount: campaign.failedCount,
        successRate: `${successRate}%`
    };
}

module.exports = {
    getCampaignStatsById
}