const sgmail = require('@sendgrid/mail');

sgmail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async ({to, subject, text}) => {
    const msg = {
        to, 
        from: process.env.SENDGRID_FROM_EMAIL,
        subject, 
        text,
    }

    console.log('Sending email with the following details:', msg);
    await sgmail.send(msg);
}

module.exports = {
    sendEmail
};