const sgmail = require('@sendgrid/mail');

sgmail.setApiKey(process.env.SENDGRID_API_KEY)
// Fake provider for development/testing: no real email is sent.
// MOCK_EMAIL_MODE controls behaviour: success | fail | flaky
const mockSend = async ({to, subject, text}) => {
    await new Promise(r => setTimeout(r, 200));

    const mode = process.env.MOCK_EMAIL_MODE || 'success';

    if (mode === 'fail') {
        throw new Error('Mock: email provider down');
    }

    if (mode === 'flaky' && Math.random() < 0.5) {
        throw new Error('Mock: random failure');
    }

    console.log(`[MOCK EMAIL] to=${to} subject=${subject}`);
}

const sendEmail = async ({to, subject, text}) => {
    if (process.env.EMAIL_PROVIDER === 'mock') {
        return mockSend({to, subject, text});
    }

    const msg = {
        to,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject,
        text,
    }
    await sgmail.send(msg);
}

module.exports = {
    sendEmail
};
 {
    sendEmail
};