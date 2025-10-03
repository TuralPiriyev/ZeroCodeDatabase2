const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

function scheduleExpireJob() {
  // Run hourly
  cron.schedule('0 * * * *', async () => {
    console.log('[expireJob] running expire check');
    try {
      const now = new Date();
      const expired = await Subscription.find({ expires_at: { $lt: now }, status: { $ne: 'EXPIRED' } }).exec();
      for (const s of expired) {
        s.status = 'EXPIRED';
        s.updated_at = new Date();
        await s.save();
        await User.findByIdAndUpdate(s.user_id, { subscription_status: 'Free', updated_at: new Date() });
        console.log('[expireJob] expired subscription', s._id);
      }
    } catch (e) {
      console.error('[expireJob] error', e && e.message ? e.message : e);
    }
  });
}

module.exports = { scheduleExpireJob };
