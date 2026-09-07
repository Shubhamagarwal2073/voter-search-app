import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';

// Force dynamic so it doesn't cache the API response
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email address is required.' }, { status: 400 });
    }

    // You must set these environment variables in your .env or .env.local file
    const smtpEmail = process.env.SMTP_EMAIL || 'your-email@gmail.com';
    const smtpPassword = process.env.SMTP_PASSWORD || 'your-app-password';

    if (smtpEmail === 'your-email@gmail.com') {
        console.warn('WARNING: Using dummy SMTP credentials. Email will fail unless SMTP_EMAIL and SMTP_PASSWORD are set in .env');
    }

    // Configure the SMTP transporter (Gmail example)
    const transporter = nodemailer.createTransport({
      service: 'gmail', // You can change this to 'SendGrid', 'Yahoo', etc.
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
    });

    const pdfPath = path.resolve(process.cwd(), 'public', 'welcome_flow.pdf');
    let attachments: any[] = [];
    
    if (fs.existsSync(pdfPath)) {
        attachments = [
            {
                filename: 'welcome_flow.pdf',
                path: pdfPath,
                contentType: 'application/pdf'
            }
        ];
    }

    const mailOptions = {
      from: `"Voter Portal Admin" <${smtpEmail}>`,
      to: email,
      subject: 'Welcome to the Unofficial Voter Lookup Portal!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1E2A42;">
          <h1 style="color: #A2382B;">Welcome, ${name || 'User'}!</h1>
          <p>You have been officially granted access to the Unofficial Voter Lookup Portal Balotra.</p>
          
          <h3>How to get started:</h3>
          <p>Access the portal here: <a href="https://34-61-251-113.nip.io/">https://34-61-251-113.nip.io/</a></p>
          
          <ul>
            <li><strong>Install as an App:</strong> Open the site in your mobile browser, click the menu, and select "Add to Home Screen".</li>
            <li><strong>Ward Voter Lists:</strong> Instantly download PDF voter lists for your specific ward.</li>
            <li><strong>Digital Selfie Booth:</strong> Take a customized selfie with election themes to share online!</li>
            <li><strong>Ward Maps & Booth Locator:</strong> Visualize constituency boundaries and find your polling booth on Google Maps.</li>
            <li><strong>Candidate Directory:</strong> Explore profiles of all candidates in your ward.</li>
          </ul>

          <p>We have attached a PDF flow diagram explaining how everything works!</p>

          <br/>
          <hr style="border: 1px solid #E1D7BC;" />
          <p style="font-size: 14px; color: #4A4536; text-align: center;">
            <strong>Thanks from IWS and RK Coaching Classes!</strong><br/>
            Technical Support: 8890106858 (Shubham Agrawal)
          </p>
        </div>
      `,
      attachments: attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);

    return NextResponse.json({ success: true, message: 'Email sent successfully!' });

  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ success: false, error: 'Failed to send email. Please check SMTP configuration.' }, { status: 500 });
  }
}
