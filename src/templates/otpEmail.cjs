const otpEmailTemplate = (otp, appName = 'ZeroCodeDB') => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${appName} - Verify Your Email</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            -webkit-text-size-adjust: 100%;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            padding: 20px 0;
        }
        .logo {
            max-width: 150px;
            height: auto;
        }
        .otp-container {
            background-color: #f8fafc;
            border-radius: 8px;
            padding: 30px;
            margin: 20px 0;
            text-align: center;
        }
        .otp-code {
            font-size: 32px;
            letter-spacing: 4px;
            color: #1a56db;
            font-weight: bold;
            padding: 10px;
            background: #ffffff;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
            display: inline-block;
            margin: 10px 0;
        }
        .message {
            color: #4a5568;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            color: #718096;
            font-size: 14px;
            margin-top: 40px;
        }
        @media only screen and (max-width: 600px) {
            .container {
                padding: 10px;
            }
            .otp-code {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #2d3748;">${appName}</h1>
        </div>
        <div class="message">
            Hello,<br>
            Thank you for registering. To complete your registration, please enter the following verification code:
        </div>
        <div class="otp-container">
            <div class="otp-code">${otp}</div>
            <p style="color: #718096;">This code will expire in 10 minutes</p>
        </div>
        <div class="message">
            If you didn't request this code, you can safely ignore this email.
        </div>
        <div class="footer">
            &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.<br>
            This is an automated message, please do not reply.
        </div>
    </div>
</body>
</html>
`;

module.exports = { otpEmailTemplate };