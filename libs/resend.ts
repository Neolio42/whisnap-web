import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({
  to,
  subject,
  html,
  from,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) => {
  try {
    const data = await resend.emails.send({
      from: from || 'Whisnap <noreply@whisnap.com>',
      to: [to],
      subject,
      html,
    });

    return data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export default resend;