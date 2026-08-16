#!/usr/bin/env node
// MASTER_DEVELOPMENT_PLAN.md O1.6 — emails the nightly E2E pass/fail summary
// using the same Gmail SMTP relay wired up in O1.5 (jayhind-client-back/.env).
// Standalone (not part of the NestJS app) so a broken app build never
// prevents the nightly report itself from going out — run from
// jayhind-client-back's own node_modules (dotenv + nodemailer already
// dependencies there) via `node --prefix`.
//
// Usage: node send-nightly-summary.js <resultsFile> <dateTag> <passCount> <failCount> <totalCount>

const fs = require('fs');
const path = require('path');

const CLIENT_BACK = '/home/ubuntu/projects/jayhind/jayhind-client-back';
require(path.join(CLIENT_BACK, 'node_modules/dotenv')).config({ path: path.join(CLIENT_BACK, '.env') });
const nodemailer = require(path.join(CLIENT_BACK, 'node_modules/nodemailer'));

const [, , resultsFile, dateTag, passCount, failCount, totalCount] = process.argv;

async function main() {
    const results = fs.readFileSync(resultsFile, 'utf8');
    const allGreen = Number(failCount) === 0;

    if (!process.env.SMTP_HOST) {
        console.log('[send-nightly-summary] SMTP_HOST not set — skipping email, results are in ' + resultsFile);
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const subject = allGreen
        ? `✅ Nightly E2E ${dateTag}: ${passCount}/${totalCount} passed`
        : `⚠️ Nightly E2E ${dateTag}: ${failCount} FAILED (${passCount}/${totalCount} passed)`;

    await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: process.env.SMTP_USER,
        subject,
        text: results,
    });

    console.log(`[send-nightly-summary] sent: ${subject}`);
}

main().catch((err) => {
    // The nightly run itself must not be considered "failed" just because the
    // report email couldn't send — results.txt on disk is the durable record.
    console.error('[send-nightly-summary] FAILED TO SEND (results are still in ' + resultsFile + '): ' + err.message);
});
