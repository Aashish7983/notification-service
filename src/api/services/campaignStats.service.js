const {Campaign, Notification} = require('../../../models');

const getCampaignStatsById = async (campaignId) => {
    const campaign = await Campaign.findByPk(campaignId, {
        attributes: ['id', 'name', 'status', 'totalRecipients', 'successCount', 'failedCount']
    });

    if(!campaign) throw new Error(`Campaign with ID ${campaignId} not found`);
    const successRate = campaign.totalRecipients > 0 ? ((campaign.successCount / campaign.totalRecipients) * 100).toFixed(2) : 0;
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

const getAllCampaigns = async () => {
    const campaigns = await Campaign.findAll({
        attributes: ['id', 'name', 'status', 'totalRecipients', 'successCount', 'failedCount']
    })

    const campaignObj = campaigns.map((campaign) => ({
        campaignName: campaign.name,
        status: campaign.status,
        totalRecipients: campaign.totalRecipients,
        successCount: campaign.successCount,
        failedCount: campaign.failedCount,
        successRate: ((campaign.successCount / campaign.totalRecipients) * 100).toFixed(2)
    }))

    return campaignObj;
}

const uploadCampaignCsv = async (file)=>{
    
}

module.exports = {
    getCampaignStatsById,
    getAllCampaigns,
    uploadCampaignCsv
}