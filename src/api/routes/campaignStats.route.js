const router = require('express').Router();
const campaign = require('../controllers/campaignStats.ctrl');
const upload = require('../../config/multer');

router.get('/:campaignId/stats', campaign.getCampaignStatsController);
router.get('/list', campaign.getAllCampaigns);
router.post('/upload', upload.single('file'), campaign.uploadCampaignCsv)

module.exports = router;